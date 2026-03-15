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
  executeTool: 60_000,
  configChanged: 10_000,
};
