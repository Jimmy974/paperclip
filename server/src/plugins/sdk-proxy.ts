import type { Db } from "@paperclipai/db";
import { eq, and } from "drizzle-orm";
import {
  plugins,
  pluginConfig,
  pluginState,
} from "@paperclipai/db";
import { METHOD_CAPABILITIES } from "./types.js";

/**
 * Check if a method is allowed by the plugin's capabilities.
 */
export function checkCapability(method: string, capabilities: string[]): boolean {
  const required = METHOD_CAPABILITIES[method];
  if (required === null || required === undefined) {
    // null = always allowed (config.get, logger.*), undefined = unknown method
    return required === null;
  }
  return capabilities.includes(required);
}

/**
 * Create an SDK proxy that handles worker->host RPC calls.
 * Returns a request handler function to pass to ProcessManager.setRequestHandler().
 */
export function createSdkProxy(db: Db) {
  // Import services lazily to avoid circular deps (ESM dynamic import)
  let servicesPromise: Promise<{
    issues: ReturnType<typeof import("../services/issues.js")["issueService"]>;
    agents: ReturnType<typeof import("../services/agents.js")["agentService"]>;
    heartbeat: ReturnType<typeof import("../services/heartbeat.js")["heartbeatService"]>;
  }> | null = null;

  const getServices = () => {
    if (!servicesPromise) {
      servicesPromise = Promise.all([
        import("../services/issues.js"),
        import("../services/agents.js"),
        import("../services/heartbeat.js"),
      ]).then(([issuesMod, agentsMod, heartbeatMod]) => ({
        issues: issuesMod.issueService(db),
        agents: agentsMod.agentService(db),
        heartbeat: heartbeatMod.heartbeatService(db),
      }));
    }
    return servicesPromise;
  };

  return async function handleSdkCall(
    pluginId: string,
    method: string,
    params: unknown,
    _id: number | string,
  ): Promise<unknown> {
    // Get plugin capabilities
    const [plugin] = await db
      .select({ capabilities: plugins.capabilities })
      .from(plugins)
      .where(eq(plugins.id, pluginId))
      .limit(1);

    if (!plugin) throw new Error(`Plugin ${pluginId} not found`);

    // Check capability
    if (!checkCapability(method, plugin.capabilities)) {
      throw Object.assign(
        new Error(`capability '${METHOD_CAPABILITIES[method]}' not granted`),
        { code: -32600 },
      );
    }

    const p = (params ?? {}) as Record<string, unknown>;

    // Logger methods — just log and return
    if (method.startsWith("logger.")) {
      const level = method.split(".")[1] as string;
      console.log(`[plugin:${pluginId}:${level}] ${p.message}`, p.data ?? {});
      return { ok: true };
    }

    // Config.get — return plugin config
    if (method === "config.get") {
      const [cfg] = await db
        .select({ configJson: pluginConfig.configJson })
        .from(pluginConfig)
        .where(eq(pluginConfig.pluginId, pluginId))
        .limit(1);
      return cfg?.configJson ?? {};
    }

    // State methods
    if (method === "state.get") {
      const rows = await db
        .select({ value: pluginState.value })
        .from(pluginState)
        .where(
          and(
            eq(pluginState.pluginId, pluginId),
            eq(pluginState.scope, p.scope as string),
            eq(pluginState.key, p.key as string),
          ),
        )
        .limit(1);
      return rows[0]?.value ?? null;
    }

    if (method === "state.set") {
      const scope = p.scope as string;
      const key = p.key as string;
      const value = p.value;
      await db.insert(pluginState).values({
        pluginId,
        scope,
        key,
        value: value as any,
      }).onConflictDoUpdate({
        target: [pluginState.pluginId, pluginState.scope, pluginState.key],
        set: { value: value as any, updatedAt: new Date() },
      });
      return { ok: true };
    }

    if (method === "state.delete") {
      await db.delete(pluginState).where(
        and(
          eq(pluginState.pluginId, pluginId),
          eq(pluginState.scope, p.scope as string),
          eq(pluginState.key, p.key as string),
        ),
      );
      return { ok: true };
    }

    // Service methods — route to real Paperclip services
    const services = await getServices();

    switch (method) {
      case "issues.create":
        return services.issues.create(p.companyId as string, p as any);
      case "issues.read":
        return services.issues.getById(p.issueId as string);
      case "issues.update":
        return services.issues.update(p.issueId as string, p as any);
      case "issues.list":
        return services.issues.list(p.companyId as string, p as any);
      case "issues.addComment":
        return services.issues.addComment(p.issueId as string, p.body as string, {
          agentId: p.agentId as string | undefined,
          userId: p.userId as string | undefined,
        });
      case "agents.list":
        return services.agents.list(p.companyId as string);
      case "agents.read":
        return services.agents.getById(p.agentId as string);
      case "agents.wakeup":
        return services.heartbeat.wakeup(p.agentId as string, {
          reason: (p.reason as string) ?? "plugin",
          source: "automation",
          triggerDetail: "system",
          contextSnapshot: p.payload as Record<string, unknown>,
        });
      case "events.emit": {
        // Plugin events use plugin.* namespace — wire through event bus
        // event-bus.js is created in Task 9; dynamic import defers resolution
        // @ts-ignore — event-bus.js does not exist yet (Task 9)
        const { getEventBus } = await import("./event-bus.js");
        const eventName = `plugin.${pluginId}.${p.name}`;
        await getEventBus().emit(eventName, p.payload as Record<string, unknown>);
        return { ok: true };
      }
      default:
        throw new Error(`unknown SDK method: ${method}`);
    }
  };
}
