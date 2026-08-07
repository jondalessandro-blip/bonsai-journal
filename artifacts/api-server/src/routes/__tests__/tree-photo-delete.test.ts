/**
 * Tests for DELETE /api/trees/:id/photos/:photoId
 *
 * Verifies that the tree's photoUrl / coverThumb fields stay in sync
 * with the photo gallery after a deletion.
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
// Shared mock state — must be defined with vi.hoisted() so the values are
// available inside the vi.mock() factory (which is hoisted to the top).
// ---------------------------------------------------------------------------
const {
  selectResultQueue,
  capturedUpdateSet,
  deleteResultHolder,
  mockSelect,
  mockDelete,
  mockUpdate,
} = vi.hoisted(() => {
  // Queue of row-arrays returned by successive select() calls.
  const selectResultQueue: any[][] = [];
  // Stores the argument passed to .set() on the last update() call.
  const capturedUpdateSet: { current: Record<string, any> | null } = { current: null };
  // Rows returned by delete().where().returning()
  const deleteResultHolder: { rows: any[] } = { rows: [] };

  /**
   * Returns an object that behaves like a drizzle query-builder chain and
   * resolves to `result` when awaited, or when `.returning()` / `.limit()` is
   * called at the end.
   */
  function fluentChain(result: any) {
    const chain: any = {
      from:      () => chain,
      where:     () => chain,
      orderBy:   () => chain,
      limit:     () => Promise.resolve(result),
      set:       () => chain,
      returning: () => Promise.resolve(result),
      then: (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject),
      catch: (fn: any) => Promise.resolve(result).catch(fn),
      finally: (fn: any) => Promise.resolve(result).finally(fn),
    };
    return chain;
  }

  const mockSelect = vi.fn(() => fluentChain(selectResultQueue.shift() ?? []));

  const mockDelete = vi.fn(() => fluentChain(deleteResultHolder.rows));

  const mockUpdate = vi.fn(() => {
    const updateChain: any = {
      set: (vals: Record<string, any>) => {
        capturedUpdateSet.current = vals;
        return updateChain;
      },
      where: () => Promise.resolve(undefined),
    };
    return updateChain;
  });

  return {
    selectResultQueue,
    capturedUpdateSet,
    deleteResultHolder,
    mockSelect,
    mockDelete,
    mockUpdate,
  };
});

// ---------------------------------------------------------------------------
// Mock @workspace/db — uses the hoisted helpers above.
// ---------------------------------------------------------------------------
vi.mock('@workspace/db', () => ({
  db: {
    select: mockSelect,
    delete: mockDelete,
    update: mockUpdate,
  },
  treesTable:        { id: 'id', userId: 'userId', photoUrl: 'photoUrl', coverThumb: 'coverThumb' },
  treePhotosTable:   { id: 'id', treeId: 'treeId', takenAt: 'takenAt', createdAt: 'createdAt' },
  careLogsTable:     {},
  careRemindersTable:{},
}));

// Mock drizzle operators so the route can call them without errors.
vi.mock('drizzle-orm', async (importOriginal) => {
  const real = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...real,
    and:  (...args: any[]) => ({ _tag: 'and', args }),
    eq:   (a: any, b: any) => ({ _tag: 'eq', a, b }),
    desc: (col: any) => ({ _tag: 'desc', col }),
    asc:  (col: any) => ({ _tag: 'asc', col }),
  };
});

// Import app after all mocks are registered.
import app from '../../app';
import { getAuth } from '@clerk/express';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'user_test_123';
const TREE_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const PHOTO_A = 'bbbbbbbb-0000-0000-0000-000000000001'; // photo being deleted
const PHOTO_B = 'bbbbbbbb-0000-0000-0000-000000000002'; // next-most-recent photo

const fakeTree = {
  id: TREE_ID,
  userId: USER_ID,
  name: 'Test Tree',
  photoUrl: 'https://cdn.example.com/photo-a.jpg',
  coverThumb: 'https://cdn.example.com/photo-a-thumb.jpg',
};

const deletedPhoto = {
  id: PHOTO_A,
  treeId: TREE_ID,
  photoUrl: 'https://cdn.example.com/photo-a.jpg',
  photoThumb: 'https://cdn.example.com/photo-a-thumb.jpg',
  takenAt: '2025-01-01',
};

const remainingPhoto = {
  id: PHOTO_B,
  treeId: TREE_ID,
  photoUrl: 'https://cdn.example.com/photo-b.jpg',
  photoThumb: 'https://cdn.example.com/photo-b-thumb.jpg',
  takenAt: '2024-06-15',
};

const ENDPOINT = `/api/trees/${TREE_ID}/photos/${PHOTO_A}`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DELETE /api/trees/:id/photos/:photoId — cover-sync behaviour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResultQueue.length = 0;
    capturedUpdateSet.current = null;
    deleteResultHolder.rows = [];
  });

  // -------------------------------------------------------------------------
  // Case 1: remaining photos exist after deletion.
  // photoUrl and coverThumb must reflect the next-most-recent photo.
  // -------------------------------------------------------------------------
  it('updates photoUrl and coverThumb to the next-most-recent photo when one remains', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: USER_ID } as any);

    // getOwnedTree select → ownership check passes
    selectResultQueue.push([fakeTree]);
    // delete returns the removed photo
    deleteResultHolder.rows = [deletedPhoto];
    // "find new cover" select → one remaining photo
    selectResultQueue.push([remainingPhoto]);

    const res = await request(app).delete(ENDPOINT);

    expect(res.status).toBe(204);
    expect(capturedUpdateSet.current).toEqual({
      photoUrl:   remainingPhoto.photoUrl,
      coverThumb: remainingPhoto.photoThumb,
    });
  });

  // -------------------------------------------------------------------------
  // Case 2: deleted photo was the last one.
  // Both fields must become null.
  // -------------------------------------------------------------------------
  it('sets photoUrl and coverThumb to null when the last photo is deleted', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: USER_ID } as any);

    selectResultQueue.push([fakeTree]);
    deleteResultHolder.rows = [deletedPhoto];
    // no photos left
    selectResultQueue.push([]);

    const res = await request(app).delete(ENDPOINT);

    expect(res.status).toBe(204);
    expect(capturedUpdateSet.current).toEqual({
      photoUrl:   null,
      coverThumb: null,
    });
  });

  // -------------------------------------------------------------------------
  // Case 3: photo not found — 404, no tree update.
  // -------------------------------------------------------------------------
  it('returns 404 and does not update the tree when the photo does not exist', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: USER_ID } as any);

    selectResultQueue.push([fakeTree]);
    deleteResultHolder.rows = []; // photo not found

    const res = await request(app).delete(ENDPOINT);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Photo not found' });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(capturedUpdateSet.current).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Case 4: unauthenticated — must return 401 without touching the DB.
  // -------------------------------------------------------------------------
  it('returns 401 for unauthenticated requests', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: null } as any);

    const res = await request(app).delete(ENDPOINT);

    expect(res.status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Case 5: tree not found / wrong owner — 404, no delete.
  // -------------------------------------------------------------------------
  it('returns 404 when the tree does not belong to the authenticated user', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: 'user_other' } as any);

    selectResultQueue.push([]); // no tree found for this user

    const res = await request(app).delete(ENDPOINT);

    expect(res.status).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
