import { pgTable, uuid, text, boolean, jsonb, unique, timestamp } from "drizzle-orm/pg-core";
import { plugins } from "./plugins.js";

export const pluginTools = pgTable(
  "plugin_tools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pluginId: uuid("plugin_id").notNull().references(() => plugins.id, { onDelete: "cascade" }),
    toolName: text("tool_name").notNull(),
    displayName: text("display_name").notNull(),
    description: text("description").notNull(),
    parametersSchema: jsonb("parameters_schema").$type<Record<string, unknown>>().notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pluginToolNameUniq: unique("plugin_tools_plugin_tool_name_uniq").on(table.pluginId, table.toolName),
  }),
);
