import { describe, it, expect, vi, beforeEach } from "vitest";
import { scanPluginPackages, syncPluginToDb } from "../plugins/loader.js";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

describe("scanPluginPackages", () => {
  it("finds packages with paperclipPlugin key", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-test-"));
    const pluginDir = path.join(tmpDir, "node_modules", "@test", "plugin-foo");
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, "package.json"),
      JSON.stringify({
        name: "@test/plugin-foo",
        version: "1.0.0",
        paperclipPlugin: {
          manifest: "./dist/manifest.js",
          worker: "./dist/worker.js",
        },
      }),
    );
    // Create a minimal manifest module
    const distDir = path.join(pluginDir, "dist");
    fs.mkdirSync(distDir);
    fs.writeFileSync(
      path.join(distDir, "manifest.js"),
      `export const manifest = ${JSON.stringify({
        id: "@test/plugin-foo",
        apiVersion: 1,
        version: "1.0.0",
        displayName: "Foo",
        description: "test",
        categories: ["automation"],
        capabilities: ["issues.read"],
        entrypoints: { worker: "./worker.js" },
      })};`,
    );
    fs.writeFileSync(path.join(distDir, "worker.js"), "");

    const results = await scanPluginPackages(tmpDir);
    expect(results).toHaveLength(1);
    expect(results[0].manifest.id).toBe("@test/plugin-foo");
    expect(results[0].installPath).toBe(pluginDir);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it("skips packages without paperclipPlugin key", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-test-"));
    const pkgDir = path.join(tmpDir, "node_modules", "express");
    fs.mkdirSync(pkgDir, { recursive: true });
    fs.writeFileSync(
      path.join(pkgDir, "package.json"),
      JSON.stringify({ name: "express", version: "4.0.0" }),
    );

    const results = await scanPluginPackages(tmpDir);
    expect(results).toHaveLength(0);

    fs.rmSync(tmpDir, { recursive: true });
  });

  it("rejects plugin with invalid manifest", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-test-"));
    const pluginDir = path.join(tmpDir, "node_modules", "@test", "plugin-bad");
    const distDir = path.join(pluginDir, "dist");
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, "package.json"),
      JSON.stringify({
        name: "@test/plugin-bad",
        paperclipPlugin: { manifest: "./dist/manifest.js", worker: "./dist/worker.js" },
      }),
    );
    // Missing required fields
    fs.writeFileSync(
      path.join(distDir, "manifest.js"),
      `export const manifest = { id: "@test/bad" };`,
    );

    const results = await scanPluginPackages(tmpDir);
    expect(results).toHaveLength(0); // Invalid manifest is skipped with warning

    fs.rmSync(tmpDir, { recursive: true });
  });
});
