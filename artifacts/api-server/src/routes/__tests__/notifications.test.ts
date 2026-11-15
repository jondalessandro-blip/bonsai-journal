import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: vi.fn(),
}));

const {
  state,
  pushSubscriptionsTable,
  careRemindersTable,
  treesTable,
  mockSelect,
  mockDelete,
  mockInsert,
  mockUpdate,
  mockSendNotification,
  mockSetVapidDetails,
} = vi.hoisted(() => {
  const pushSubscriptionsTable = {
    id: "push_subscriptions.id",
    userId: "push_subscriptions.userId",
    endpoint: "push_subscriptions.endpoint",
    p256dh: "push_subscriptions.p256dh",
    auth: "push_subscriptions.auth",
    userAgent: "push_subscriptions.userAgent",
    lastDigestDate: "push_subscriptions.lastDigestDate",
    createdAt: "push_subscriptions.createdAt",
  };
  const careRemindersTable = {
    treeId: "care_reminders.treeId",
    dueDate: "care_reminders.dueDate",
    completed: "care_reminders.completed",
  };
  const treesTable = {
    id: "trees.id",
    userId: "trees.userId",
    archivedDate: "trees.archivedDate",
  };
  const state: {
    subscriptions: Array<Record<string, any>>;
    reminders: Array<Record<string, any>>;
  } = { subscriptions: [], reminders: [] };
  const getConditionValue = (condition: any, column: unknown): unknown => {
    if (!condition || typeof condition !== "object") return undefined;
    if (condition.kind === "eq" && condition.column === column) return condition.value;
    for (const child of condition.args ?? []) {
      const value = getConditionValue(child, column);
      if (value !== undefined) return value;
    }
    return undefined;
  };

  const mockSelect = vi.fn(() => {
    let table: unknown;
    const chain: Record<string, any> = {};
    chain.from = (value: unknown) => {
      table = value;
      return chain;
    };
    chain.innerJoin = () => chain;
    chain.where = () => chain;
    chain.groupBy = () => chain;
    chain.then = (
      resolve: (rows: Array<Record<string, any>>) => unknown,
      reject?: (reason: unknown) => unknown,
    ) =>
      Promise.resolve(
        table === pushSubscriptionsTable ? state.subscriptions : state.reminders,
      ).then(resolve, reject);
    return chain;
  });

  const mockDelete = vi.fn(() => {
    let removedRows: Array<Record<string, any>> = [];
    const chain: Record<string, any> = {};
    chain.where = (condition: unknown) => {
      const id = getConditionValue(condition, pushSubscriptionsTable.id);
      const endpoint = getConditionValue(condition, pushSubscriptionsTable.endpoint);
      const userId = getConditionValue(condition, pushSubscriptionsTable.userId);
      const matches = (row: Record<string, any>) =>
        (id === undefined || row.id === id) &&
        (endpoint === undefined || row.endpoint === endpoint) &&
        (userId === undefined || row.userId === userId);
      removedRows = state.subscriptions.filter(matches);
      state.subscriptions = state.subscriptions.filter((row) => !matches(row));
      return chain;
    };
    chain.returning = () => Promise.resolve(removedRows);
    chain.then = (resolve: (result: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(undefined).then(resolve, reject);
    return chain;
  });

  const mockInsert = vi.fn(() => {
    let values: Record<string, any>;
    const chain: Record<string, any> = {};
    chain.values = (value: Record<string, any>) => {
      values = value;
      return chain;
    };
    chain.onConflictDoUpdate = ({ set }: { set: Record<string, any> }) => {
      const existing = state.subscriptions.find(
        (row) => row.endpoint === values.endpoint,
      );
      if (existing) Object.assign(existing, set);
      else {
        state.subscriptions.push({
          id: `subscription-${state.subscriptions.length + 1}`,
          lastDigestDate: null,
          ...values,
        });
      }
      return chain;
    };
    chain.then = (resolve: (result: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(undefined).then(resolve, reject);
    return chain;
  });

  const mockUpdate = vi.fn(() => {
    let values: Record<string, any>;
    const chain: Record<string, any> = {};
    chain.set = (value: Record<string, any>) => {
      values = value;
      return chain;
    };
    chain.where = (condition: unknown) => {
      const id = getConditionValue(condition, pushSubscriptionsTable.id);
      for (const row of state.subscriptions) {
        if (row.id === id) Object.assign(row, values);
      }
      return chain;
    };
    chain.then = (resolve: (result: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(undefined).then(resolve, reject);
    return chain;
  });

  return {
    state,
    pushSubscriptionsTable,
    careRemindersTable,
    treesTable,
    mockSelect,
    mockDelete,
    mockInsert,
    mockUpdate,
    mockSendNotification: vi.fn(),
    mockSetVapidDetails: vi.fn(),
  };
});

vi.mock("@workspace/db", () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    delete: mockDelete,
    update: mockUpdate,
  },
  pushSubscriptionsTable,
  careRemindersTable,
  treesTable,
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const real = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...real,
    and: (...args: unknown[]) => ({ kind: "and", args }),
    eq: (column: unknown, value: unknown) => ({ kind: "eq", column, value }),
    inArray: (column: unknown, value: unknown) => ({ kind: "inArray", column, value }),
    isNull: (column: unknown) => ({ kind: "isNull", column }),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      kind: "sql",
      strings,
      values,
    }),
  };
});

vi.mock("web-push", () => ({
  sendNotification: mockSendNotification,
  setVapidDetails: mockSetVapidDetails,
}));

import app from "../../app";
import { getAuth } from "@clerk/express";
import { countDigestRemindersByUser, formatDigestBody, getTorontoDate } from "../../lib/daily-digest";

const USER_ID = "user_notifications";
const CRON_SECRET = "cron-secret-for-tests";

describe("notification daily digest helpers", () => {
  it.each([
    [{ dueToday: 3, overdue: 0 }, "3 tasks due today"],
    [{ dueToday: 0, overdue: 2 }, "2 tasks overdue"],
    [{ dueToday: 3, overdue: 2 }, "3 tasks due today, 2 tasks overdue"],
    [{ dueToday: 1, overdue: 1 }, "1 task due today, 1 task overdue"],
    [{ dueToday: 0, overdue: 0 }, null],
  ])("formats %o as %s", (counts, expected) => {
    expect(formatDigestBody(counts)).toBe(expected);
  });

  it("uses the America/Toronto calendar date", () => {
    expect(getTorontoDate(new Date("2026-01-01T02:00:00.000Z"))).toBe("2025-12-31");
  });

  it("excludes completed reminders and reminders on archived trees", () => {
    const counts = countDigestRemindersByUser(
      [
        { userId: USER_ID, dueDate: "2026-06-10", completed: false, archivedDate: null },
        { userId: USER_ID, dueDate: "2026-06-09", completed: true, archivedDate: null },
        { userId: USER_ID, dueDate: "2026-06-09", completed: false, archivedDate: "2026-06-01" },
      ],
      "2026-06-10",
    );
    expect(counts.get(USER_ID)).toEqual({ dueToday: 1, overdue: 0 });
  });
});

describe("notification routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VAPID_PUBLIC_KEY", "test-public-key");
    vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key");
    vi.stubEnv("VAPID_SUBJECT", "mailto:test@example.com");
    vi.stubEnv("DIGEST_CRON_SECRET", CRON_SECRET);
    vi.mocked(getAuth).mockReturnValue({ userId: USER_ID } as never);
    state.subscriptions = [];
    state.reminders = [];
    mockSendNotification.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects missing and incorrect cron secrets, and reports missing configuration", async () => {
    const missingHeader = await request(app).post("/api/internal/notifications/send-digest");
    const wrongHeader = await request(app)
      .post("/api/internal/notifications/send-digest")
      .set("x-cron-secret", "wrong");
    expect(missingHeader.status).toBe(401);
    expect(wrongHeader.status).toBe(401);

    vi.stubEnv("DIGEST_CRON_SECRET", "");
    const missingConfig = await request(app)
      .post("/api/internal/notifications/send-digest")
      .set("x-cron-secret", CRON_SECRET);
    expect(missingConfig.status).toBe(503);
  });

  it("returns a clear 503 when VAPID settings are missing", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    const response = await request(app).get("/api/notifications/public-key");

    expect(response.status).toBe(503);
    expect(response.body.error).toContain("VAPID_PUBLIC_KEY");
  });

  it("does not send a digest when the user has no eligible reminders", async () => {
    state.subscriptions = [{
      id: "subscription-1",
      userId: USER_ID,
      endpoint: "https://push.example/device-1",
      p256dh: "p256",
      auth: "auth",
      userAgent: null,
      lastDigestDate: null,
      createdAt: new Date(),
    }];
    state.reminders = [
      { userId: USER_ID, dueDate: "2020-01-01", completed: true, archivedDate: null },
      { userId: USER_ID, dueDate: "2020-01-01", completed: false, archivedDate: "2020-01-02" },
    ];

    const response = await request(app)
      .post("/api/internal/notifications/send-digest")
      .set("x-cron-secret", CRON_SECRET);

    expect(response.status).toBe(200);
    expect(response.body.usersNotified).toBe(0);
    expect(response.body.notificationsSent).toBe(0);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("sends at most one digest per device per Toronto date", async () => {
    state.subscriptions = [{
      id: "subscription-1",
      userId: USER_ID,
      endpoint: "https://push.example/device-1",
      p256dh: "p256",
      auth: "auth",
      userAgent: null,
      lastDigestDate: null,
      createdAt: new Date(),
    }];
    state.reminders = [
      { userId: USER_ID, dueDate: getTorontoDate(), completed: false, archivedDate: null },
    ];

    const sendDigest = () =>
      request(app)
        .post("/api/internal/notifications/send-digest")
        .set("x-cron-secret", CRON_SECRET);
    const first = await sendDigest();
    const second = await sendDigest();

    expect(first.body.notificationsSent).toBe(1);
    expect(second.body.notificationsSent).toBe(0);
    expect(mockSendNotification).toHaveBeenCalledTimes(1);
    expect(state.subscriptions[0].lastDigestDate).toBe(getTorontoDate());
  });

  it("removes subscriptions when the push service returns 410", async () => {
    state.subscriptions = [{
      id: "subscription-1",
      userId: USER_ID,
      endpoint: "https://push.example/device-1",
      p256dh: "p256",
      auth: "auth",
      userAgent: null,
      lastDigestDate: null,
      createdAt: new Date(),
    }];
    const gone = Object.assign(new Error("gone"), { statusCode: 410 });
    mockSendNotification.mockRejectedValue(gone);

    const response = await request(app).post("/api/notifications/test");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ sent: 0, removed: 1 });
    expect(state.subscriptions).toHaveLength(0);
  });

  it("updates an existing endpoint instead of creating a duplicate", async () => {
    const body = {
      endpoint: "https://push.example/device-1",
      keys: { p256dh: "old-p256", auth: "old-auth" },
    };
    await request(app).post("/api/notifications/subscriptions").send(body);
    const updated = await request(app)
      .post("/api/notifications/subscriptions")
      .send({ ...body, keys: { p256dh: "new-p256", auth: "new-auth" } });

    expect(updated.status).toBe(200);
    expect(state.subscriptions).toHaveLength(1);
    expect(state.subscriptions[0]).toMatchObject({
      userId: USER_ID,
      p256dh: "new-p256",
      auth: "new-auth",
    });
  });
});
