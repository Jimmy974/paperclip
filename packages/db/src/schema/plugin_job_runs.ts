import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { plugins } from "./plugins.js";
import { pluginJobs } from "./plugin_jobs.js";

export const pluginJobRuns = pgTable(
  "plugin_job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id").notNull().references(() => pluginJobs.id, { onDelete: "cascade" }),
    pluginId: uuid("plugin_id").notNull().references(() => plugins.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    error: text("error"),
    result: jsonb("result").$type<unknown>(),
  },
  (table) => ({
    pluginStartedIdx: index("plugin_job_runs_plugin_started_idx").on(table.pluginId, table.startedAt),
    jobStartedIdx: index("plugin_job_runs_job_started_idx").on(table.jobId, table.startedAt),
  }),
);
