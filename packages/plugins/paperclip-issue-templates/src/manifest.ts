import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "ktsang.issue-templates",
  apiVersion: 1,
  version: "4.0.0",
  displayName: "Issue Templates",
  description:
    "Apply markdown templates to issues from the issue toolbar. Supports custom types.",
  author: "ktsang",
  categories: ["ui"],

  capabilities: [
    "issues.read",
    "issues.update",
    "ui.action.register",
    "instance.settings.register",
  ],

  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },

  instanceConfigSchema: {
    type: "object",
    properties: {
      entries: {
        type: "array",
        title: "Template Entries",
        description: "Ordered list of issue types with labels and markdown templates.",
        items: {
          type: "object",
          properties: {
            key: { type: "string", title: "Key" },
            label: { type: "string", title: "Label" },
            template: { type: "string", title: "Template" },
          },
          required: ["key", "label", "template"],
        },
      },
    },
  },

  ui: {
    slots: [
      {
        type: "toolbarButton",
        id: "issue-template-toolbar",
        displayName: "Apply Template",
        exportName: "IssueTemplateToolbar",
        entityTypes: ["issue"],
      },
      {
        type: "settingsPage",
        id: "issue-templates-settings",
        displayName: "Issue Templates Settings",
        exportName: "SettingsPage",
      },
    ],
  },
};

export default manifest;
