import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: vi.fn(),
}));

const {
  ownedTrees,
  insertedRows,
  capturedValues,
  mockInsert,
  mockTransaction,
} = vi.hoisted(() => {
  const ownedTrees: { rows: Array<{ id: string }> } = { rows: [] };
  const insertedRows: { rows: unknown[] } = { rows: [] };
  const capturedValues: { current: unknown } = { current: null };

  const mockSelect = vi.fn(() => {
    const chain: Record<string, unknown> = {};
    chain.from = () => chain;
    chain.where = () => chain;
    chain.for = () => Promise.resolve(ownedTrees.rows);
    return chain;
  });

  const mockInsert = vi.fn(() => ({
    values: (values: unknown) => {
      capturedValues.current = values;
      return {
        returning: () => Promise.resolve(insertedRows.rows),
      };
    },
  }));

  const mockTransaction = vi.fn(async (callback: (tx: unknown) => Promise<void>) =>
    callback({
      select: mockSelect,
      insert: mockInsert,
    }),
  );

  return {
    ownedTrees,
    insertedRows,
    capturedValues,
    mockInsert,
    mockTransaction,
  };
});

vi.mock("@workspace/db", () => ({
  db: {
    transaction: mockTransaction,
  },
  treesTable: { id: "tree.id", userId: "tree.userId" },
  careLogsTable: { id: "log.id" },
  careRemindersTable: { id: "reminder.id" },
  treePhotosTable: {},
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const real = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...real,
    and: (...args: unknown[]) => ({ type: "and", args }),
    eq: (column: unknown, value: unknown) => ({ type: "eq", column, value }),
    inArray: (column: unknown, values: unknown[]) => ({
      type: "inArray",
      column,
      values,
    }),
  };
});

import app from "../../app";
import { getAuth } from "@clerk/express";

const USER_ID = "user_bulk_care";
const TREE_ONE = "aaaaaaaa-0000-0000-0000-000000000001";
const TREE_TWO = "aaaaaaaa-0000-0000-0000-000000000002";
const CREATED_AT = new Date("2026-09-16T12:00:00.000Z");

describe("bulk care routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuth).mockReturnValue({ userId: USER_ID } as never);
    ownedTrees.rows = [];
    insertedRows.rows = [];
    capturedValues.current = null;
  });

  it("creates one care log per owned tree", async () => {
    ownedTrees.rows = [{ id: TREE_ONE }, { id: TREE_TWO }];
    insertedRows.rows = [
      {
        id: "bbbbbbbb-0000-0000-0000-000000000001",
        treeId: TREE_ONE,
        type: "Watering",
        date: "2026-09-16",
        notes: "Morning care",
        createdAt: CREATED_AT,
      },
      {
        id: "bbbbbbbb-0000-0000-0000-000000000002",
        treeId: TREE_TWO,
        type: "Watering",
        date: "2026-09-16",
        notes: "Morning care",
        createdAt: CREATED_AT,
      },
    ];

    const response = await request(app).post("/api/trees/logs/bulk").send({
      treeIds: [TREE_ONE, TREE_TWO],
      type: "Watering",
      date: "2026-09-16",
      notes: "Morning care",
    });

    expect(response.status).toBe(201);
    expect(response.body).toHaveLength(2);
    expect(response.body[0].createdAt).toBe(CREATED_AT.toISOString());
    expect(capturedValues.current).toEqual([
      {
        treeId: TREE_ONE,
        type: "Watering",
        date: "2026-09-16",
        notes: "Morning care",
      },
      {
        treeId: TREE_TWO,
        type: "Watering",
        date: "2026-09-16",
        notes: "Morning care",
      },
    ]);
  });

  it("does not create logs when any requested tree is missing or unowned", async () => {
    ownedTrees.rows = [{ id: TREE_ONE }];

    const response = await request(app).post("/api/trees/logs/bulk").send({
      treeIds: [TREE_ONE, TREE_TWO],
      type: "Pruning",
      date: "2026-09-16",
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: "One or more trees were not found or not owned by the user",
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("creates one reminder per owned tree", async () => {
    ownedTrees.rows = [{ id: TREE_ONE }, { id: TREE_TWO }];
    insertedRows.rows = [
      {
        id: "cccccccc-0000-0000-0000-000000000001",
        treeId: TREE_ONE,
        type: "Fertilize",
        dueDate: "2026-09-20",
        notes: null,
        completed: false,
        createdAt: CREATED_AT,
      },
      {
        id: "cccccccc-0000-0000-0000-000000000002",
        treeId: TREE_TWO,
        type: "Fertilize",
        dueDate: "2026-09-20",
        notes: null,
        completed: false,
        createdAt: CREATED_AT,
      },
    ];

    const response = await request(app).post("/api/trees/reminders/bulk").send({
      treeIds: [TREE_ONE, TREE_TWO],
      type: "Fertilize",
      dueDate: "2026-09-20",
    });

    expect(response.status).toBe(201);
    expect(response.body).toHaveLength(2);
    expect(response.body[1]).toMatchObject({
      treeId: TREE_TWO,
      dueDate: "2026-09-20",
      completed: false,
    });
    expect(capturedValues.current).toEqual([
      {
        treeId: TREE_ONE,
        type: "Fertilize",
        dueDate: "2026-09-20",
      },
      {
        treeId: TREE_TWO,
        type: "Fertilize",
        dueDate: "2026-09-20",
      },
    ]);
  });

  it("does not create reminders when any requested tree is missing or unowned", async () => {
    ownedTrees.rows = [{ id: TREE_ONE }];

    const response = await request(app).post("/api/trees/reminders/bulk").send({
      treeIds: [TREE_ONE, TREE_TWO],
      type: "Repot",
      dueDate: "2026-10-01",
    });

    expect(response.status).toBe(404);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});