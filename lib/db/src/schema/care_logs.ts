import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { treesTable } from "./trees";

export const careLogsTable = pgTable("care_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  treeId: uuid("tree_id")
    .notNull()
    .references(() => treesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  date: text("date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCareLogSchema = createInsertSchema(careLogsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertCareLog = z.infer<typeof insertCareLogSchema>;
export type CareLog = typeof careLogsTable.$inferSelect;
