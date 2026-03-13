import { Router, type Request, type Response } from "express";
import type { Db } from "@paperclipai/db";
import { plugins } from "@paperclipai/db";
import { eq } from "drizzle-orm";
import type { ProcessManager } from "./process-manager.js";

/**
 * Create Express router for plugin HTTP routes.
 * Mounted at /api/plugins/...
 * Forwards requests to plugin workers via handleRequest RPC.
 *
 * Supports both scoped (@scope/name) and unscoped plugin keys, plus DB UUIDs.
 */
export function pluginRoutes(db: Db, processManager: ProcessManager): Router {
  const router = Router();

  // Cache plugin_key → UUID mapping to avoid repeated DB lookups
  const keyToId = new Map<string, string>();

  async function resolvePluginId(idOrKey: string): Promise<string | null> {
    // If process manager recognises it directly (UUID), use it
    if (processManager.isReady(idOrKey)) return idOrKey;

    // Check cache
    const cached = keyToId.get(idOrKey);
    if (cached && processManager.isReady(cached)) return cached;

    // Look up by plugin_key in DB
    const [row] = await db
      .select({ id: plugins.id })
      .from(plugins)
      .where(eq(plugins.pluginKey, idOrKey))
      .limit(1);

    if (row) {
      keyToId.set(idOrKey, row.id);
      return row.id;
    }

    return null;
  }

  async function handlePluginRoute(
    pluginKey: string,
    subPath: string,
    req: Request,
    res: Response,
  ) {
    const pluginId = await resolvePluginId(pluginKey);
    if (!pluginId || !processManager.isReady(pluginId)) {
      res.status(503).json({ error: `Plugin ${pluginKey} is not available` });
      return;
    }

    try {
      const result = await processManager.call(pluginId, "handleRequest", {
        method: req.method,
        path: subPath,
        headers: req.headers as Record<string, string>,
        query: req.query as Record<string, string>,
        body: req.body,
        params: {},
        auth: {
          userId: (req as any).actor?.userId,
          agentId: (req as any).actor?.agentId,
          actorType: (req as any).actor?.type ?? "system",
        },
      });

      const response = result as { status: number; headers?: Record<string, string>; body: unknown };
      if (response.headers) {
        for (const [key, value] of Object.entries(response.headers)) {
          res.setHeader(key, value);
        }
      }
      res.status(response.status ?? 200).json(response.body);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Internal plugin error",
      });
    }
  }

  // Scoped packages: /api/plugins/@scope/name/subpath
  router.all("/@:scope/:name/{*path}", async (req: Request, res: Response) => {
    const pluginKey = `@${req.params.scope}/${req.params.name}`;
    const subPath = "/" + String(req.params.path ?? "");
    await handlePluginRoute(pluginKey, subPath, req, res);
  });

  // Unscoped packages and UUIDs: /api/plugins/pluginId/subpath
  router.all("/:pluginId/{*path}", async (req: Request, res: Response) => {
    const pluginKey = String(req.params.pluginId);
    const subPath = "/" + String(req.params.path ?? "");
    await handlePluginRoute(pluginKey, subPath, req, res);
  });

  return router;
}
