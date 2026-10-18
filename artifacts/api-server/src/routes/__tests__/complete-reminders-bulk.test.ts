import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import {
  computeNextDueDate,
  type RecurrenceIntervalUnit,
} from "../../lib/care-recurrence";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: vi.fn(),
}));

const {
  mockTransaction,
  state,
  mockInArray,
  lockCalls,
  treesTable,
  careRemindersTable,
  careLogsTable,
} = vi.hoisted(() => {
  const state: {
    reminders: Array<Record<string, any>>;
    logs: Array<Record<string, any>>;
  } = { reminders: [], logs: [] };
  let nextLogId = 1;
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
  const careLogsTable = { id: "logs.id" };
  const mockInArray = vi.fn((column: unknown, values: unknown[]) => ({
    kind: "inArray",
    column,
    values,
  }));
  const lockCalls: unknown[] = [];

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
        insert: (table: unknown) => ({
          values: (values: Array<Record<string, unknown>>) => ({
            returning: async () => {
              if (table !== careLogsTable) throw new Error("Unexpected insert table");
              const inserted = values.map((value) => ({
                id: `dddddddd-0000-0000-0000-${String(nextLogId++).padStart(12, "0")}`,
                ...value,
                createdAt: new Date("2026-06-10T12:00:00.000Z"),
              }));
              state.logs.push(...inserted);
              return inserted;
            },
          }),
        }),
        update: (table: unknown) => ({
          set: (changes: Record<string, unknown>) => ({
            where: async (condition: any) => {
              if (table !== careRemindersTable) throw new Error("Unexpected update table");
              const reminder = state.reminders.find(
                (item) => item.id === condition.value,
              );
              if (reminder) Object.assign(reminder, changes);
            },
          }),
        }),
        delete: (table: unknown) => ({
          where: async (condition: any) => {
            if (table !== careRemindersTable) throw new Error("Unexpected delete table");
            const ids = condition.values as string[];
            state.reminders = state.reminders.filter(
              (reminder) => !ids.includes(reminder.id),
            );
          },
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
    treesTable,
    careRemindersTable,
    careLogsTable,
  };
});

vi.mock("@workspace/db", () => ({
  db: { transaction: mockTransaction },
  treesTable,
  careLogsTable,
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

const USER_ID = "user_bulk_complete";
const TREE_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const REMINDER_ONE = "bbbbbbbb-0000-0000-0000-000000000001";
const REMINDER_TWO = "bbbbbbbb-0000-0000-0000-000000000002";
const TODAY = "2026-06-10";

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

function completeRequest(
  body: Record<string, unknown>,
): request.Test {
  return request(app).post("/api/reminders/complete-bulk").send(body);
}

function singleBody(reminderIds = [REMINDER_ONE]) {
  return {
    reminderIds,
    dateMode: "single",
    date: TODAY,
    today: TODAY,
  };
}

describe("POST /reminders/complete-bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuth).mockReturnValue({ userId: USER_ID } as never);
    state.reminders = [];
    state.logs = [];
    lockCalls.length = 0;
  });

  it("logs a one-time reminder with the requested date and notes, then deletes it", async () => {
    state.reminders = [makeReminder()];

    const response = await completeRequest(singleBody());

    expect(response.status).toBe(200);
    expect(lockCalls).toEqual([["update", { of: careRemindersTable }]]);
    expect(response.body).toMatchObject({
      completedCount: 1,
      logs: [
        {
          treeId: TREE_ID,
          type: "Watering",
          date: TODAY,
          notes: "Check the soil",
        },
      ],
      rescheduled: [],
      deletedReminderIds: [REMINDER_ONE],
    });
    expect(state.logs).toHaveLength(1);
    expect(state.reminders).toHaveLength(0);
  });

  it("logs a recurring reminder and advances its due date using the supplied today", async () => {
    state.reminders = [
      makeReminder({
        dueDate: "2026-06-01",
        recurring: true,
        intervalValue: 2,
        intervalUnit: "weeks",
      }),
    ];

    const response = await completeRequest(singleBody());

    expect(response.status).toBe(200);
    expect(response.body.rescheduled).toEqual([
      { reminderId: REMINDER_ONE, newDueDate: "2026-06-24" },
    ]);
    expect(state.logs[0]).toMatchObject({ date: TODAY, notes: "Check the soil" });
    expect(state.reminders[0]).toMatchObject({
      dueDate: "2026-06-24",
      completed: false,
    });
  });

  it("skips excluded months and clamps the recurrence from a month end", async () => {
    state.reminders = [
      makeReminder({
        dueDate: "2026-03-31",
        recurring: true,
        intervalValue: 1,
        intervalUnit: "months",
        excludedMonths: [4],
      }),
    ];

    const response = await completeRequest({
      reminderIds: [REMINDER_ONE],
      dateMode: "scheduled",
      today: "2026-03-31",
    });

    expect(response.status).toBe(200);
    expect(response.body.rescheduled[0].newDueDate).toBe("2026-05-30");
  });

  it("clamps January 31 plus one month to the end of February", async () => {
    state.reminders = [
      makeReminder({
        dueDate: "2026-01-31",
        recurring: true,
        intervalValue: 1,
        intervalUnit: "months",
      }),
    ];

    const response = await completeRequest({
      reminderIds: [REMINDER_ONE],
      dateMode: "scheduled",
      today: "2026-01-31",
    });

    expect(response.status).toBe(200);
    expect(response.body.logs[0].date).toBe("2026-01-31");
    expect(response.body.rescheduled[0].newDueDate).toBe("2026-02-28");
  });

  it("uses each reminder's own due date in scheduled mode", async () => {
    state.reminders = [
      makeReminder({ id: REMINDER_ONE, dueDate: "2026-06-08" }),
      makeReminder({
        id: REMINDER_TWO,
        dueDate: "2026-06-09",
        notes: "Second task",
      }),
    ];

    const response = await completeRequest({
      reminderIds: [REMINDER_ONE, REMINDER_TWO],
      dateMode: "scheduled",
      date: "2026-01-01",
      today: TODAY,
    });

    expect(response.status).toBe(200);
    expect(response.body.logs.map((log: any) => log.date)).toEqual([
      "2026-06-08",
      "2026-06-09",
    ]);
    expect(response.body.logs.map((log: any) => log.notes)).toEqual([
      "Check the soil",
      "Second task",
    ]);
  });

  it("uses the shared date in single mode", async () => {
    state.reminders = [
      makeReminder({ dueDate: "2026-06-08" }),
      makeReminder({ id: REMINDER_TWO, dueDate: "2026-06-09" }),
    ];

    const response = await completeRequest({
      reminderIds: [REMINDER_ONE, REMINDER_TWO],
      dateMode: "single",
      date: "2026-06-10",
      today: TODAY,
    });

    expect(response.status).toBe(200);
    expect(response.body.logs.map((log: any) => log.date)).toEqual([
      "2026-06-10",
      "2026-06-10",
    ]);
  });

  it("rejects a future log date without writing or deleting anything", async () => {
    state.reminders = [makeReminder()];

    const response = await completeRequest({
      ...singleBody(),
      date: "2026-06-11",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/later than today/i);
    expect(state.logs).toHaveLength(0);
    expect(state.reminders).toHaveLength(1);
  });

  it("rejects scheduled reminders that are not due yet without writing", async () => {
    state.reminders = [makeReminder({ dueDate: "2026-06-11" })];

    const response = await completeRequest({
      reminderIds: [REMINDER_ONE],
      dateMode: "scheduled",
      today: TODAY,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/later than today/i);
    expect(state.logs).toHaveLength(0);
    expect(state.reminders).toHaveLength(1);
  });

  it("rejects the whole batch when a reminder is missing or owned by another user", async () => {
    state.reminders = [
      makeReminder(),
      makeReminder({
        id: REMINDER_TWO,
        treeOwnerId: "another-user",
        dueDate: TODAY,
      }),
    ];

    const response = await completeRequest(singleBody([REMINDER_ONE, REMINDER_TWO]));

    expect(response.status).toBe(404);
    expect(response.body.error).toMatch(/not owned/i);
    expect(state.logs).toHaveLength(0);
    expect(state.reminders).toHaveLength(2);
  });

  it("rejects the whole batch when any reminder is already completed", async () => {
    state.reminders = [
      makeReminder(),
      makeReminder({
        id: REMINDER_TWO,
        completed: true,
      }),
    ];

    const response = await completeRequest(singleBody([REMINDER_ONE, REMINDER_TWO]));

    expect(response.status).toBe(404);
    expect(state.logs).toHaveLength(0);
    expect(state.reminders).toHaveLength(2);
  });

  it("deduplicates reminder IDs before loading and counts each reminder once", async () => {
    state.reminders = [makeReminder()];

    const response = await completeRequest(
      singleBody([REMINDER_ONE, REMINDER_ONE, REMINDER_ONE]),
    );

    expect(response.status).toBe(200);
    expect(response.body.completedCount).toBe(1);
    expect(response.body.logs).toHaveLength(1);
    expect(response.body.deletedReminderIds).toEqual([REMINDER_ONE]);
    expect(mockInArray).toHaveBeenCalledWith("reminders.id", [REMINDER_ONE]);
  });

  it("rejects recurring reminders when all months are excluded without writing", async () => {
    state.reminders = [
      makeReminder({
        recurring: true,
        intervalValue: 1,
        intervalUnit: "months",
        excludedMonths: Array.from({ length: 12 }, (_, index) => index + 1),
      }),
    ];

    const response = await completeRequest(singleBody());

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/all 12 months/i);
    expect(state.logs).toHaveLength(0);
    expect(state.reminders).toHaveLength(1);
  });
});

describe("server recurrence date parity with the website helper", () => {
  const cases: Array<{
    dueDate: string;
    today: string;
    interval: number;
    unit: RecurrenceIntervalUnit;
    excludedMonths: number[];
  }> = [
    {
      dueDate: "2026-01-31",
      today: "2026-01-31",
      interval: 1,
      unit: "months",
      excludedMonths: [],
    },
    {
      dueDate: "2025-11-20",
      today: "2026-02-03",
      interval: 2,
      unit: "weeks",
      excludedMonths: [],
    },
    {
      dueDate: "2026-03-31",
      today: "2026-03-31",
      interval: 1,
      unit: "months",
      excludedMonths: [4, 6],
    },
    {
      dueDate: "2024-02-29",
      today: "2024-02-29",
      interval: 1,
      unit: "years",
      excludedMonths: [],
    },
  ];

  it.each(cases)(
    "matches the frontend helper for $unit from $dueDate",
    async ({ dueDate, today, interval, unit, excludedMonths }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(`${today}T12:00:00.000Z`));
      try {
        const frontend = await vi.importActual<{
          computeNextDueDate: (
            currentDueDate: string,
            intervalValue: number,
            intervalUnit: RecurrenceIntervalUnit,
            excludedMonths: number[],
          ) => string;
        }>("../../../../bonsai-journal/src/lib/care-recurrence.ts");
        expect(
          computeNextDueDate(dueDate, interval, unit, excludedMonths, today),
        ).toBe(
          frontend.computeNextDueDate(
            dueDate,
            interval,
            unit,
            excludedMonths,
          ),
        );
      } finally {
        vi.useRealTimers();
      }
    },
  );
});
