import { definePlugin, type PluginContext } from "@paperclipai/plugin-sdk";
import { DEFAULT_TEMPLATE_ENTRIES, type TemplateEntry } from "./constants.js";

type TemplateConfig = {
  entries?: TemplateEntry[];
};

async function getEntries(ctx: PluginContext): Promise<TemplateEntry[]> {
  const config = (await ctx.config.get()) as TemplateConfig | null;
  return config?.entries ?? DEFAULT_TEMPLATE_ENTRIES;
}

const plugin = definePlugin({
  async setup(ctx) {
    ctx.data.register("templates", async () => {
      return await getEntries(ctx);
    });

    ctx.actions.register("apply-template", async (params) => {
      const { issueId, companyId, templateKey } = params as {
        issueId: string;
        companyId: string;
        templateKey: string;
      };

      if (!issueId || !companyId || !templateKey) {
        throw new Error("issueId, companyId, and templateKey are required");
      }

      const entries = await getEntries(ctx);
      const entry = entries.find((e) => e.key === templateKey);
      if (!entry) {
        throw new Error(`Unknown template key: ${templateKey}`);
      }

      await ctx.issues.update(issueId, { description: entry.template }, companyId);
      return { success: true, label: entry.label };
    });
  },

  async onHealth() {
    return { status: "ok", message: "Issue Templates Plugin running" };
  },

  async onValidateConfig(config) {
    const cfg = config as TemplateConfig | null;
    if (cfg?.entries) {
      if (!Array.isArray(cfg.entries)) {
        return { valid: false, message: "entries must be an array" };
      }
      const keys = new Set<string>();
      for (const entry of cfg.entries) {
        if (!entry.key || typeof entry.key !== "string") {
          return { valid: false, message: "Each entry must have a string key" };
        }
        if (!entry.label || typeof entry.label !== "string") {
          return { valid: false, message: `Entry "${entry.key}" must have a label` };
        }
        if (typeof entry.template !== "string") {
          return { valid: false, message: `Entry "${entry.key}" must have a template string` };
        }
        if (keys.has(entry.key)) {
          return { valid: false, message: `Duplicate key: "${entry.key}"` };
        }
        keys.add(entry.key);
      }
    }
    return { valid: true };
  },

  async onConfigChanged(_config) {
    // No-op: UI re-fetches templates on next render
  },
});

export default plugin;

import { runWorker } from "@paperclipai/plugin-sdk";
runWorker(plugin, import.meta.url);
