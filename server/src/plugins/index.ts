import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import type { Db } from "@paperclipai/db";
import { eq } from "drizzle-orm";
import { pluginConfig } from "@paperclipai/db";
import { scanPluginPackages, syncPluginToDb } from "./loader.js";
import { ProcessManager } from "./process-manager.js";
import { createPluginHandlers } from "./sdk-proxy.js";
import { EventBus, getEventBus } from "./event-bus.js";
import { JobScheduler } from "./job-scheduler.js";
import { pluginRoutes } from "./routes.js";
import type { Router } from "express";

export interface PluginSystem {
  processManager: ProcessManager;
  eventBus: EventBus;
  jobScheduler: JobScheduler;
  router: Router;
  shutdown: () => Promise<void>;
}

/**
 * Initialize the plugin system. Called from server startup.
 */
export async function initPluginSystem(db: Db): Promise<PluginSystem> {
  const pluginsDir = path.join(
    os.homedir(),
    ".paperclip",
    "instances",
    "default",
    "plugins",
  );

  const processManager = new ProcessManager();
  const eventBus = getEventBus();
  const jobScheduler = new JobScheduler(db, processManager);

  // Wire event delivery to process manager using new SDK protocol format
  eventBus.setDeliveryCallback(async (pluginId, eventName, payload, timestamp) => {
    await processManager.call(pluginId, "onEvent", {
      event: {
        eventId: randomUUID(),
        eventType: eventName,
        occurredAt: timestamp,
        companyId: (payload.companyId as string) ?? "",
        actorId: payload.actorId as string | undefined,
        actorType: payload.actorType as "user" | "agent" | "system" | "plugin" | undefined,
        entityId: (payload.issueId ?? payload.entityId) as string | undefined,
        entityType: payload.entityType as string | undefined,
        payload,
      },
    });
  });

  // Scan and load plugins
  const scannedPlugins = await scanPluginPackages(pluginsDir);
  console.log(`[plugins] found ${scannedPlugins.length} plugin(s)`);

  for (const scanned of scannedPlugins) {
    try {
      const pluginId = await syncPluginToDb(db, scanned);

      // Register event subscriptions
      if (scanned.manifest.events?.length) {
        eventBus.registerSubscriptions(pluginId, scanned.manifest.events);
      }

      // Get config for the plugin
      const [cfgRow] = await db
        .select({ configJson: pluginConfig.configJson })
        .from(pluginConfig)
        .where(eq(pluginConfig.pluginId, pluginId))
        .limit(1);

      // Create capability-gated handlers for this plugin
      const capabilities = (scanned.manifest.capabilities ?? []) as string[];
      const handlers = createPluginHandlers(db, pluginId, capabilities);

      await processManager.spawn(
        pluginId,
        scanned.workerEntrypoint,
        {
          pluginId,
          manifest: scanned.manifest as unknown as Record<string, unknown>,
          config: cfgRow?.configJson ?? {},
        },
        handlers,
      );

      console.log(`[plugins] loaded ${scanned.manifest.id} (${pluginId})`);
    } catch (err) {
      console.error(
        `[plugins] failed to load ${scanned.manifest.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Initialize job times
  await jobScheduler.initializeJobTimes();

  // Create Express router
  const router = pluginRoutes(db, processManager);

  return {
    processManager,
    eventBus,
    jobScheduler,
    router,
    shutdown: async () => {
      await processManager.shutdownAll();
    },
  };
}
