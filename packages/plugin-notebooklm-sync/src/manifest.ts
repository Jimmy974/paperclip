import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

export const manifest: PaperclipPluginManifestV1 = {
  id: "@paperclipai/plugin-notebooklm-sync",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "NotebookLM Sync Scheduler",
  description:
    "Schedules daily 9:00 AM sync of Paperclip codebase to NotebookLM via personal-assistant agent",
  categories: ["automation"],
  capabilities: [
    "agents.wakeup",
    "agents.read",
    "jobs.schedule",
    "plugin.state.write",
    "plugin.state.read",
  ],
  entrypoints: { worker: "./dist/worker.js" },
  jobs: [
    {
      id: "daily-sync",
      displayName: "Daily NotebookLM Sync",
      cron: "0 9 * * *",
    },
  ],
};
