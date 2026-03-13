import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ProcessManager, type PluginWorkerEntry } from "../plugins/process-manager.js";

// We'll test with a simple echo worker script
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function createTestWorker(tmpDir: string, behavior: "healthy" | "crash" | "slow-init"): string {
  const workerPath = path.join(tmpDir, `worker-${behavior}.mjs`);
  const code = {
    healthy: `
import { createInterface } from "readline";
const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const msg = JSON.parse(line);
  if (msg.method === "initialize") {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { ok: true } }) + "\\n");
  } else if (msg.method === "health") {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { status: "ok" } }) + "\\n");
  } else if (msg.method === "shutdown") {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { ok: true } }) + "\\n");
    setTimeout(() => process.exit(0), 50);
  } else {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { ok: true } }) + "\\n");
  }
});
`,
    crash: `process.exit(1);`,
    "slow-init": `
import { createInterface } from "readline";
const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const msg = JSON.parse(line);
  // Never respond to initialize — causes timeout
});
`,
  };
  fs.writeFileSync(workerPath, code[behavior]);
  return workerPath;
}

describe("ProcessManager", () => {
  let tmpDir: string;
  let pm: ProcessManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pm-test-"));
    pm = new ProcessManager();
  });

  afterEach(async () => {
    await pm.shutdownAll();
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("spawns and initializes a healthy worker", async () => {
    const workerPath = createTestWorker(tmpDir, "healthy");
    await pm.spawn("test-plugin-1", workerPath, {
      pluginId: "test-plugin-1",
      manifest: {} as any,
      config: {},
    });

    const entry = pm.get("test-plugin-1");
    expect(entry).toBeDefined();
    expect(entry!.status).toBe("ready");
  });

  it("marks plugin as error when init times out", async () => {
    const workerPath = createTestWorker(tmpDir, "slow-init");
    await expect(
      pm.spawn("test-plugin-2", workerPath, {
        pluginId: "test-plugin-2",
        manifest: {} as any,
        config: {},
      }, { initTimeoutMs: 500 }),
    ).rejects.toThrow();
  });

  it("sends shutdown to worker", async () => {
    const workerPath = createTestWorker(tmpDir, "healthy");
    await pm.spawn("test-plugin-3", workerPath, {
      pluginId: "test-plugin-3",
      manifest: {} as any,
      config: {},
    });

    await pm.shutdown("test-plugin-3");
    const entry = pm.get("test-plugin-3");
    expect(entry).toBeUndefined();
  });
});
