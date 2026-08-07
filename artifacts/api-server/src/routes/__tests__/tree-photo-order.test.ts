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
  treePhotosTable:    { id: 'id', treeId: 'treeId', takenAt: 'takenAt', createdAt: 'createdAt' },
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
  id:         'dddddddd-0000-0000-0000-000000000001',
  treeId:     TREE_ID,
  photoUrl:   'https://cdn.example.com/oldest.jpg',
  photoThumb: 'https://cdn.example.com/oldest-thumb.jpg',
  takenAt:    '2022-03-01',
  createdAt:  new Date('2022-03-01T10:00:00Z'),
};

/** Middle photo — will be deleted in the ordering-after-delete test. */
const photoMiddle = {
  id:         'dddddddd-0000-0000-0000-000000000002',
  treeId:     TREE_ID,
  photoUrl:   'https://cdn.example.com/middle.jpg',
  photoThumb: 'https://cdn.example.com/middle-thumb.jpg',
  takenAt:    '2023-06-15',
  createdAt:  new Date('2023-06-15T10:00:00Z'),
};

/** Newest photo — should appear last in the list. */
const photoNewest = {
  id:         'dddddddd-0000-0000-0000-000000000003',
  treeId:     TREE_ID,
  photoUrl:   'https://cdn.example.com/newest.jpg',
  photoThumb: 'https://cdn.example.com/newest-thumb.jpg',
  takenAt:    '2024-11-20',
  createdAt:  new Date('2024-11-20T10:00:00Z'),
};

/**
 * Two photos that share the same takenAt date — used to verify that
 * createdAt ASC acts as a stable tiebreaker.
 */
const photoSameDay1 = {
  id:         'eeeeeeee-0000-0000-0000-000000000001',
  treeId:     TREE_ID,
  photoUrl:   'https://cdn.example.com/same-day-a.jpg',
  photoThumb: 'https://cdn.example.com/same-day-a-thumb.jpg',
  takenAt:    '2023-09-10',
  createdAt:  new Date('2023-09-10T08:00:00Z'),  // uploaded first
};

const photoSameDay2 = {
  id:         'eeeeeeee-0000-0000-0000-000000000002',
  treeId:     TREE_ID,
  photoUrl:   'https://cdn.example.com/same-day-b.jpg',
  photoThumb: 'https://cdn.example.com/same-day-b-thumb.jpg',
  takenAt:    '2023-09-10',                        // same takenAt as photoSameDay1
  createdAt:  new Date('2023-09-10T09:30:00Z'),  // uploaded second
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
