/**
 * Tests for GET /api/trees/:id/photos — ordering guarantees
 *
 * Verifies that the photo list is sorted oldest-first (takenAt ASC,
 * createdAt ASC), and that deleting a photo from the middle of the
 * timeline does not disturb the relative order of the survivors.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Mock @clerk/express BEFORE importing the app.
// ---------------------------------------------------------------------------
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Shared mock state — hoisted so the vi.mock() factory can reference them.
// ---------------------------------------------------------------------------
const {
  selectResultQueue,
  deleteResultHolder,
  capturedOrderBy,
  mockSelect,
  mockDelete,
  mockUpdate,
} = vi.hoisted(() => {
  const selectResultQueue: any[][] = [];
  const deleteResultHolder: { rows: any[] } = { rows: [] };
  // Captures each array of args passed to .orderBy() across all calls.
  const capturedOrderBy: any[][] = [];

  function fluentChain(result: any, captureOrderBy?: (args: any[]) => void) {
    const chain: any = {
      from:    () => chain,
      where:   () => chain,
      limit:   () => Promise.resolve(result),
      orderBy: (...args: any[]) => {
        captureOrderBy?.(args);
        // Return chain (not a bare Promise) so callers can chain .limit() after .orderBy().
        return chain;
      },
      set:       () => chain,
      returning: () => Promise.resolve(result),
      then:    (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
      catch:   (fn: any) => Promise.resolve(result).catch(fn),
      finally: (fn: any) => Promise.resolve(result).finally(fn),
    };
    return chain;
  }

  const mockSelect = vi.fn(() => {
    const result = selectResultQueue.shift() ?? [];
    return fluentChain(result, (args) => capturedOrderBy.push(args));
  });

  const mockDelete = vi.fn(() => fluentChain(deleteResultHolder.rows));

  const mockUpdate = vi.fn(() => {
    const updateChain: any = {
      set:   () => updateChain,
      where: () => Promise.resolve(undefined),
    };
    return updateChain;
  });

  return {
    selectResultQueue,
    deleteResultHolder,
    capturedOrderBy,
    mockSelect,
    mockDelete,
    mockUpdate,
  };
});

// ---------------------------------------------------------------------------
// Mock @workspace/db
// ---------------------------------------------------------------------------
vi.mock('@workspace/db', () => ({
  db: {
    select: mockSelect,
    delete: mockDelete,
    update: mockUpdate,
  },
  treesTable:         { id: 'id', userId: 'userId', photoUrl: 'photoUrl', coverThumb: 'coverThumb' },
  treePhotosTable:    { id: 'id', treeId: 'treeId', takenAt: 'takenAt', createdAt: 'createdAt', insertionSeq: 'insertionSeq' },
  careLogsTable:      {},
  careRemindersTable: {},
}));

// Mock drizzle operators.
vi.mock('drizzle-orm', async (importOriginal) => {
  const real = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...real,
    and:  (...args: any[]) => ({ _tag: 'and', args }),
    eq:   (a: any, b: any) => ({ _tag: 'eq', a, b }),
    asc:  (col: any) => ({ _tag: 'asc', col }),
    desc: (col: any) => ({ _tag: 'desc', col }),
  };
});

import app from '../../app';
import { getAuth } from '@clerk/express';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'user_order_test';
const TREE_ID = 'cccccccc-0000-0000-0000-000000000001';

const fakeTree = {
  id:        TREE_ID,
  userId:    USER_ID,
  name:      'Ordering Tree',
  photoUrl:  null,
  coverThumb: null,
};

/** Oldest photo — should appear first in the list. */
const photoOldest = {
  id:           'dddddddd-0000-0000-0000-000000000001',
  treeId:       TREE_ID,
  photoUrl:     'https://cdn.example.com/oldest.jpg',
  photoThumb:   'https://cdn.example.com/oldest-thumb.jpg',
  takenAt:      '2022-03-01',
  createdAt:    new Date('2022-03-01T10:00:00Z'),
  insertionSeq: 1,
};

/** Middle photo — will be deleted in the ordering-after-delete test. */
const photoMiddle = {
  id:           'dddddddd-0000-0000-0000-000000000002',
  treeId:       TREE_ID,
  photoUrl:     'https://cdn.example.com/middle.jpg',
  photoThumb:   'https://cdn.example.com/middle-thumb.jpg',
  takenAt:      '2023-06-15',
  createdAt:    new Date('2023-06-15T10:00:00Z'),
  insertionSeq: 2,
};

/** Newest photo — should appear last in the list. */
const photoNewest = {
  id:           'dddddddd-0000-0000-0000-000000000003',
  treeId:       TREE_ID,
  photoUrl:     'https://cdn.example.com/newest.jpg',
  photoThumb:   'https://cdn.example.com/newest-thumb.jpg',
  takenAt:      '2024-11-20',
  createdAt:    new Date('2024-11-20T10:00:00Z'),
  insertionSeq: 3,
};

/**
 * Two photos that share the same takenAt date — used to verify that
 * createdAt ASC acts as a stable tiebreaker.
 */
const photoSameDay1 = {
  id:           'eeeeeeee-0000-0000-0000-000000000001',
  treeId:       TREE_ID,
  photoUrl:     'https://cdn.example.com/same-day-a.jpg',
  photoThumb:   'https://cdn.example.com/same-day-a-thumb.jpg',
  takenAt:      '2023-09-10',
  createdAt:    new Date('2023-09-10T08:00:00Z'),  // uploaded first
  insertionSeq: 4,
};

const photoSameDay2 = {
  id:           'eeeeeeee-0000-0000-0000-000000000002',
  treeId:       TREE_ID,
  photoUrl:     'https://cdn.example.com/same-day-b.jpg',
  photoThumb:   'https://cdn.example.com/same-day-b-thumb.jpg',
  takenAt:      '2023-09-10',                        // same takenAt as photoSameDay1
  createdAt:    new Date('2023-09-10T09:30:00Z'),  // uploaded second
  insertionSeq: 5,
};

/**
 * Two photos that share both takenAt AND createdAt (sub-second rapid upload).
 *
 * When createdAt values are identical the sort key (takenAt ASC, createdAt ASC)
 * cannot distinguish between the rows.  insertionSeq — a bigint backed by a
 * database sequence assigned at insert time — is the deterministic final
 * tiebreaker: the first-inserted row always has a strictly lower sequence value
 * than subsequent rows, guaranteeing stable ordering regardless of clock
 * resolution.
 */
const SAME_TIMESTAMP = new Date('2024-05-01T12:00:00.000Z');

const photoRapid1 = {
  id:           'ffffffff-0000-0000-0000-000000000001',
  treeId:       TREE_ID,
  photoUrl:     'https://cdn.example.com/rapid-a.jpg',
  photoThumb:   'https://cdn.example.com/rapid-a-thumb.jpg',
  takenAt:      '2024-05-01',
  createdAt:    SAME_TIMESTAMP,
  insertionSeq: 10,   // lower seq = inserted first
};

const photoRapid2 = {
  id:           'ffffffff-0000-0000-0000-000000000002',
  treeId:       TREE_ID,
  photoUrl:     'https://cdn.example.com/rapid-b.jpg',
  photoThumb:   'https://cdn.example.com/rapid-b-thumb.jpg',
  takenAt:      '2024-05-01',
  createdAt:    SAME_TIMESTAMP,
  insertionSeq: 11,   // higher seq = inserted second
};

const LIST_ENDPOINT   = `/api/trees/${TREE_ID}/photos`;
const DELETE_ENDPOINT = `/api/trees/${TREE_ID}/photos/${photoMiddle.id}`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/trees/:id/photos — ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResultQueue.length = 0;
    deleteResultHolder.rows  = [];
    capturedOrderBy.length   = 0;
  });

  // -------------------------------------------------------------------------
  // Test 1: photos are returned oldest-first (takenAt ASC).
  // -------------------------------------------------------------------------
  it('returns photos sorted oldest-first by takenAt', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: USER_ID } as any);

    // The DB is supposed to return rows already ordered (ASC); simulate that.
    selectResultQueue.push([fakeTree]);                                   // ownership check
    selectResultQueue.push([photoOldest, photoMiddle, photoNewest]);      // photo list

    const res = await request(app).get(LIST_ENDPOINT);

    expect(res.status).toBe(200);

    const ids = res.body.map((p: any) => p.id);
    expect(ids).toEqual([photoOldest.id, photoMiddle.id, photoNewest.id]);
  });

  // -------------------------------------------------------------------------
  // Test 2: the query uses asc(takenAt) and asc(createdAt) as sort keys.
  // -------------------------------------------------------------------------
  it('queries the DB with takenAt ASC then createdAt ASC ordering', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: USER_ID } as any);

    selectResultQueue.push([fakeTree]);
    selectResultQueue.push([photoOldest, photoMiddle, photoNewest]);

    await request(app).get(LIST_ENDPOINT);

    // The second select (photo listing) is the one that has orderBy.
    // capturedOrderBy[0] is from the ownership select (no orderBy expected there;
    // the chain only calls the capture fn if orderBy is actually invoked).
    // Find the call whose args wrap takenAt and createdAt.
    const photoQueryOrderBy = capturedOrderBy.find((args) =>
      args.some((a: any) => a?.col === 'takenAt' || a?.col === 'createdAt'),
    );

    expect(photoQueryOrderBy).toBeDefined();

    const tags = photoQueryOrderBy!.map((a: any) => `${a._tag}:${a.col}`);
    expect(tags).toContain('asc:takenAt');
    expect(tags).toContain('asc:createdAt');
  });

  // -------------------------------------------------------------------------
  // Test 4: photos with identical takenAt dates are ordered by createdAt ASC.
  // -------------------------------------------------------------------------
  it('orders photos with the same takenAt date by createdAt ASC as a tiebreaker', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: USER_ID } as any);

    // The DB returns the two same-day photos in createdAt ASC order (as the
    // query requests).  The handler must preserve and surface that order.
    selectResultQueue.push([fakeTree]);                         // ownership check
    selectResultQueue.push([photoSameDay1, photoSameDay2]);     // photo list (oldest upload first)

    const res = await request(app).get(LIST_ENDPOINT);

    expect(res.status).toBe(200);

    const ids = res.body.map((p: any) => p.id);

    // photoSameDay1 was uploaded first (earlier createdAt) and must come first.
    expect(ids).toEqual([photoSameDay1.id, photoSameDay2.id]);

    // Confirm the DB was asked to sort by createdAt as a tiebreaker.
    const photoQueryOrderBy = capturedOrderBy.find((args) =>
      args.some((a: any) => a?.col === 'takenAt' || a?.col === 'createdAt'),
    );
    expect(photoQueryOrderBy).toBeDefined();
    const tags = photoQueryOrderBy!.map((a: any) => `${a._tag}:${a.col}`);
    expect(tags).toContain('asc:takenAt');
    expect(tags).toContain('asc:createdAt');
  });

  // -------------------------------------------------------------------------
  // Test 5: rapid uploads with identical createdAt timestamps.
  //
  // When two photos arrive within the same DB clock tick (sub-second collision),
  // createdAt cannot distinguish them.  The handler must:
  //   a) still issue the query with takenAt ASC + createdAt ASC,
  //   b) pass through whatever order the DB returns without re-sorting.
  //
  // The DB's physical insertion order is the effective tiebreaker; the handler
  // must not disturb it.  This test verifies that the response preserves the
  // order the mock DB provides, confirming no client-side re-shuffle occurs.
  // -------------------------------------------------------------------------
  it('uses insertionSeq ASC as the final tiebreaker for photos with identical takenAt and createdAt (sub-second collision)', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: USER_ID } as any);

    // DB applies takenAt ASC → createdAt ASC → insertionSeq ASC and returns
    // rapid1 (seq 10) before rapid2 (seq 11) because it was inserted first.
    selectResultQueue.push([fakeTree]);
    selectResultQueue.push([photoRapid1, photoRapid2]);

    const res = await request(app).get(LIST_ENDPOINT);

    expect(res.status).toBe(200);

    const ids = res.body.map((p: any) => p.id);

    // rapid1 must come first (lower insertionSeq = earlier insert).
    expect(ids).toEqual([photoRapid1.id, photoRapid2.id]);

    // The critical assertion: the query must include insertionSeq ASC so the DB
    // can deterministically break ties when both takenAt and createdAt collide.
    const photoQueryOrderBy = capturedOrderBy.find((args) =>
      args.some((a: any) => a?.col === 'takenAt' || a?.col === 'createdAt' || a?.col === 'insertionSeq'),
    );
    expect(photoQueryOrderBy).toBeDefined();
    const tags = photoQueryOrderBy!.map((a: any) => `${a._tag}:${a.col}`);
    expect(tags).toContain('asc:takenAt');
    expect(tags).toContain('asc:createdAt');
    // insertionSeq ASC is the deterministic tiebreaker for sub-second collisions.
    expect(tags).toContain('asc:insertionSeq');
  });

  // -------------------------------------------------------------------------
  // Test 3: deleting the middle photo preserves the relative order of survivors.
  //
  // Before delete: oldest → middle → newest
  // After  delete: oldest → newest          (middle is gone; relative order intact)
  // -------------------------------------------------------------------------
  it('preserves relative order of remaining photos after the middle one is deleted', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: USER_ID } as any);

    // --- DELETE the middle photo ---
    selectResultQueue.push([fakeTree]);          // ownership check for DELETE
    deleteResultHolder.rows = [photoMiddle];      // photo is found and removed
    selectResultQueue.push([photoNewest]);         // cover-sync: newest becomes new cover

    const deleteRes = await request(app).delete(DELETE_ENDPOINT);
    expect(deleteRes.status).toBe(204);

    // --- GET the remaining photos ---
    // Reset the capture state for the follow-up GET.
    capturedOrderBy.length = 0;
    selectResultQueue.push([fakeTree]);                       // ownership check for GET
    selectResultQueue.push([photoOldest, photoNewest]);        // DB returns survivors in order

    const listRes = await request(app).get(LIST_ENDPOINT);
    expect(listRes.status).toBe(200);

    const ids = listRes.body.map((p: any) => p.id);

    // Oldest must still come first; newest must still come last.
    expect(ids).toEqual([photoOldest.id, photoNewest.id]);

    // The middle photo must not appear.
    expect(ids).not.toContain(photoMiddle.id);
  });
});
