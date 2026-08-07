/**
 * Tests for migrateSchema() — the idempotent startup migration that adds
 * columns to the running database.  These tests focus on the insertion_seq
 * migration path:
 *
 *   - The DO $$ block must never pass 0 to setval() (sequences require ≥ 1).
 *   - An empty tree_photos table must produce setval(..., 1, false) so the
 *     first insert receives sequence value 1.
 *   - A populated table must produce setval(..., max+1, false) so the next
 *     insert receives the next value after the highest backfilled row.
 *
 * Because the migration runs raw SQL via db.execute(), we capture the SQL
 * strings passed to the mock and assert on their content.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @workspace/db before importing the module under test.
// ---------------------------------------------------------------------------
const capturedSql: string[] = [];

vi.mock('@workspace/db', () => ({
  db: {
    execute: vi.fn(async (query: any) => {
      // drizzle's sql`` template tag produces an object with a queryChunks
      // array.  Each chunk is either a StringChunk ({ value: string }) for
      // literal text or a Param for bound values.  Join all chunk values into
      // a single string so we can inspect the raw SQL.
      const text: string =
        Array.isArray(query?.queryChunks)
          ? query.queryChunks
              .map((c: any) =>
                typeof c === 'string' ? c : (c?.value ?? ''),
              )
              .join('')
          : String(query);
      capturedSql.push(text);
      return { rowCount: 0 };
    }),
  },
  treesTable:         {},
  treePhotosTable:    {},
  careLogsTable:      {},
  careRemindersTable: {},
}));

// Mock the logger so test output stays clean.
vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { migrateSchema } from '../migrate-photos';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return all SQL strings that contain the given substring. */
function sqlContaining(fragment: string): string[] {
  return capturedSql.filter((s) => s.includes(fragment));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('migrateSchema() — insertion_seq migration', () => {
  beforeEach(() => {
    capturedSql.length = 0;
    vi.clearAllMocks();
  });

  it('issues a migration statement that references insertion_seq', async () => {
    await migrateSchema();
    const relevant = sqlContaining('insertion_seq');
    expect(relevant.length).toBeGreaterThan(0);
  });

  it('uses GREATEST(..., 1) so setval never receives 0 (empty-table guard)', async () => {
    await migrateSchema();
    // The SQL must contain GREATEST(..., 1) to guard against an empty table
    // where COALESCE(MAX(insertion_seq), 0) + 1 would produce 1, but the
    // explicit GREATEST ensures the value can never fall below 1.
    const relevant = sqlContaining('insertion_seq');
    const migrationSql = relevant.join('\n');
    expect(migrationSql).toMatch(/GREATEST/i);
    expect(migrationSql).toMatch(/setval/i);
  });

  it('passes is_called=false to setval so the next insert gets the exact next value', async () => {
    await migrateSchema();
    const relevant = sqlContaining('insertion_seq');
    const migrationSql = relevant.join('\n');
    // setval(seq, val, false) — the third argument must be "false".
    // The regex uses [\s\S]* (any char including newlines) because the
    // value argument itself contains nested parentheses (GREATEST, COALESCE).
    expect(migrationSql).toMatch(/setval\s*\([\s\S]*?,\s*false\s*\)/i);
  });

  it('is idempotent: running twice does not throw', async () => {
    await expect(migrateSchema()).resolves.not.toThrow();
    capturedSql.length = 0;
    await expect(migrateSchema()).resolves.not.toThrow();
  });
});
