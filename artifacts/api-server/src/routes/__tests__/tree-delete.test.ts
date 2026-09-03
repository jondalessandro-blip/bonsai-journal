import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) =>
    next(),
  getAuth: vi.fn(),
}));

const {
  tables,
  ownedTreeRows,
  deletedTreeRows,
  deletedTables,
  mockTransaction,
} = vi.hoisted(() => {
  const tables = {
    trees: { id: "trees.id", userId: "trees.userId" },
    logs: { treeId: "care_logs.treeId" },
    reminders: { treeId: "care_reminders.treeId" },
    photos: { treeId: "tree_photos.treeId" },
    feedback: {},
  };
  const ownedTreeRows: { rows: unknown[] } = { rows: [] };
  const deletedTreeRows: { rows: unknown[] } = { rows: [] };
  const deletedTables: unknown[] = [];

  const mockTransaction = vi.fn(async (callback: (tx: unknown) => unknown) => {
    const tx = {
      select: vi.fn(() => {
        const chain = {
          from: () => chain,
          where: () => chain,
          for: () => Promise.resolve(ownedTreeRows.rows),
        };
        return chain;
      }),
      delete: vi.fn((table: unknown) => {
        deletedTables.push(table);
        const result = table === tables.trees ? deletedTreeRows.rows : [];
        const chain = {
          where: () => chain,
          returning: () => Promise.resolve(result),
          then: (
            resolve: (value: unknown[]) => unknown,
            reject?: (reason: unknown) => unknown,
          ) => Promise.resolve(result).then(resolve, reject),
        };
        return chain;
      }),
    };

    return callback(tx);
  });

  return {
    tables,
    ownedTreeRows,
    deletedTreeRows,
    deletedTables,
    mockTransaction,
  };
});

vi.mock("@workspace/db", () => ({
  db: {
    transaction: mockTransaction,
  },
  treesTable: tables.trees,
  careLogsTable: tables.logs,
  careRemindersTable: tables.reminders,
  treePhotosTable: tables.photos,
  feedbackTable: tables.feedback,
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const real = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...real,
    and: (...args: unknown[]) => ({ type: "and", args }),
    eq: (left: unknown, right: unknown) => ({ type: "eq", left, right }),
  };
});

import app from "../../app";
import { getAuth } from "@clerk/express";

const USER_ID = "user_test_123";
const TREE_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const ENDPOINT = `/api/trees/${TREE_ID}`;
const tree = {
  id: TREE_ID,
  userId: USER_ID,
  name: "Sample Tree",
};

describe("DELETE /api/trees/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ownedTreeRows.rows = [];
    deletedTreeRows.rows = [];
    deletedTables.length = 0;
  });

  it("deletes reminders, logs, photos, and then the owned tree", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: USER_ID } as never);
    ownedTreeRows.rows = [tree];
    deletedTreeRows.rows = [tree];

    const response = await request(app).delete(ENDPOINT);

    expect(response.status).toBe(204);
    expect(deletedTables).toEqual([
      tables.reminders,
      tables.logs,
      tables.photos,
      tables.trees,
    ]);
  });

  it("returns 404 without deleting related records for an unowned tree", async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: "user_other" } as never);

    const response = await request(app).delete(ENDPOINT);

    expect(response.status).toBe(404);
    expect(deletedTables).toEqual([]);
  });
});