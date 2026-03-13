import { createPluginWorker, type PluginContext } from "@paperclipai/plugin-sdk";

const PERSONAL_ASSISTANT_AGENT_ID = "50854dad-a621-488e-bca8-91c02f3e2758";

createPluginWorker({
  async initialize(ctx: PluginContext) {
    ctx.logger.info("NotebookLM Sync Scheduler initialized");
  },

  async health() {
    return { status: "ok" };
  },

  async shutdown() {
    // Nothing to clean up
  },

  jobs: {
    "daily-sync": async (ctx) => {
      ctx.logger.info("Triggering daily NotebookLM sync via personal-assistant agent");

      try {
        await ctx.agents.wakeup(PERSONAL_ASSISTANT_AGENT_ID, {
          reason: "scheduled_notebooklm_sync",
          payload: {
            task: "Run the /paperclip-notebooklm-sync skill to refresh the Paperclip codebase in NotebookLM. Follow all steps: gitingest, split, upload to Drive, delete old sources, add new sources.",
          },
          context: {
            triggeredBy: "plugin:notebooklm-sync",
            schedule: "daily 9:00 AM",
          },
        });

        await ctx.state.set("plugin", "last-sync-triggered", new Date().toISOString());
        ctx.logger.info("Successfully triggered personal-assistant for NotebookLM sync");
      } catch (err) {
        ctx.logger.error(`Failed to trigger sync: ${err instanceof Error ? err.message : String(err)}`);
        throw err;
      }
    },
  },
});
