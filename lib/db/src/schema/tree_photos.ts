import { bigserial, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { treesTable } from "./trees";

export const treePhotosTable = pgTable(
  "tree_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    treeId: uuid("tree_id")
      .notNull()
      .references(() => treesTable.id, { onDelete: "cascade" }),
    photoUrl: text("photo_url").notNull(),
    photoThumb: text("photo_thumb"),
    takenAt: text("taken_at").notNull(), // "YYYY-MM-DD"
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /**
     * Monotonically-increasing sequence assigned by the DB at insert time.
     * Acts as a deterministic tiebreaker when takenAt and createdAt are identical
     * (e.g. rapid uploads within the same DB clock tick). Always lower for
     * earlier inserts regardless of timestamp precision.
     */
    insertionSeq: bigserial("insertion_seq", { mode: "number" }).notNull(),
  },
  (t) => [
    // Prevents duplicate migration inserts and duplicate user uploads of the same image
    uniqueIndex("tree_photos_tree_id_photo_url_idx").on(t.treeId, t.photoUrl),
  ],
);

export type TreePhoto = typeof treePhotosTable.$inferSelect;
