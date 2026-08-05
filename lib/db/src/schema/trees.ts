import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const treesTable = pgTable("trees", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  species: text("species"),
  acquiredDate: text("acquired_date"),
  climate: text("climate"),
  foliage: text("foliage"),
  style: text("style"),
  tags: text("tags").array().notNull().default([]),
  notes: text("notes"),
  photoUrl: text("photo_url"),
  coverThumb: text("cover_thumb"),
  stage: text("stage"),
  status: text("status"),
  coverPosition: jsonb("cover_position").$type<{ x: number; y: number; zoom: number }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTreeSchema = createInsertSchema(treesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTree = z.infer<typeof insertTreeSchema>;
export type Tree = typeof treesTable.$inferSelect;
