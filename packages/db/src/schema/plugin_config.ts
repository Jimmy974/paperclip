import { pgTable, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { plugins } from "./plugins.js";

export const pluginConfig = pgTable("plugin_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  pluginId: uuid("plugin_id").unique().notNull().references(() => plugins.id, { onDelete: "cascade" }),
  configJson: jsonb("config_json").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
