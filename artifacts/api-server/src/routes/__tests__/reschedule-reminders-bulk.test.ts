import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: vi.fn(),
}));

const {
  mockTransaction,
  state,
  mockInArray,
  lockCalls,
  updateCalls,
  treesTable,
  careRemindersTable,
} = vi.hoisted(() => {
  const state: { reminders: Array<Record<string, any>> } = { reminders: [] };
  const treesTable = { id: "trees.id", userId: "trees.userId" };
  const careRemindersTable = {
    id: "reminders.id",
    treeId: "reminders.treeId",
    type: "reminders.type",
    dueDate: "reminders.dueDate",
    notes: "reminders.notes",
    completed: "reminders.completed",
    recurring: "reminders.recurring",
    intervalValue: "reminders.intervalValue",
    intervalUnit: "reminders.intervalUnit",
    excludedMonths: "reminders.excludedMonths",
  };
  const mockInArray = vi.fn((column: unknown, values: unknown[]) => ({
    kind: "inArray",
    column,
    values,
  }));
  const lockCalls: unknown[] = [];
  const updateCalls: Array<Record<string, unknown>> = [];

  const mockTransaction = vi.fn(
    async (callback: (tx: Record<string, any>) => Promise<void>) => {
      const tx = {
        select: () => {
          const chain: Record<string, any> = {};
          let whereCondition: any;
          chain.from = () => chain;
          chain.innerJoin = () => chain;
          chain.where = (condition: unknown) => {
            whereCondition = condition;
            return chain;
          };
          chain.for = vi.fn(async (mode: unknown, lockOptions: unknown) => {
            lockCalls.push([mode, lockOptions]);
            const conditions = whereCondition?.args ?? [];
            const idFilter = conditions.find(
              (condition: any) => condition.kind === "inArray",
            );
            const userFilter = conditions.find(
              (condition: any) =>
                condition.kind === "eq" && condition.column === treesTable.userId,
            );
            const completedFilter = conditions.find(
              (condition: any) =>
                condition.kind === "eq" &&
                condition.column === careRemindersTable.completed,
            );
            return state.reminders
              .filter(
                (reminder) =>
                  idFilter?.values.includes(reminder.id) &&
                  reminder.treeOwnerId === userFilter?.value &&
                  reminder.completed === completedFilter?.value,
              )
              .map((reminder) => ({ reminder }));
          });
          return chain;
        },
        update: (table: unknown) => ({
          set: (changes: Record<string, unknown>) => ({
            where: async (condition: any) => {
              if (table !== careRemindersTable) {
                throw new Error("Unexpected update table");
              }
              updateCalls.push({ id: condition.value, changes });
              const reminder = state.reminders.find(
                (item) => item.id === condition.value,
              );
              if (reminder) Object.assign(reminder, changes);
            },
          }),
        }),
      };
      return callback(tx);
    },
  );

  return {
    mockTransaction,
    state,
    mockInArray,
    lockCalls,
    updateCalls,
    treesTable,
    careRemindersTable,
  };
});

vi.mock("@workspace/db", () => ({
  db: { transaction: mockTransaction },
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
    inArray: mockInArray,
  };
});

import app from "../../app";
import { getAuth } from "@clerk/express";

const USER_ID = "user_bulk_reschedule";
const TREE_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const REMINDER_ONE = "bbbbbbbb-0000-0000-0000-000000000001";
const REMINDER_TWO = "bbbbbbbb-0000-0000-0000-000000000002";
const TODAY = "2026-06-10";
const NEW_DUE_DATE = "2026-07-04";

function makeReminder(overrides: Record<string, unknown> = {}) {
  return {
    id: REMINDER_ONE,
    treeId: TREE_ID,
    treeOwnerId: USER_ID,
    type: "Watering",
    dueDate: "2026-06-10",
    notes: "Check the soil",
    completed: false,
    recurring: false,
    intervalValue: null,
    intervalUnit: null,
    excludedMonths: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function rescheduleRequest(body: Record<string, unknown>): request.Test {
  return request(app).post("/api/reminders/reschedule-bulk").send(body);
}

function requestBody(reminderIds = [REMINDER_ONE]) {
  return { reminderIds, newDueDate: NEW_DUE_DATE, today: TODAY };
}

describe("POST /reminders/reschedule-bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuth).mockReturnValue({ userId: USER_ID } as never);
    state.reminders = [];
    lockCalls.length = 0;
    updateCalls.length = 0;
  });

  it("moves several reminders and preserves recurring settings", async () => {
    state.reminders = [
      makeReminder(),
      makeReminder({
        id: REMINDER_TWO,
        dueDate: "2026-06-12",
        recurring: true,
        intervalValue: 2,
        intervalUnit: "weeks",
        excludedMonths: [7, 8],
      }),
    ];
    const recurringSettings = {
      recurring: true,
      intervalValue: 2,
      intervalUnit: "weeks",
      excludedMonths: [7, 8],
      type: "Watering",
      notes: "Check the soil",
    };

    const response = await rescheduleRequest(
      requestBody([REMINDER_ONE, REMINDER_TWO]),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      rescheduledCount: 2,
      rescheduled: [
        { reminderId: REMINDER_ONE, newDueDate: NEW_DUE_DATE },
        { reminderId: REMINDER_TWO, newDueDate: NEW_DUE_DATE },
      ],
    });
    expect(lockCalls).toEqual([["update", { of: careRemindersTable }]]);
    expect(state.reminders.map(({ dueDate }) => dueDate)).toEqual([
      NEW_DUE_DATE,
      NEW_DUE_DATE,
    ]);
    expect(state.reminders[1]).toMatchObject(recurringSettings);
    expect(updateCalls).toEqual([
      { id: REMINDER_ONE, changes: { dueDate: NEW_DUE_DATE } },
      { id: REMINDER_TWO, changes: { dueDate: NEW_DUE_DATE } },
    ]);
  });

  it("rejects a new due date earlier than today without changing reminders", async () => {
    state.reminders = [makeReminder()];
    const before = structuredClone(state.reminders);

    const response = await rescheduleRequest({
      ...requestBody(),
      newDueDate: "2026-06-09",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/cannot be earlier than today/i);
    expect(state.reminders).toEqual(before);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ["newDueDate", "2026-02-30"],
    ["today", "2026-06-31"],
  ])("rejects invalid calendar date in %s", async (field, value) => {
    state.reminders = [makeReminder()];

    const response = await rescheduleRequest({
      ...requestBody(),
      [field]: value,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/valid calendar dates/i);
    expect(state.reminders[0].dueDate).toBe("2026-06-10");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("changes nothing when any reminder belongs to another user", async () => {
    state.reminders = [
      makeReminder(),
      makeReminder({ id: REMINDER_TWO, treeOwnerId: "another-user" }),
    ];
    const before = structuredClone(state.reminders);

    const response = await rescheduleRequest(
      requestBody([REMINDER_ONE, REMINDER_TWO]),
    );

    expect(response.status).toBe(404);
    expect(response.body.error).toMatch(/not owned/i);
    expect(state.reminders).toEqual(before);
    expect(updateCalls).toHaveLength(0);
  });

  it("changes nothing when any reminder is already completed", async () => {
    state.reminders = [
      makeReminder(),
      makeReminder({ id: REMINDER_TWO, completed: true }),
    ];
    const before = structuredClone(state.reminders);

    const response = await rescheduleRequest(
      requestBody([REMINDER_ONE, REMINDER_TWO]),
    );

    expect(response.status).toBe(404);
    expect(state.reminders).toEqual(before);
    expect(updateCalls).toHaveLength(0);
  });

  it("handles duplicate reminder IDs once", async () => {
    state.reminders = [makeReminder()];

    const response = await rescheduleRequest(
      requestBody([REMINDER_ONE, REMINDER_ONE, REMINDER_ONE]),
    );

    expect(response.status).toBe(200);
    expect(response.body.rescheduledCount).toBe(1);
    expect(response.body.rescheduled).toEqual([
      { reminderId: REMINDER_ONE, newDueDate: NEW_DUE_DATE },
    ]);
    expect(mockInArray).toHaveBeenCalledWith("reminders.id", [REMINDER_ONE]);
    expect(updateCalls).toHaveLength(1);
  });

  it("keeps the chosen date even when the reminder excludes that month", async () => {
    state.reminders = [
      makeReminder({
        recurring: true,
        intervalValue: 1,
        intervalUnit: "months",
        excludedMonths: [7],
      }),
    ];

    const response = await rescheduleRequest(requestBody());

    expect(response.status).toBe(200);
    expect(response.body.rescheduled[0].newDueDate).toBe(NEW_DUE_DATE);
    expect(state.reminders[0]).toMatchObject({
      dueDate: NEW_DUE_DATE,
      excludedMonths: [7],
      recurring: true,
    });
  });
});
