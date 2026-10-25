import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: vi.fn(),
}));

// Stateful DB double: evaluate ownership/filter predicates and persist writes,
// rather than handing each route preselected rows that could hide bad WHEREs.
const { state, tables, database, locks } = vi.hoisted(() => {
  type Row = Record<string, any>;
  type Predicate = (row: Row) => boolean;
  const state: Record<string, Row[]> = { trees: [], reminders: [], logs: [], photos: [] };
  const locks: string[] = [];
  const table = (name: string, fields: string[]) =>
    Object.assign({ tableName: name }, Object.fromEntries(fields.map((key) => [key, `${name}.${key}`])));
  const tables = {
    treesTable: table("trees", ["id", "userId", "name", "species", "acquiredDate", "archivedDate", "archiveReason", "archiveNotes", "climate", "foliage", "style", "stage", "status", "tags", "photoUrl", "coverThumb", "coverPosition", "createdAt", "updatedAt"]),
    careRemindersTable: table("reminders", ["id", "treeId", "type", "dueDate", "notes", "completed", "recurring"]),
    careLogsTable: table("logs", ["id", "treeId"]),
    treePhotosTable: table("photos", ["id", "treeId"]),
  };
  const database: Record<string, any> = {
    select: (columns?: Row) => {
      let source = "";
      let predicate: Predicate = () => true;
      let joined = false;
      let limit = Infinity;
      let offset = 0;
      const execute = () => {
        const rows = state[source].map((row) => {
          const context = { [source]: row };
          if (joined) context.trees = state.trees.find((tree) => tree.id === row.treeId)!;
          return context;
        }).filter(predicate).slice(offset, offset + limit);
        return rows.map((context) => columns
          ? Object.fromEntries(Object.entries(columns).map(([key, column]) => {
            const [name, field] = String(column).split(".");
            return [key, context[name]?.[field]];
          }))
          : { ...context[source] });
      };
      const chain: Record<string, any> = {
        from: (t: Row) => { source = t.tableName; return chain; },
        where: (p: Predicate) => { predicate = p; return chain; },
        innerJoin: () => { joined = true; return chain; },
        orderBy: () => chain,
        limit: (n: number) => { limit = n; return chain; },
        offset: (n: number) => { offset = n; return chain; },
        for: (mode: string) => { locks.push(mode); return Promise.resolve(execute()); },
        then: (resolve: any, reject: any) => Promise.resolve(execute()).then(resolve, reject),
      };
      return chain;
    },
    delete: (t: Row) => ({
      where: (p: Predicate) => {
        const removed = state[t.tableName].filter((row) => p({ [t.tableName]: row }));
        state[t.tableName] = state[t.tableName].filter((row) => !removed.includes(row));
        return { returning: async () => removed };
      },
    }),
    update: (t: Row) => ({
      set: (values: Row) => ({
        where: (p: Predicate) => {
          const rows = state[t.tableName].filter((row) => p({ [t.tableName]: row }));
          rows.forEach((row) => Object.assign(row, values));
          return { returning: async () => rows.map((row) => ({ ...row })) };
        },
      }),
    }),
    insert: (t: Row) => ({
      values: async (values: Row) => {
        state[t.tableName].push({ id: `new-${state[t.tableName].length}`, ...values });
      },
    }),
    transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => {
      const before = structuredClone(state);
      try {
        return await callback(database);
      } catch (error) {
        Object.assign(state, before);
        throw error;
      }
    }),
  };
  return { state, tables, database, locks };
});

vi.mock("@workspace/db", () => ({ db: database, ...tables }));
vi.mock("drizzle-orm", async (importOriginal) => {
  const real = await importOriginal<typeof import("drizzle-orm")>();
  const value = (row: Record<string, any>, column: string) => {
    const [table, key] = column.split(".");
    return row[table]?.[key];
  };
  return {
    ...real,
    and: (...args: any[]) => (row: any) => args.every((p) => p(row)),
    eq: (column: string, expected: unknown) => (row: any) => value(row, column) === expected,
    inArray: (column: string, expected: unknown[]) => (row: any) => expected.includes(value(row, column)),
    isNull: (column: string) => (row: any) => value(row, column) == null,
    isNotNull: (column: string) => (row: any) => value(row, column) != null,
    sql: (_strings: TemplateStringsArray, column: string, cutoff: string) =>
      (row: any) => value(row, column) <= cutoff,
  };
});

import app from "../../app";
import { getAuth } from "@clerk/express";

const ONE = "aaaaaaaa-0000-0000-0000-000000000001";
const TWO = "aaaaaaaa-0000-0000-0000-000000000002";
const FOREIGN = "aaaaaaaa-0000-0000-0000-000000000003";
const TODAY = () => new Date().toISOString().slice(0, 10);
const makeTree = (id: string, userId = "archive-user") => ({
  id, userId, name: "Juniper", tags: [], status: "In development",
  notes: "Keep these tree notes", archivedDate: null, archiveReason: null, archiveNotes: null,
  createdAt: new Date("2026-01-01T12:00:00Z"), updatedAt: new Date("2026-01-01T12:00:00Z"),
});
const makeReminder = (id: string, treeId = ONE, completed = false, recurring = false) => ({
  id, treeId, type: recurring ? "Watering" : "Pruning", dueDate: "2026-10-20",
  completed, recurring, intervalValue: recurring ? 3 : null, intervalUnit: recurring ? "days" : null,
});
const archive = (id = ONE, body: object = {}) => request(app).post(`/api/trees/${id}/archive`).send(body);
const restore = (id = ONE) => request(app).post(`/api/trees/${id}/restore`).send({});

describe("tree archive API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuth).mockReturnValue({ userId: "archive-user" } as never);
    locks.length = 0;
    state.trees = [makeTree(ONE), makeTree(TWO), makeTree(FOREIGN, "someone-else")];
    state.reminders = [makeReminder("planned"), makeReminder("recurring", ONE, false, true), makeReminder("completed", ONE, true)];
    state.logs = [{ id: "existing", treeId: ONE, type: "Pruning", notes: "Keep history" }];
    state.photos = [{ id: "photo", treeId: ONE, note: "Keep photo note" }];
  });

  it("removes only incomplete reminders and preserves history, photos, notes and status", async () => {
    const oldLogs = structuredClone(state.logs);
    const oldPhotos = structuredClone(state.photos);
    const response = await archive(ONE, {
      archivedDate: "2026-10-21", archiveReason: "Gifted", archiveNotes: "To a friend",
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      removedReminderCount: 2,
      tree: { archivedDate: "2026-10-21", archiveReason: "Gifted", archiveNotes: "To a friend", status: "In development", notes: "Keep these tree notes" },
    });
    expect(state.reminders.map((r) => r.id)).toEqual(["completed"]);
    expect(state.logs.slice(0, 1)).toEqual(oldLogs);
    expect(state.photos).toEqual(oldPhotos);
    expect(state.logs[1]).toMatchObject({
      treeId: ONE, type: "Archived", date: "2026-10-21",
      notes: "Gifted\nTo a friend\nRemoved plans: Pruning [2026-10-20], Watering [recurring every 3 days]",
    });
    expect(locks).toEqual(["update"]);
  });

  it("archives twice without changing anything or adding a log", async () => {
    await archive();
    const before = structuredClone(state);
    const response = await archive(ONE, { archivedDate: "2020-01-01", archiveReason: "Changed" });
    expect(response.status).toBe(200);
    expect(response.body.removedReminderCount).toBe(0);
    expect(state).toEqual(before);
  });

  it("caps the removed-plans summary at ten entries", async () => {
    state.reminders = Array.from({ length: 12 }, (_, i) => makeReminder(`r${String(i).padStart(2, "0")}`));
    const response = await archive();
    expect(response.body.removedReminderCount).toBe(12);
    expect(state.logs[1].notes.match(/Pruning \[/g)).toHaveLength(10);
    expect(state.logs[1].notes).toMatch(/and 2 more$/);
  });

  it.each([undefined, "", "not-a-date", "2026-02-30"])("defaults invalid/absent date %s to today", async (archivedDate) => {
    state.reminders = [];
    const response = await archive(ONE, { archivedDate, archiveReason: "", archiveNotes: "" });
    expect(response.status).toBe(200);
    expect(response.body.tree).toMatchObject({ archivedDate: TODAY(), archiveReason: null, archiveNotes: null });
    expect(state.logs[1]).toMatchObject({ date: TODAY(), notes: null });
  });

  it("restores archive fields without recreating plans and is idempotent", async () => {
    await archive(ONE, { archivedDate: "2026-10-21", archiveReason: "Other", archiveNotes: "Stored" });
    const reminders = structuredClone(state.reminders);
    const response = await restore();
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ archivedDate: null, archiveReason: null, archiveNotes: null, status: "In development" });
    expect(state.reminders).toEqual(reminders);
    expect(state.logs[2]).toMatchObject({ type: "Restored", date: TODAY(), notes: "Previously archived on 2026-10-21" });
    const before = structuredClone(state);
    expect((await restore()).status).toBe(200);
    expect(state).toEqual(before);
    expect(locks).toEqual(["update", "update", "update"]);
  });

  it.each([FOREIGN, "missing"])("rejects single archive/restore of missing or unowned tree %s", async (id) => {
    const before = structuredClone(state);
    expect((await archive(id)).status).toBe(404);
    expect((await restore(id)).status).toBe(404);
    expect(state).toEqual(before);
  });

  it("bulk archive validates every owner before making any changes", async () => {
    const before = structuredClone(state);
    const response = await request(app).post("/api/trees/archive/bulk").send({ treeIds: [ONE, FOREIGN] });
    expect(response.status).toBe(404);
    expect(response.body.error).toBe("One or more trees were not found or not owned by the user");
    expect(state).toEqual(before);
    expect(locks).toEqual(["update"]);
  });

  it("bulk deduplicates ids, shares archive fields, and skips archived trees", async () => {
    state.trees[1].archivedDate = "2020-01-01";
    state.reminders.push(makeReminder("old-archived-plan", TWO));
    const response = await request(app).post("/api/trees/archive/bulk").send({
      treeIds: [ONE, ONE, TWO], archivedDate: "2026-10-22", archiveReason: "Sold", archiveNotes: "Together",
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ archivedCount: 1, removedReminderCount: 2 });
    expect(state.trees[0]).toMatchObject({ archivedDate: "2026-10-22", archiveReason: "Sold", archiveNotes: "Together" });
    expect(state.trees[1].archivedDate).toBe("2020-01-01");
    expect(state.reminders.map((r) => r.id)).toEqual(["completed", "old-archived-plan"]);
    expect(state.logs).toHaveLength(2);
  });

  it("bulk archives multiple active trees and totals their removed plans", async () => {
    state.reminders.push(makeReminder("second-plan", TWO));
    const response = await request(app).post("/api/trees/archive/bulk").send({
      treeIds: [ONE, TWO], archivedDate: "invalid", archiveReason: "", archiveNotes: "",
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ archivedCount: 2, removedReminderCount: 3 });
    expect(state.trees.slice(0, 2).every((t) => t.archivedDate === TODAY() && t.archiveReason === null && t.archiveNotes === null)).toBe(true);
    expect(state.logs.filter((l) => l.type === "Archived")).toHaveLength(2);
    expect(database.transaction).toHaveBeenCalledTimes(1);
  });

  it("preview counts only incomplete plans on active trees and changes nothing", async () => {
    state.trees[1].archivedDate = "2020-01-01";
    state.reminders.push(makeReminder("archived-plan", TWO, false, true));
    const before = structuredClone(state);
    const response = await request(app).post("/api/trees/archive/preview").send({ treeIds: [ONE, ONE, TWO] });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ reminderCount: 2, recurringCount: 1 });
    expect(state).toEqual(before);
    expect(locks).toEqual([]);
  });

  it("preview rejects missing or unowned trees without changes", async () => {
    const before = structuredClone(state);
    for (const id of [FOREIGN, "missing"]) {
      const response = await request(app).post("/api/trees/archive/preview").send({ treeIds: [ONE, id] });
      expect(response.status).toBe(404);
    }
    expect(state).toEqual(before);
  });

  it("filters default/active/archived/all lists and upcoming reminders by archive state and owner", async () => {
    await archive();
    // A legacy plan on an archived tree must still be excluded by the join.
    state.reminders.push(makeReminder("legacy-plan"), makeReminder("active-plan", TWO), makeReminder("foreign-plan", FOREIGN));
    for (const [query, expected] of [
      ["", [TWO]], ["?archived=active", [TWO]],
      ["?archived=archived", [ONE]], ["?archived=all", [ONE, TWO]],
    ] as const) {
      const response = await request(app).get(`/api/trees${query}`);
      expect(response.status).toBe(200);
      expect(response.body.map((t: { id: string }) => t.id)).toEqual(expected);
    }
    expect((await request(app).get("/api/trees?archived=invalid")).status).toBe(400);
    const upcoming = await request(app).get("/api/reminders/upcoming?today=2026-10-20");
    expect(upcoming.status).toBe(200);
    expect(upcoming.body.map((r: { id: string }) => r.id)).toEqual(["active-plan"]);
  });

  it.each([
    ["/trees/archive/bulk", {}],
    ["/trees/archive/preview", { treeIds: "bad" }],
    [`/trees/${ONE}/archive`, { archiveReason: 123 }],
    ["/trees/archive/bulk", { treeIds: Array(201).fill(ONE) }],
    ["/trees/archive/preview", { treeIds: Array(201).fill(ONE) }],
  ])("rejects invalid input on %s", async (path, body) => {
    const before = structuredClone(state);
    expect((await request(app).post(`/api${path}`).send(body)).status).toBe(400);
    expect(state).toEqual(before);
  });

  it.each([`/trees/${ONE}/archive`, `/trees/${ONE}/restore`, "/trees/archive/bulk", "/trees/archive/preview"])("requires authentication on %s", async (path) => {
    vi.mocked(getAuth).mockReturnValue({ userId: null } as never);
    expect((await request(app).post(`/api${path}`).send({ treeIds: [ONE] })).status).toBe(401);
    expect(database.transaction).not.toHaveBeenCalled();
  });
});
