import { pgTable, uuid, text, timestamp, boolean, unique } from "drizzle-orm/pg-core";
import { plugins } from "./plugins.js";

export const pluginJobs = pgTable(
  "plugin_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pluginId: uuid("plugin_id").notNull().references(() => plugins.id, { onDelete: "cascade" }),
    jobKey: text("job_key").notNull(),
    displayName: text("display_name").notNull(),
    cron: text("cron").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pluginJobKeyUniq: unique("plugin_jobs_plugin_job_key_uniq").on(table.pluginId, table.jobKey),
  }),
);
