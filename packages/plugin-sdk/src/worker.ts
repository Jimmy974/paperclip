import { RpcChannel } from "./rpc.js";
import { matchRoute } from "./route-matcher.js";
import type {
  PluginContext,
  PluginWorkerHandlers,
  PluginRequest,
  EventPayload,
  JobContext,
  ToolRunContext,
} from "./types.js";

/**
 * Boot a plugin worker process. Connects stdin/stdout as JSON-RPC channel to the host.
 * Routes incoming host calls to the provided handlers.
 */
export function createPluginWorker(handlers: PluginWorkerHandlers): void {
  const channel = new RpcChannel(process.stdin, process.stdout);
  let ctx: PluginContext;

  // Build PluginContext — each method sends an RPC to the host
  function buildContext(): PluginContext {
    return {
      issues: {
        create: (input) => channel.call("issues.create", input) as Promise<any>,
        read: (id) => channel.call("issues.read", { issueId: id }) as Promise<any>,
        update: (id, input) => channel.call("issues.update", { issueId: id, ...input }) as Promise<any>,
        list: (companyId, filter) => channel.call("issues.list", { companyId, ...filter }) as Promise<any>,
        addComment: (id, body) => channel.call("issues.addComment", { issueId: id, body }) as Promise<any>,
      },
      agents: {
        list: (companyId) => channel.call("agents.list", { companyId }) as Promise<any>,
        read: (id) => channel.call("agents.read", { agentId: id }) as Promise<any>,
        wakeup: (id, input) => channel.call("agents.wakeup", { agentId: id, ...input }) as Promise<void>,
      },
      events: {
        emit: (name, payload) => channel.call("events.emit", { name, payload }) as Promise<void>,
      },
      state: {
        get: (scope, key) => channel.call("state.get", { scope, key }) as Promise<unknown>,
        set: (scope, key, value) => channel.call("state.set", { scope, key, value }) as Promise<void>,
        delete: (scope, key) => channel.call("state.delete", { scope, key }) as Promise<void>,
      },
      config: {
        get: () => channel.call("config.get") as Promise<Record<string, unknown>>,
      },
      logger: {
        debug: (message, data) => { channel.call("logger.debug", { message, data }).catch(() => {}); },
        info: (message, data) => { channel.call("logger.info", { message, data }).catch(() => {}); },
        warn: (message, data) => { channel.call("logger.warn", { message, data }).catch(() => {}); },
        error: (message, data) => { channel.call("logger.error", { message, data }).catch(() => {}); },
      },
    };
  }

  // Route keys for route matching
  const routeKeys = handlers.routes ? Object.keys(handlers.routes) : [];

  channel.setRequestHandler(async (method, params, _id) => {
    const p = (params ?? {}) as Record<string, unknown>;

    switch (method) {
      case "initialize":
        ctx = buildContext();
        await handlers.initialize(ctx);
        return { ok: true };

      case "health":
        return handlers.health();

      case "shutdown":
        await handlers.shutdown();
        setTimeout(() => process.exit(0), 100);
        return { ok: true };

      case "configChanged":
        if (handlers.configChanged) {
          await handlers.configChanged(ctx, p.config as Record<string, unknown>);
        }
        return { ok: true };

      case "runJob": {
        const jobKey = p.jobKey as string;
        const handler = handlers.jobs?.[jobKey];
        if (!handler) throw new Error(`no handler for job "${jobKey}"`);
        const jobCtx: JobContext = {
          jobKey,
          triggerSource: (p.triggerSource as "schedule" | "manual") ?? "schedule",
          runId: p.runId as string,
        };
        await handler(ctx, jobCtx);
        return { ok: true };
      }

      case "onEvent": {
        const eventName = p.name as string;
        const handler = handlers.events?.[eventName];
        if (!handler) return { ok: true }; // silently ignore unhandled events
        const eventPayload: EventPayload = {
          name: eventName,
          payload: p.payload as Record<string, unknown>,
          timestamp: p.timestamp as string,
        };
        await handler(ctx, eventPayload);
        return { ok: true };
      }

      case "executeTool": {
        const toolName = p.toolName as string;
        const tool = handlers.tools?.[toolName];
        if (!tool) throw new Error(`no handler for tool "${toolName}"`);
        return tool.handler(
          ctx,
          p.parameters as Record<string, unknown>,
          p.runContext as ToolRunContext,
        );
      }

      case "handleRequest": {
        const req = p as unknown as PluginRequest;
        if (!handlers.routes || routeKeys.length === 0) {
          return { status: 404, body: { error: "no routes" } };
        }
        const match = matchRoute(routeKeys, req.method, req.path);
        if (!match) {
          return { status: 404, body: { error: "route not found" } };
        }
        const routeHandler = handlers.routes[match.key];
        return routeHandler(ctx, { ...req, params: { ...req.params, ...match.params } });
      }

      default:
        throw new Error(`unknown method: ${method}`);
    }
  });

  // Handle SIGTERM gracefully
  process.on("SIGTERM", async () => {
    try {
      await handlers.shutdown();
    } finally {
      process.exit(0);
    }
  });
}
