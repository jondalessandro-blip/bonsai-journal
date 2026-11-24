import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

/**
 * Convert legacy health statuses into the separate seasonal dormancy fields.
 *
 * The status predicate makes the migration idempotent: converted rows no
 * longer have the legacy "Dormant" status. The update and history insert are
 * one atomic statement, so concurrent application starts cannot add duplicate
 * migration entries. updated_at is deliberately not modified.
 *
 * A user scope is available to the real-database integration test so it only
 * mutates its isolated fixtures; startup calls this without a scope.
 */
export async function migrateDormantHealthStatus(
  testScope?: { userId: string },
): Promise<number> {
  const userFilter = testScope
    ? sql`AND t.user_id = ${testScope.userId}`
    : sql.empty();

  const result = await db.execute(sql`
    WITH legacy_dormant AS (
      SELECT
        t.id,
        COALESCE(status_history.previous_status, 'Healthy') AS restored_status,
        COALESCE(
          status_history.date::date::timestamptz,
          t.updated_at::date::timestamptz
        ) AS dormant_since
      FROM trees t
      LEFT JOIN LATERAL (
        SELECT
          split_part(cl.notes, ' → ', 1) AS previous_status,
          cl.date
        FROM care_logs cl
        WHERE cl.tree_id = t.id
          AND cl.type = 'Status Change'
          AND cl.notes LIKE '% → Dormant'
          AND length(split_part(cl.notes, ' → ', 1)) > 0
        ORDER BY cl.created_at DESC, cl.date DESC, cl.id DESC
        LIMIT 1
      ) status_history ON TRUE
      WHERE t.status = 'Dormant'
      ${userFilter}
    ),
    migrated_trees AS (
      UPDATE trees t
      SET
        status = legacy_dormant.restored_status,
        is_dormant = TRUE,
        dormant_since = legacy_dormant.dormant_since
      FROM legacy_dormant
      WHERE t.id = legacy_dormant.id
        AND t.status = 'Dormant'
      RETURNING t.id, t.dormant_since
    ),
    inserted_history AS (
      INSERT INTO care_logs (tree_id, type, date)
      SELECT
        id,
        'Began dormancy',
        dormant_since::date::text
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
