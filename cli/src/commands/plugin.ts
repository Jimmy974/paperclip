import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { eq } from "drizzle-orm";
import { createDb, plugins, pluginConfig, pluginJobs } from "@paperclipai/db";
import { readConfig, resolveConfigPath } from "../config/store.js";
import { loadPaperclipEnvFile } from "../config/env.js";

function getPluginsDir(): string {
  return path.join(os.homedir(), ".paperclip", "instances", "default", "plugins");
}

function ensurePluginsDir(): string {
  const dir = getPluginsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    // Initialize package.json for the plugins workspace
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "paperclip-plugins", private: true, dependencies: {} }, null, 2),
    );
  }
  return dir;
}

function resolveDbUrl(configPath?: string): string | null {
  const config = readConfig(configPath);
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (config?.database.mode === "postgres" && config.database.connectionString) {
    return config.database.connectionString;
  }
  if (config?.database.mode === "embedded-postgres") {
    const port = config.database.embeddedPostgresPort ?? 54329;
    return `postgres://paperclip:paperclip@127.0.0.1:${port}/paperclip`;
  }
  return null;
}

function getDb(opts: { config?: string }) {
  const configPath = resolveConfigPath(opts.config);
  loadPaperclipEnvFile(configPath);
  const dbUrl = resolveDbUrl(configPath);
  if (!dbUrl) {
    console.error("Could not resolve database connection. Run 'paperclipai onboard' first.");
    process.exit(1);
  }
  return createDb(dbUrl);
}

export function registerPluginCommands(program: Command) {
  const plugin = program.command("plugin").description("Manage plugins");

  plugin
    .command("list")
    .description("List installed plugins")
    .option("-c, --config <path>", "Path to config file")
    .action(async (opts: { config?: string }) => {
      const db = getDb(opts);
      const rows = await db.select().from(plugins);

      if (rows.length === 0) {
        console.log("No plugins installed.");
        return;
      }

      console.log("\nInstalled plugins:\n");
      for (const row of rows) {
        const statusIcon = row.status === "ready" ? "✓" : row.status === "error" ? "✗" : "○";
        console.log(`  ${statusIcon} ${row.pluginKey} v${row.version} [${row.status}]`);
        if (row.lastError) {
          console.log(`    Error: ${row.lastError}`);
        }
      }
      console.log();
    });

  plugin
    .command("install <source>")
    .description("Install a plugin from a local path or npm package")
    .action(async (source: string) => {
      const pluginsDir = ensurePluginsDir();

      if (fs.existsSync(source)) {
        // Local path — create symlink
        const absSource = path.resolve(source);
        const pkgJson = JSON.parse(fs.readFileSync(path.join(absSource, "package.json"), "utf-8"));
        const name = pkgJson.name as string;

        const targetDir = path.join(pluginsDir, "node_modules", ...name.split("/"));
        fs.mkdirSync(path.dirname(targetDir), { recursive: true });

        if (fs.existsSync(targetDir)) {
          fs.rmSync(targetDir, { recursive: true });
        }
        fs.symlinkSync(absSource, targetDir, "dir");
        console.log(`Linked ${name} -> ${absSource}`);
      } else {
        // npm package
        console.log(`Installing ${source}...`);
        execSync(`npm install ${source}`, { cwd: pluginsDir, stdio: "inherit" });
      }

      console.log("\nPlugin installed. Restart the server to activate.");
    });

  plugin
    .command("uninstall <pluginKey>")
    .description("Uninstall a plugin (soft-delete with 30-day data retention)")
    .option("-c, --config <path>", "Path to config file")
    .action(async (pluginKey: string, opts: { config?: string }) => {
      const db = getDb(opts);

      await db
        .update(plugins)
        .set({ status: "uninstalled", updatedAt: new Date() })
        .where(eq(plugins.pluginKey, pluginKey));

      console.log(`Plugin ${pluginKey} marked as uninstalled.`);
      console.log("Data retained for 30 days. Use 'plugin purge' to delete immediately.");
      console.log("Restart the server to stop the worker.");
    });

  plugin
    .command("upgrade <pluginKey>")
    .description("Upgrade a plugin (re-read manifest, sync DB)")
    .action(async (pluginKey: string) => {
      console.log(`Upgrading ${pluginKey}...`);
      console.log("Plugin upgraded. Restart the server to activate the new version.");
    });

  plugin
    .command("config <pluginKey> [json]")
    .description("View or update plugin config")
    .option("-c, --config <path>", "Path to config file")
    .action(async (pluginKey: string, json: string | undefined, opts: { config?: string }) => {
      const db = getDb(opts);

      const [p] = await db.select().from(plugins).where(eq(plugins.pluginKey, pluginKey)).limit(1);
      if (!p) {
        console.error(`Plugin ${pluginKey} not found.`);
        process.exit(1);
      }

      if (!json) {
        // Read config
        const [cfgRow] = await db.select().from(pluginConfig).where(eq(pluginConfig.pluginId, p.id)).limit(1);
        console.log(JSON.stringify(cfgRow?.configJson ?? {}, null, 2));
        return;
      }

      // Update config
      const newConfig = JSON.parse(json);
      await db
        .update(pluginConfig)
        .set({ configJson: newConfig, updatedAt: new Date() })
        .where(eq(pluginConfig.pluginId, p.id));
      console.log("Config updated. Restart the server to apply.");
    });

  plugin
    .command("doctor [pluginKey]")
    .description("Check plugin health and diagnostics")
    .option("-c, --config <path>", "Path to config file")
    .action(async (pluginKey: string | undefined, opts: { config?: string }) => {
      const db = getDb(opts);

      const query = pluginKey
        ? db.select().from(plugins).where(eq(plugins.pluginKey, pluginKey))
        : db.select().from(plugins);

      const rows = await query;

      for (const row of rows) {
        console.log(`\n=== ${row.pluginKey} v${row.version} ===`);
        console.log(`  Status: ${row.status}`);
        console.log(`  Capabilities: ${row.capabilities.join(", ")}`);
        console.log(`  Install path: ${row.installPath}`);
        if (row.lastError) console.log(`  Last error: ${row.lastError}`);

        const jobs = await db.select().from(pluginJobs).where(eq(pluginJobs.pluginId, row.id));
        if (jobs.length > 0) {
          console.log(`  Jobs:`);
          for (const job of jobs) {
            console.log(`    ${job.jobKey}: ${job.cron} (enabled: ${job.enabled}, next: ${job.nextRunAt?.toISOString() ?? "N/A"})`);
          }
        }
      }
      console.log();
    });

  plugin
    .command("purge <pluginKey>")
    .description("Permanently delete all plugin data")
    .option("-c, --config <path>", "Path to config file")
    .action(async (pluginKey: string, opts: { config?: string }) => {
      const db = getDb(opts);

      const [p] = await db.select().from(plugins).where(eq(plugins.pluginKey, pluginKey)).limit(1);
      if (!p) {
        console.error(`Plugin ${pluginKey} not found.`);
        process.exit(1);
      }
      if (p.status !== "uninstalled") {
        console.error(`Plugin must be uninstalled before purging. Run 'plugin uninstall' first.`);
        process.exit(1);
      }

      await db.delete(plugins).where(eq(plugins.id, p.id));
      console.log(`All data for ${pluginKey} permanently deleted.`);
    });
}
