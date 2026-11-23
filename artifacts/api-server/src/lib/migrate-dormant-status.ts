import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

/**
 * Convert legacy health statuses into the separate seasonal dormancy fields.
 *
 * The status predicate makes the migration idempotent: after the first run,
 * converted rows have a NULL status and are not selected again. This is one
 * atomic statement, so concurrent application starts cannot add duplicate
 * history entries. updated_at is deliberately not modified.
 */
export async function migrateDormantHealthStatus(): Promise<number> {
  const result = await db.execute(sql`
    WITH migrated_trees AS (
      UPDATE trees
      SET
        status = NULL,
        is_dormant = TRUE,
        dormant_since = updated_at::date::timestamptz
      WHERE status = 'Dormant'
      RETURNING id, updated_at
    ),
    inserted_history AS (
      INSERT INTO care_logs (tree_id, type, date)
      SELECT
        id,
        'Began dormancy',
        updated_at::date::text
      FROM migrated_trees
      RETURNING tree_id
    )
    SELECT COUNT(*)::int AS migrated_count
    FROM inserted_history
  `);

  const migrated = Number(result.rows[0]?.migrated_count ?? 0);
  logger.info(
    { migrated },
    "Legacy Dormant health statuses converted to seasonal dormancy",
  );
  return migrated;
}
