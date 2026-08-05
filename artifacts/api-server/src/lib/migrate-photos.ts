import { sql } from "drizzle-orm";
import { db, treesTable, treePhotosTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * Idempotent migration: for every tree that has a legacy photoUrl but no
 * progression photo yet, insert one row into tree_photos using the tree's
 * creation date as the initial taken_at date.
 *
 * Race-safe: the unique index on (tree_id, photo_url) turns concurrent
 * duplicate inserts into no-ops at the DB level.
 */
export async function migrateExistingPhotos(): Promise<void> {
  // Single INSERT … ON CONFLICT DO NOTHING — atomic and race-safe
  const result = await db.execute(sql`
    INSERT INTO tree_photos (id, tree_id, photo_url, taken_at, created_at)
    SELECT
      gen_random_uuid(),
      t.id,
      t.photo_url,
      t.created_at::date::text,
      NOW()
    FROM trees t
    WHERE
      t.photo_url IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM tree_photos tp WHERE tp.tree_id = t.id
      )
    ON CONFLICT (tree_id, photo_url) DO NOTHING
  `);

  const migrated = (result as unknown as { rowCount?: number }).rowCount ?? 0;
  if (migrated > 0) {
    logger.info({ migrated }, "Migrated legacy tree photos into progression gallery");
  }
}
