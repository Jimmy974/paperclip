import type { Db } from "@paperclipai/db";
import { eq, and } from "drizzle-orm";
import {
  plugins,
  pluginConfig,
  pluginState,
} from "@paperclipai/db";
import {
  createHostClientHandlers,
  type HostServices,
  type HostClientHandlers,
} from "@paperclipai/plugin-sdk";
import type { PluginCapability, PluginStateScopeKind } from "@paperclipai/shared";

/**
 * Build a HostServices implementation backed by the Paperclip DB and services.
 */
function buildHostServices(db: Db, pluginId: string): HostServices {
  // Lazy service imports to avoid circular deps
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

  function notImplemented(method: string): () => never {
    return () => { throw new Error(`Plugin host service not implemented: ${method}`); };
  }

  return {
    config: {
      async get() {
        const [cfg] = await db
          .select({ configJson: pluginConfig.configJson })
          .from(pluginConfig)
          .where(eq(pluginConfig.pluginId, pluginId))
          .limit(1);
        return cfg?.configJson ?? {};
      },
    },

    state: {
      async get(params) {
        const scopeKind = params.scopeKind as PluginStateScopeKind;
        const conditions = [
          eq(pluginState.pluginId, pluginId),
          eq(pluginState.scopeKind, scopeKind),
          eq(pluginState.stateKey, params.stateKey),
        ];
        if (params.scopeId !== undefined && params.scopeId !== null) {
          conditions.push(eq(pluginState.scopeId, params.scopeId));
        }
        if (params.namespace) {
          conditions.push(eq(pluginState.namespace, params.namespace));
        }
        const [row] = await db
          .select({ valueJson: pluginState.valueJson })
          .from(pluginState)
          .where(and(...conditions))
          .limit(1);
        return row?.valueJson ?? null;
      },

      async set(params) {
        const scopeKind = params.scopeKind as PluginStateScopeKind;
        const scopeId = params.scopeId ?? null;
        const namespace = params.namespace ?? "default";
        // Try upsert via insert + on-conflict fallback
        await db.insert(pluginState).values({
          pluginId,
          scopeKind,
          scopeId,
          namespace,
          stateKey: params.stateKey,
          valueJson: params.value as any,
        }).catch(async () => {
          // Insert failed (unique conflict) — update by lookup
          const conditions = [
            eq(pluginState.pluginId, pluginId),
            eq(pluginState.scopeKind, scopeKind),
            eq(pluginState.stateKey, params.stateKey),
          ];
          await db.update(pluginState)
            .set({ valueJson: params.value as any, updatedAt: new Date() })
            .where(and(...conditions));
        });
      },

      async delete(params) {
        const scopeKind = params.scopeKind as PluginStateScopeKind;
        const conditions = [
          eq(pluginState.pluginId, pluginId),
          eq(pluginState.scopeKind, scopeKind),
          eq(pluginState.stateKey, params.stateKey),
        ];
        if (params.scopeId !== undefined && params.scopeId !== null) {
          conditions.push(eq(pluginState.scopeId, params.scopeId));
        }
        await db.delete(pluginState).where(and(...conditions));
      },
    },

    entities: {
      async upsert(_params) {
        throw new Error("Plugin host service not implemented: entities.upsert");
      },
      async list(_params) {
        throw new Error("Plugin host service not implemented: entities.list");
      },
    },

    events: {
      async emit(params) {
        // Import event bus dynamically to avoid circular deps
        const { getEventBus } = await import("./event-bus.js");
        const eventName = `plugin.${pluginId}.${params.name}`;
        await getEventBus().emit(eventName, params.payload as Record<string, unknown>);
      },
    },

    http: {
      async fetch(params) {
        const res = await fetch(params.url, {
          method: (params.init?.method as string) ?? "GET",
          headers: params.init?.headers as HeadersInit | undefined,
          body: params.init?.body as BodyInit | undefined,
        });
        const body = await res.text();
        const headers: Record<string, string> = {};
        res.headers.forEach((v, k) => { headers[k] = v; });
        return { status: res.status, statusText: res.statusText, headers, body };
      },
    },

    secrets: {
      async resolve(_params) {
        throw new Error("Plugin host service not implemented: secrets.resolve");
      },
    },

    activity: {
      async log(_params) {
        // Silently no-op for now
      },
    },

    metrics: {
      async write(_params) {
        // Silently no-op for now
      },
    },

    logger: {
      async log(params) {
        console.log(`[plugin:${pluginId}:${params.level}] ${params.message}`, params.meta ?? {});
      },
    },

    companies: {
      async list(_params) { return []; },
      async get(_params) { return null; },
    },

    projects: {
      async list(_params) { return []; },
      async get(_params) { return null; },
      async listWorkspaces(_params) { return []; },
      async getPrimaryWorkspace(_params) { return null; },
      async getWorkspaceForIssue(_params) { return null; },
    },

    issues: {
      async list(params) {
        const svc = await getServices();
        return svc.issues.list(params.companyId, params as any) as any;
      },
      async get(params) {
        const svc = await getServices();
        return svc.issues.getById(params.issueId) as any;
      },
      async create(params) {
        const svc = await getServices();
        return svc.issues.create(params.companyId, params as any) as any;
      },
      async update(params) {
        const svc = await getServices();
        return svc.issues.update(params.issueId, params.patch as any) as any;
      },
      async listComments(_params) { return []; },
      async createComment(params) {
        const svc = await getServices();
        return svc.issues.addComment(params.issueId, params.body, {}) as any;
      },
    },

    agents: {
      async list(params) {
        const svc = await getServices();
        return svc.agents.list(params.companyId) as any;
      },
      async get(params) {
        const svc = await getServices();
        return svc.agents.getById(params.agentId) as any;
      },
      async pause(_params) {
        throw new Error("Plugin host service not implemented: agents.pause");
      },
      async resume(_params) {
        throw new Error("Plugin host service not implemented: agents.resume");
      },
      async invoke(params) {
        const svc = await getServices();
        return svc.heartbeat.wakeup(params.agentId, {
          reason: params.reason ?? "plugin",
          source: "automation",
          triggerDetail: "system",
          contextSnapshot: {},
        }) as any;
      },
    },

    agentSessions: {
      async create(_params) {
        throw new Error("Plugin host service not implemented: agentSessions.create");
      },
      async list(_params) { return []; },
      async sendMessage(_params) {
        throw new Error("Plugin host service not implemented: agentSessions.sendMessage");
      },
      async close(_params) {
        // no-op
      },
    },

    goals: {
      async list(_params) { return []; },
      async get(_params) { return null; },
      async create(_params) {
        throw new Error("Plugin host service not implemented: goals.create");
      },
      async update(_params) {
        throw new Error("Plugin host service not implemented: goals.update");
      },
    },
  };
}

/**
 * Create capability-gated host client handlers for a plugin.
 * Pass the returned handlers to ProcessManager.spawn().
 */
export function createPluginHandlers(
  db: Db,
  pluginId: string,
  capabilities: string[],
): HostClientHandlers {
  const services = buildHostServices(db, pluginId);
  return createHostClientHandlers({
    pluginId,
    capabilities: capabilities as PluginCapability[],
    services,
  });
}
