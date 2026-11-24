import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: vi.fn(),
}));

const { state, database, treesTable, careLogsTable, careRemindersTable, treePhotosTable } =
  vi.hoisted(() => {
    const treesTable = { id: "trees.id", userId: "trees.userId" };
    const careLogsTable = { id: "care_logs.id" };
    const careRemindersTable = {};
    const treePhotosTable = {};
    const state: { tree: Record<string, any> | null; logs: Record<string, any>[] } = {
      tree: null,
      logs: [],
    };

    const insert = vi.fn(() => ({
      values: (values: Record<string, any>) => ({
        returning: async () => {
          const now = new Date("2026-01-01T00:00:00.000Z");
          state.tree = {
            id: "aaaaaaaa-0000-0000-0000-000000000001",
            userId: "status-validation-user",
            species: null,
            acquiredDate: null,
            archivedDate: null,
            archiveReason: null,
            archiveNotes: null,
            climate: null,
            foliage: null,
            style: null,
            stage: null,
            tags: [],
            notes: null,
            photoUrl: null,
            coverThumb: null,
            status: null,
            isDormant: false,
            dormantSince: null,
            coverPosition: null,
            createdAt: now,
            updatedAt: now,
            ...values,
          };
          return [state.tree];
        },
      }),
    }));

    const transaction = vi.fn(async (callback: (tx: Record<string, any>) => Promise<unknown>) => {
      const tx = {
        select: () => {
          const chain: Record<string, any> = {};
          chain.from = () => chain;
          chain.where = () => chain;
          chain.for = async () => (state.tree ? [{ status: state.tree.status }] : []);
          return chain;
        },
        update: () => ({
          set: (values: Record<string, any>) => ({
            where: () => ({
              returning: async () => {
                if (!state.tree) return [];
                state.tree = { ...state.tree, ...values };
                return [state.tree];
              },
            }),
          }),
        }),
        insert: () => ({
          values: async (values: Record<string, any>) => {
            state.logs.push(values);
          },
        }),
      };
      return callback(tx);
    });

    return {
      state,
      database: { insert, transaction },
      treesTable,
      careLogsTable,
      careRemindersTable,
      treePhotosTable,
    };
  });

vi.mock("@workspace/db", () => ({
  db: database,
  treesTable,
  careLogsTable,
  careRemindersTable,
  treePhotosTable,
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const real = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...real,
    and: (...conditions: unknown[]) => conditions,
    eq: (column: unknown, value: unknown) => ({ column, value }),
  };
});

import app from "../../app";
import { getAuth } from "@clerk/express";

const TREE_ID = "aaaaaaaa-0000-0000-0000-000000000001";

describe("tree health status validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.tree = null;
    state.logs.length = 0;
    vi.mocked(getAuth).mockReturnValue({ userId: "status-validation-user" } as never);
  });

  it("rejects Dormant on create with guidance to use dormancy controls", async () => {
    const response = await request(app)
      .post("/api/trees")
      .send({ name: "Willow", status: "Dormant" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Tree status cannot be 'Dormant'; use the dormancy controls instead.",
    );
    expect(database.insert).not.toHaveBeenCalled();
  });

  it("rejects Dormant on update with the same validation message", async () => {
    const response = await request(app)
      .patch(`/api/trees/${TREE_ID}`)
      .send({ status: "Dormant" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Tree status cannot be 'Dormant'; use the dormancy controls instead.",
    );
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it("continues to accept other existing health statuses", async () => {
    const createResponse = await request(app)
      .post("/api/trees")
      .send({ name: "Willow", status: "Thriving" });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.status).toBe("Thriving");

    state.tree = {
      ...state.tree,
      id: TREE_ID,
      status: "Healthy",
    };
    const updateResponse = await request(app)
      .patch(`/api/trees/${TREE_ID}`)
      .send({ status: "Sick" });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.status).toBe("Sick");
    expect(state.logs).toHaveLength(1);
  });
});
