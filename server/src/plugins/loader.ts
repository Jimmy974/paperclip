import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  plugins,
  pluginConfig,
  pluginJobs,
} from "@paperclipai/db";
import type { PaperclipPluginManifestV1 } from "@paperclipai/shared";
import { validateManifest, type ValidatedManifest } from "./types.js";

export interface ScannedPlugin {
  manifest: ValidatedManifest;
  installPath: string;
  workerEntrypoint: string;
}

/**
 * Scan the plugins directory for npm packages that have a `paperclipPlugin` key.
 * Validates each manifest and returns the valid ones.
 */
export async function scanPluginPackages(pluginsDir: string): Promise<ScannedPlugin[]> {
  const nodeModules = path.join(pluginsDir, "node_modules");
  if (!fs.existsSync(nodeModules)) return [];

  const results: ScannedPlugin[] = [];

  // Walk node_modules, including scoped packages (@scope/name)
  const entries = fs.readdirSync(nodeModules, { withFileTypes: true });
  const packageDirs: string[] = [];

  for (const entry of entries) {
    if (!(entry.isDirectory() || entry.isSymbolicLink())) continue;
    if (entry.name.startsWith(".")) continue;

    if (entry.name.startsWith("@")) {
      // Scoped package — look inside
      const scopeDir = path.join(nodeModules, entry.name);
      const scopeEntries = fs.readdirSync(scopeDir, { withFileTypes: true });
      for (const sub of scopeEntries) {
        if (sub.isDirectory() || sub.isSymbolicLink()) {
          packageDirs.push(path.join(scopeDir, sub.name));
        }
      }
    } else {
      packageDirs.push(path.join(nodeModules, entry.name));
    }
  }

  for (const pkgDir of packageDirs) {
    const pkgJsonPath = path.join(pkgDir, "package.json");
    if (!fs.existsSync(pkgJsonPath)) continue;

    let pkgJson: Record<string, unknown>;
    try {
      pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
    } catch {
      continue;
    }

    const pluginEntry = pkgJson.paperclipPlugin as Record<string, string> | undefined;
    if (!pluginEntry?.manifest) continue;

    // Load manifest module
    const manifestPath = path.resolve(pkgDir, pluginEntry.manifest);
    if (!fs.existsSync(manifestPath)) {
      console.warn(`[plugins] manifest file not found: ${manifestPath}`);
      continue;
    }

    try {
      const mod = await import(pathToFileURL(manifestPath).href);
      const rawManifest = mod.manifest ?? mod.default;

      const validation = validateManifest(rawManifest);
      if (!validation.success) {
        console.warn(
          `[plugins] invalid manifest for ${pkgJson.name}: ${validation.error.message}`,
        );
        continue;
      }

      const workerPath = pluginEntry.worker
        ? path.resolve(pkgDir, pluginEntry.worker)
        : path.resolve(pkgDir, validation.data.entrypoints.worker);

      results.push({
        manifest: validation.data,
        installPath: pkgDir,
        workerEntrypoint: workerPath,
      });
    } catch (err) {
      console.warn(`[plugins] failed to load manifest from ${manifestPath}:`, err);
    }
  }

  return results;
}

/**
 * Upsert a plugin record and sync its jobs/tools into the DB.
 */
export async function syncPluginToDb(
  db: Db,
  scanned: ScannedPlugin,
): Promise<string> {
  const { manifest, installPath } = scanned;

  // Upsert plugin record
  const existing = await db
    .select()
    .from(plugins)
    .where(eq(plugins.pluginKey, manifest.id))
    .limit(1);

  let pluginId: string;

  if (existing.length > 0) {
    pluginId = existing[0].id;
    await db
      .update(plugins)
      .set({
        version: manifest.version,
        manifestJson: manifest as unknown as PaperclipPluginManifestV1,
        packagePath: installPath,
        status: "installed",
        updatedAt: new Date(),
      })
      .where(eq(plugins.id, pluginId));
  } else {
    const [row] = await db
      .insert(plugins)
      .values({
        pluginKey: manifest.id,
        packageName: manifest.id,
        version: manifest.version,
        manifestJson: manifest as unknown as PaperclipPluginManifestV1,
        packagePath: installPath,
        status: "installed",
      })
      .returning({ id: plugins.id });
    pluginId = row.id;

    // Create initial config
    await db.insert(pluginConfig).values({
      pluginId,
      configJson: {},
    });
  }

  // Sync jobs: insert new, delete stale (preserve enabled state)
  if (manifest.jobs?.length) {
    const existingJobs = await db
      .select()
      .from(pluginJobs)
      .where(eq(pluginJobs.pluginId, pluginId));

    const existingByKey = new Map(existingJobs.map((j) => [j.jobKey, j]));
    const declaredKeys = new Set(manifest.jobs.map((j) => j.id));

    // Insert or update declared jobs
    for (const job of manifest.jobs) {
      const prev = existingByKey.get(job.id);
      if (prev) {
        await db
          .update(pluginJobs)
          .set({
            schedule: job.cron,
          })
          .where(eq(pluginJobs.id, prev.id));
      } else {
        await db.insert(pluginJobs).values({
          pluginId,
          jobKey: job.id,
          schedule: job.cron,
        });
      }
    }

    // Delete stale jobs
    for (const [key, job] of existingByKey) {
      if (!declaredKeys.has(key)) {
        await db.delete(pluginJobs).where(eq(pluginJobs.id, job.id));
      }
    }
  }

  return pluginId;
}
