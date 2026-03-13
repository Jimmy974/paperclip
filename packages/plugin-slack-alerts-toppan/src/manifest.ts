import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

export const manifest: PaperclipPluginManifestV1 = {
  id: "@paperclipai/plugin-slack-alerts-toppan",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Slack Alerts — Toppan Security",
  description:
    "Sends Slack notifications for Toppan Security: issue assignments, failed agent runs, and blocked tasks",
  categories: ["connector"],
  capabilities: [
    "events.subscribe",
    "issues.read",
    "plugin.state.read",
    "plugin.state.write",
    "routes.handle",
  ],
  entrypoints: { worker: "./dist/worker.js" },
  events: ["issue.created", "issue.updated", "agent.run.failed"],
};
