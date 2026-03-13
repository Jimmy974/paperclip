import { z } from "zod";
import { CronExpressionParser } from "cron-parser";

const cronString = z.string().refine(
  (val) => {
    try {
      CronExpressionParser.parse(val);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Invalid cron expression" },
);

export const manifestSchema = z.object({
  id: z.string().min(1),
  apiVersion: z.literal(1),
  version: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string(),
  categories: z.array(z.enum(["connector", "workspace", "automation", "ui"])),
  minimumPaperclipVersion: z.string().optional(),
  capabilities: z.array(z.string()),
  entrypoints: z.object({
    worker: z.string().min(1),
  }),
  instanceConfigSchema: z.record(z.unknown()).optional(),
  jobs: z
    .array(
      z.object({
        id: z.string().min(1),
        displayName: z.string().min(1),
        cron: cronString,
      }),
    )
    .optional(),
  events: z.array(z.string()).optional(),
  tools: z
    .array(
      z.object({
        name: z.string().min(1),
        displayName: z.string().min(1),
        description: z.string(),
        parametersSchema: z.record(z.unknown()),
      }),
    )
    .optional(),
});

export type ValidatedManifest = z.infer<typeof manifestSchema>;

export function validateManifest(data: unknown): z.SafeParseReturnType<unknown, ValidatedManifest> {
  return manifestSchema.safeParse(data);
}

/** Per-method RPC timeouts in milliseconds */
export const RPC_TIMEOUTS: Record<string, number> = {
  initialize: 30_000,
  health: 5_000,
  shutdown: 10_000,
  runJob: 300_000,
  onEvent: 30_000,
  handleRequest: 30_000,
  executeTool: 60_000,
  configChanged: 10_000,
};

/** All known capabilities for validation/documentation */
export const KNOWN_CAPABILITIES = [
  "issues.create",
  "issues.read",
  "issues.update",
  "issue.comments.create",
  "agents.read",
  "agents.wakeup",
  "events.subscribe",
  "events.emit",
  "jobs.schedule",
  "routes.handle",
  "agent.tools.register",
  "plugin.state.read",
  "plugin.state.write",
] as const;

/** Capability required for each SDK method */
export const METHOD_CAPABILITIES: Record<string, string | null> = {
  "issues.create": "issues.create",
  "issues.read": "issues.read",
  "issues.update": "issues.update",
  "issues.list": "issues.read",
  "issues.addComment": "issue.comments.create",
  "agents.list": "agents.read",
  "agents.read": "agents.read",
  "agents.wakeup": "agents.wakeup",
  "events.emit": "events.emit",
  "state.get": "plugin.state.read",
  "state.set": "plugin.state.write",
  "state.delete": "plugin.state.write",
  "config.get": null,        // always allowed
  "logger.debug": null,
  "logger.info": null,
  "logger.warn": null,
  "logger.error": null,
};
