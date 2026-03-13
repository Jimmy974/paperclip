import { pgTable, uuid, text, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { plugins } from "./plugins.js";

export const pluginState = pgTable(
  "plugin_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pluginId: uuid("plugin_id").notNull().references(() => plugins.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    value: jsonb("value").$type<unknown>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pluginScopeKeyUniq: unique("plugin_state_plugin_scope_key_uniq").on(table.pluginId, table.scope, table.key),
  }),
);
