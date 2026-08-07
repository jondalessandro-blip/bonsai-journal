import { sql } from "drizzle-orm";
import { db, treesTable, treePhotosTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * Idempotent schema migration: add new columns if they don't exist yet.
 * ALTER TABLE … ADD COLUMN IF NOT EXISTS is a no-op when the column is present,
 * so this is safe to run on every startup.
 */
export async function migrateSchema(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE trees ADD COLUMN IF NOT EXISTS cover_thumb text;
  `);
  await db.execute(sql`
    ALTER TABLE tree_photos ADD COLUMN IF NOT EXISTS photo_thumb text;
  `);
  await db.execute(sql`
    ALTER TABLE trees ADD COLUMN IF NOT EXISTS status text;
  `);

  /**
   * Add insertion_seq — a bigint backed by a database sequence — as a
   * deterministic tiebreaker for photo ordering when both takenAt and createdAt
   * are identical (rapid uploads within the same DB clock tick).
   *
   * The DO block is idempotent: it checks whether the column already exists
   * before running the DDL, so repeated startups are safe.
   *
   * Migration steps:
   *   1. Add the column as nullable bigint.
   *   2. Create the backing sequence (IF NOT EXISTS).
   *   3. Backfill existing rows in createdAt order so the sequence reflects
   *      rough upload order for historical data, then set the sequence's
   *      current value above all backfilled values.
   *   4. Set the column default to nextval() and flip it to NOT NULL.
   */
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tree_photos'
          AND column_name = 'insertion_seq'
      ) THEN
        ALTER TABLE tree_photos ADD COLUMN insertion_seq bigint;

        CREATE SEQUENCE IF NOT EXISTS tree_photos_insertion_seq_seq;

        -- Backfill existing rows in creation order so historical photos
        -- retain their relative sequence (best-effort; exact values do not
        -- matter, only that the column is non-null before we add NOT NULL).
        UPDATE tree_photos t
        SET insertion_seq = subq.rn
        FROM (
          SELECT id,
                 ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
          FROM tree_photos
        ) subq
        WHERE t.id = subq.id;

        -- Advance the sequence past all backfilled values so future inserts
        -- receive strictly larger numbers.
        -- GREATEST(..., 1) guards against an empty table: setval() requires a
        -- value ≥ 1 (the sequence minimum).  is_called=false means the next
        -- nextval() call returns this exact value, which is correct because we
        -- want the next insert to get (max_backfilled + 1) or 1 on a fresh table.
        PERFORM setval(
          'tree_photos_insertion_seq_seq',
          GREATEST(COALESCE((SELECT MAX(insertion_seq) FROM tree_photos), 0) + 1, 1),
          false
        );

        ALTER TABLE tree_photos
          ALTER COLUMN insertion_seq SET DEFAULT nextval('tree_photos_insertion_seq_seq');

        ALTER TABLE tree_photos
          ALTER COLUMN insertion_seq SET NOT NULL;
      END IF;
    END $$;
  `);

  logger.info("Schema migration complete (cover_thumb, photo_thumb, status, insertion_seq columns ensured)");
}

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
