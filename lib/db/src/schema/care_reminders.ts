import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { treesTable } from "./trees";

export const careRemindersTable = pgTable("care_reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  treeId: uuid("tree_id")
    .notNull()
    .references(() => treesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  dueDate: text("due_date").notNull(),
  notes: text("notes"),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCareReminderSchema = createInsertSchema(careRemindersTable).omit({
  id: true,
  createdAt: true,
  completed: true,
});

export type InsertCareReminder = z.infer<typeof insertCareReminderSchema>;
export type CareReminder = typeof careRemindersTable.$inferSelect;
