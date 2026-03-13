import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const plugins = pgTable("plugins", {
  id: uuid("id").primaryKey().defaultRandom(),
  pluginKey: text("plugin_key").unique().notNull(),
  displayName: text("display_name").notNull(),
  version: text("version").notNull(),
  status: text("status").notNull().default("installed"),
  capabilities: text("capabilities").array().notNull().default([]),
  manifest: jsonb("manifest").$type<Record<string, unknown>>().notNull(),
  installPath: text("install_path").notNull(),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
