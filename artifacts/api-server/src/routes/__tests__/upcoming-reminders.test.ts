import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: vi.fn(),
}));

const {
  selectedColumns,
  upcomingRows,
  treesTable,
  careRemindersTable,
  mockSelect,
} =
  vi.hoisted(() => {
    const selectedColumns: { value: Record<string, unknown> | null } = {
      value: null,
    };
    const upcomingRows: { value: Array<Record<string, unknown>> } = { value: [] };
    const treesTable = {
      userId: "trees.userId",
      name: "trees.name",
    };
    const careRemindersTable = {
      id: "care_reminders.id",
      treeId: "care_reminders.treeId",
      type: "care_reminders.type",
      dueDate: "care_reminders.dueDate",
      notes: "care_reminders.notes",
      completed: "care_reminders.completed",
      recurring: "care_reminders.recurring",
    };

    const mockSelect = vi.fn((columns: Record<string, unknown>) => {
      selectedColumns.value = columns;
      const chain: Record<string, any> = {};
      chain.from = () => chain;
      chain.innerJoin = () => chain;
      chain.where = () => chain;
      chain.orderBy = () => chain;
      chain.then = (
        resolve: (rows: Array<Record<string, unknown>>) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve(upcomingRows.value).then(resolve, reject);
      return chain;
    });

    return {
      selectedColumns,
      upcomingRows,
      treesTable,
      careRemindersTable,
      mockSelect,
    };
  });

vi.mock("@workspace/db", () => ({
  db: { select: mockSelect },
  treesTable,
  careLogsTable: {},
  careRemindersTable,
  treePhotosTable: {},
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const real = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...real,
    and: (...args: unknown[]) => ({ kind: "and", args }),
    eq: (column: unknown, value: unknown) => ({ kind: "eq", column, value }),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      kind: "sql",
      strings,
      values,
    }),
  };
});

import app from "../../app";
import { getAuth } from "@clerk/express";

const USER_ID = "user_upcoming_reminders";

describe("GET /api/reminders/upcoming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuth).mockReturnValue({ userId: USER_ID } as never);
    selectedColumns.value = null;
    upcomingRows.value = [];
  });

  it("returns recurring true and defaults a null recurring value to false", async () => {
    upcomingRows.value = [
      {
        id: "reminder-recurring",
        treeId: "tree-one",
        treeName: "Juniper",
        type: "Watering",
        dueDate: "2026-06-09",
        notes: null,
        completed: false,
        recurring: true,
      },
      {
        id: "reminder-one-time",
        treeId: "tree-two",
        treeName: "Maple",
        type: "Pruning",
        dueDate: "2026-06-11",
        notes: null,
        completed: false,
        recurring: null,
      },
    ];

    const response = await request(app)
      .get("/api/reminders/upcoming?today=2026-06-10");

    expect(response.status).toBe(200);
    expect(selectedColumns.value?.recurring).toBe(careRemindersTable.recurring);
    expect(response.body).toMatchObject([
      { id: "reminder-recurring", recurring: true, daysUntilDue: -1 },
      { id: "reminder-one-time", recurring: false, daysUntilDue: 1 },
    ]);
  });
});
