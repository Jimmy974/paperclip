import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import {
  createRequest,
  createSuccessResponse,
  createErrorResponse,
  parseMessage,
  serializeMessage,
  isJsonRpcRequest,
  isJsonRpcResponse,
  isJsonRpcNotification,
  isJsonRpcSuccessResponse,
  isJsonRpcErrorResponse,
  JSONRPC_ERROR_CODES,
  PLUGIN_RPC_ERROR_CODES,
  type HostClientHandlers,
} from "@paperclipai/plugin-sdk";
import { RPC_TIMEOUTS } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tsxBin = path.resolve(__dirname, "../../node_modules/.bin/tsx");

export interface PluginWorkerEntry {
  pluginId: string;
  process: ChildProcess;
  status: "starting" | "ready" | "error" | "stopping";
  restartCount: number;
  lastRestartAt?: Date;
}

interface SpawnOptions {
  initTimeoutMs?: number;
}

interface InitializeParams {
  pluginId: string;
  manifest: Record<string, unknown>;
  config: Record<string, unknown>;
}

export class ProcessManager {
  private workers = new Map<string, PluginWorkerEntry>();
  // Internal call function per worker (closure, not on the entry)
  private workerCalls = new Map<
    string,
    (method: string, params: unknown, timeoutMs: number) => Promise<unknown>
  >();

  /**
   * Spawn a plugin worker process and send initialize.
   */
  async spawn(
    pluginId: string,
    workerEntrypoint: string,
    initParams: InitializeParams,
    handlers: HostClientHandlers,
    opts?: SpawnOptions,
  ): Promise<void> {
    const child = spawn(tsxBin, [workerEntrypoint], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    // Capture stderr for logging
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      console.log(`[plugin:${pluginId}:stderr] ${chunk.trimEnd()}`);
    });

    // Pending outbound (host→worker) requests
    const pending = new Map<
      number,
      { resolve: (r: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
    >();
    let nextId = 1;

    function send(message: unknown): void {
      child.stdin!.write(serializeMessage(message as any));
    }

    function callWorker(method: string, params: unknown, timeoutMs: number): Promise<unknown> {
      return new Promise((resolve, reject) => {
        const id = nextId++;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Plugin ${pluginId}: call "${method}" timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        send(createRequest(method, params, id));
      });
    }

    const entry: PluginWorkerEntry = {
      pluginId,
      process: child,
      status: "starting",
      restartCount: 0,
    };
    this.workers.set(pluginId, entry);
    this.workerCalls.set(pluginId, callWorker);

    // Read JSON-RPC messages from worker stdout
    const rl = createInterface({ input: child.stdout!, crlfDelay: Infinity });

    rl.on("line", async (line: string) => {
      if (!line.trim()) return;

      let message: unknown;
      try {
        message = parseMessage(line);
      } catch {
        console.warn(`[plugin:${pluginId}] invalid message: ${line.substring(0, 100)}`);
        return;
      }

      if (isJsonRpcResponse(message)) {
        // Response to an outbound host→worker call
        const id = (message as any).id as number;
        const p = pending.get(id);
        if (!p) return;
        clearTimeout(p.timer);
        pending.delete(id);
        if (isJsonRpcSuccessResponse(message)) {
          p.resolve((message as any).result);
        } else if (isJsonRpcErrorResponse(message)) {
          p.reject(new Error((message as any).error?.message ?? "Unknown RPC error"));
        }
      } else if (isJsonRpcRequest(message)) {
        // Worker→Host call — route through createHostClientHandlers
        const req = message as any;
        const method = req.method as string;
        const params = req.params;
        const id = req.id;

        try {
          const handler = (handlers as any)[method] as ((p: unknown) => Promise<unknown>) | undefined;
          if (!handler) {
            send(createErrorResponse(id, JSONRPC_ERROR_CODES.METHOD_NOT_FOUND, `Unknown method: ${method}`));
            return;
          }
          const result = await handler(params);
          send(createSuccessResponse(id, result ?? null));
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          const code: number =
            typeof (err as any)?.code === "number"
              ? (err as any).code
              : PLUGIN_RPC_ERROR_CODES.WORKER_ERROR;
          send(createErrorResponse(id, code, errorMessage));
        }
      } else if (isJsonRpcNotification(message)) {
        // Notifications from worker (e.g. "log")
        const notif = message as any;
        if (notif.method === "log" && notif.params) {
          const { level, message: msg, meta } = notif.params;
          console.log(`[plugin:${pluginId}:${level}] ${msg}`, meta ?? {});
        }
        // streams.open / streams.emit / streams.close — ignored for now
      }
    });

    // Handle unexpected exit
    child.on("exit", (code, signal) => {
      const current = this.workers.get(pluginId);
      if (current && current.status !== "stopping") {
        console.warn(`[plugins] worker ${pluginId} exited unexpectedly (code=${code}, signal=${signal})`);
        current.status = "error";
        rl.close();
      }
    });

    // Send initialize
    const timeout = opts?.initTimeoutMs ?? RPC_TIMEOUTS.initialize;
    try {
      await callWorker("initialize", {
        manifest: initParams.manifest,
        config: initParams.config,
      }, timeout);
      entry.status = "ready";
    } catch (err) {
      entry.status = "error";
      rl.close();
      child.kill("SIGKILL");
      this.workers.delete(pluginId);
      this.workerCalls.delete(pluginId);
      throw new Error(
        `Plugin ${pluginId} failed to initialize: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Get a worker entry by plugin ID.
   */
  get(pluginId: string): PluginWorkerEntry | undefined {
    return this.workers.get(pluginId);
  }

  /**
   * Send an RPC call to a specific worker.
   */
  async call(pluginId: string, method: string, params?: unknown): Promise<unknown> {
    const entry = this.workers.get(pluginId);
    if (!entry || entry.status !== "ready") {
      throw new Error(`Plugin ${pluginId} is not ready (status: ${entry?.status ?? "not found"})`);
    }
    const callWorker = this.workerCalls.get(pluginId);
    if (!callWorker) throw new Error(`No call function for plugin ${pluginId}`);
    const timeout = RPC_TIMEOUTS[method] ?? 30_000;
    return callWorker(method, params, timeout);
  }

  /**
   * Gracefully shut down a single worker.
   */
  async shutdown(pluginId: string): Promise<void> {
    const entry = this.workers.get(pluginId);
    if (!entry) return;

    entry.status = "stopping";

    const callWorker = this.workerCalls.get(pluginId);
    if (callWorker) {
      try {
        await callWorker("shutdown", {}, RPC_TIMEOUTS.shutdown);
      } catch {
        // Timeout or error — force kill
      }
    }

    // Give the process time to exit, then force
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        entry.process.kill("SIGKILL");
        resolve();
      }, 5000);
      entry.process.on("exit", () => {
        clearTimeout(timer);
        resolve();
      });
      if (entry.process.exitCode !== null) {
        clearTimeout(timer);
        resolve();
      }
    });

    this.workers.delete(pluginId);
    this.workerCalls.delete(pluginId);
  }

  /**
   * Shut down all workers.
   */
  async shutdownAll(): Promise<void> {
    const ids = Array.from(this.workers.keys());
    await Promise.allSettled(ids.map((id) => this.shutdown(id)));
  }

  /**
   * List all worker plugin IDs.
   */
  list(): string[] {
    return Array.from(this.workers.keys());
  }

  /**
   * Check if a worker is ready.
   */
  isReady(pluginId: string): boolean {
    return this.workers.get(pluginId)?.status === "ready";
  }
}
