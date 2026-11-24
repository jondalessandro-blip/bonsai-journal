import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: vi.fn(),
}));

const {
  state,
  mockTransaction,
  updates,
  insertedLogs,
  treesTable,
  careLogsTable,
  logSequence,
} = vi.hoisted(() => {
  const treesTable = { id: "trees.id", userId: "trees.userId", isDormant: "trees.isDormant" };
  const careLogsTable = { id: "care_logs.id", treeId: "care_logs.treeId", type: "care_logs.type" };
  const state: { trees: Array<Record<string, any>> } = { trees: [] };
  const updates: Array<{ id: string; values: Record<string, unknown> }> = [];
  const insertedLogs: Array<Record<string, unknown>> = [];
  const logSequence = { value: 1 };

  const mockTransaction = vi.fn(async (callback: (tx: Record<string, any>) => Promise<unknown>) => {
    const tx = {
      select: () => {
        const chain: Record<string, any> = {};
        let condition: any;
        chain.from = () => chain;
        chain.where = (value: unknown) => {
          condition = value;
          return chain;
        };
        chain.orderBy = () => chain;
        chain.for = async () => {
          const filters = condition?.args ?? [];
          const idFilter = filters.find((item: any) => item.kind === "inArray");
          const ownerFilter = filters.find(
            (item: any) => item.kind === "eq" && item.column === treesTable.userId,
          );
          return state.trees
            .filter((tree) => idFilter.values.includes(tree.id) && tree.userId === ownerFilter.value)
            .sort((a, b) => a.id.localeCompare(b.id));
        };
        return chain;
      },
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: async (condition: any) => {
            if (table !== treesTable) throw new Error("Unexpected update table");
            const id = condition.value;
            updates.push({ id, values });
            const tree = state.trees.find((item) => item.id === id);
            if (tree) Object.assign(tree, values);
          },
        }),
      }),
      insert: (table: unknown) => ({
        values: (rows: Array<Record<string, unknown>>) => {
          if (table !== careLogsTable) throw new Error("Unexpected insert table");
          const created: Array<Record<string, unknown> & { id: string; treeId: string }> = rows.map((row) => ({
            ...row,
            treeId: row.treeId as string,
            id: `bbbbbbbb-0000-0000-0000-${String(logSequence.value++).padStart(12, "0")}`,
          }));
          insertedLogs.push(...created);
          return {
            returning: async () => created.map(({ id, treeId }) => ({ id, treeId })),
          };
        },
      }),
    };
    return callback(tx);
  });

  return { state, mockTransaction, updates, insertedLogs, treesTable, careLogsTable, logSequence };
});

vi.mock("@workspace/db", () => ({
  db: { transaction: mockTransaction },
  treesTable,
  careLogsTable,
  careRemindersTable: {},
  treePhotosTable: {},
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const real = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...real,
    and: (...args: unknown[]) => ({ kind: "and", args }),
    eq: (column: unknown, value: unknown) => ({ kind: "eq", column, value }),
    inArray: (column: unknown, values: unknown[]) => ({ kind: "inArray", column, values }),
  };
});

import app from "../../app";
import { getAuth } from "@clerk/express";

const USER_ID = "user_dormancy";
const TREE_ONE = "aaaaaaaa-0000-0000-0000-000000000001";
const TREE_TWO = "aaaaaaaa-0000-0000-0000-000000000002";
const TREE_THREE = "aaaaaaaa-0000-0000-0000-000000000003";

function makeTree(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    userId: USER_ID,
    isDormant: false,
    dormantSince: null,
    status: "Healthy",
    ...overrides,
  };
}

describe("POST /trees/dormancy/bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuth).mockReturnValue({ userId: USER_ID } as never);
    state.trees = [];
    updates.length = 0;
    insertedLogs.length = 0;
    logSequence.value = 1;
  });

  it("updates all owned trees and adds one dormancy timeline log per changed tree", async () => {
    state.trees = [
      makeTree(TREE_ONE),
      makeTree(TREE_TWO, { status: "Thriving" }),
      makeTree(TREE_THREE, { status: "Sick" }),
    ];

    const response = await request(app)
      .post("/api/trees/dormancy/bulk")
      .send({ treeIds: [TREE_ONE, TREE_TWO, TREE_THREE], dormant: true });

    expect(response.status).toBe(200);
    expect(response.body.updatedCount).toBe(3);
    expect(response.body.undoItems).toHaveLength(3);
    expect(response.body.undoItems[0]).toMatchObject({
      treeId: TREE_ONE,
      previousIsDormant: false,
      previousDormantSince: null,
      resultingIsDormant: true,
      resultingDormantSince: expect.any(String),
      expectedUpdatedAt: expect.any(String),
    });
    expect(state.trees.every((tree) => tree.isDormant && tree.dormantSince instanceof Date)).toBe(true);
    expect(state.trees.map((tree) => tree.status)).toEqual(["Healthy", "Thriving", "Sick"]);
    expect(insertedLogs).toHaveLength(3);
    expect(insertedLogs.map(({ type, treeId }) => ({ type, treeId }))).toEqual([
      { type: "Began dormancy", treeId: TREE_ONE },
      { type: "Began dormancy", treeId: TREE_TWO },
      { type: "Began dormancy", treeId: TREE_THREE },
    ]);
  });

  it("rejects the entire operation when any tree is not owned", async () => {
    state.trees = [makeTree(TREE_ONE), makeTree(TREE_TWO, { userId: "another_user" })];

    const response = await request(app)
      .post("/api/trees/dormancy/bulk")
      .send({ treeIds: [TREE_ONE, TREE_TWO], dormant: true });

    expect(response.status).toBe(404);
    expect(updates).toHaveLength(0);
    expect(insertedLogs).toHaveLength(0);
  });

  it("does not duplicate history when the requested state is already set", async () => {
    state.trees = [makeTree(TREE_ONE, { isDormant: true, dormantSince: new Date() })];

    const response = await request(app)
      .post("/api/trees/dormancy/bulk")
      .send({ treeIds: [TREE_ONE], dormant: true });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ updatedCount: 0, undoItems: [] });
    expect(updates).toHaveLength(0);
    expect(insertedLogs).toHaveLength(0);
  });

  it("clears dormant_since when ending dormancy without changing health status", async () => {
    state.trees = [makeTree(TREE_ONE, { isDormant: true, dormantSince: new Date(), status: "Sick" })];

    const response = await request(app)
      .post("/api/trees/dormancy/bulk")
      .send({ treeIds: [TREE_ONE], dormant: false });

    expect(response.status).toBe(200);
    expect(state.trees[0]).toMatchObject({ isDormant: false, dormantSince: null, status: "Sick" });
    expect(insertedLogs).toHaveLength(1);
    expect(insertedLogs[0]).toMatchObject({
      treeId: TREE_ONE,
      type: "Ended dormancy",
      date: expect.any(String),
    });
  });
});
