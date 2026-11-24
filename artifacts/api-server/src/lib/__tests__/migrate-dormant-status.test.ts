import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db, pool, careLogsTable, treesTable } from "@workspace/db";
import { migrateDormantHealthStatus } from "../migrate-dormant-status";

const testUserId = `dormancy-migration-test-${randomUUID()}`;

const historyDate = "2025-03-12";
const unknownHistoryDate = "2025-03-21";
const fallbackUpdatedAt = new Date("2025-04-23T16:45:00.000Z");
const nullStatusUpdatedAt = new Date("2025-05-02T08:30:00.000Z");

describe("migrateDormantHealthStatus against the dev database", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("restores prior status and dormancy dates once, while leaving NULL status untouched", async () => {
    try {
      const insertedTrees = await db
        .insert(treesTable)
        .values([
          {
            userId: testUserId,
            name: "Dormancy migration: latest history",
            status: "Dormant",
            isDormant: false,
            dormantSince: null,
            updatedAt: new Date("2025-04-01T12:00:00.000Z"),
          },
          {
            userId: testUserId,
            name: "Dormancy migration: no history",
            status: "Dormant",
            isDormant: false,
            dormantSince: null,
            updatedAt: fallbackUpdatedAt,
          },
          {
            userId: testUserId,
            name: "Dormancy migration: NULL status",
            status: null,
            isDormant: false,
            dormantSince: null,
            updatedAt: nullStatusUpdatedAt,
          },
          {
            userId: testUserId,
            name: "Dormancy migration: unknown history",
            status: "Dormant",
            isDormant: false,
            dormantSince: null,
            updatedAt: new Date("2025-04-29T10:15:00.000Z"),
          },
        ])
        .returning({ id: treesTable.id, name: treesTable.name });

      const historyTree = insertedTrees.find((tree) => tree.name.endsWith("latest history"))!;
      const noHistoryTree = insertedTrees.find((tree) => tree.name.endsWith("no history"))!;
      const nullStatusTree = insertedTrees.find((tree) => tree.name.endsWith("NULL status"))!;
      const unknownHistoryTree = insertedTrees.find((tree) => tree.name.endsWith("unknown history"))!;

      await db.insert(careLogsTable).values([
        {
          treeId: historyTree.id,
          type: "Status Change",
          date: "2025-02-01",
          notes: "Healthy → Dormant",
          createdAt: new Date("2025-02-01T09:00:00.000Z"),
        },
        {
          treeId: historyTree.id,
          type: "Status Change",
          date: historyDate,
          notes: "Thriving → Dormant",
          createdAt: new Date("2025-03-12T09:00:00.000Z"),
        },
        {
          treeId: unknownHistoryTree.id,
          type: "Status Change",
          date: unknownHistoryDate,
          notes: "Unknown → Dormant",
          createdAt: new Date("2025-03-21T09:00:00.000Z"),
        },
      ]);

      await expect(migrateDormantHealthStatus({ userId: testUserId })).resolves.toBe(3);

      const firstRunTrees = await db
        .select()
        .from(treesTable)
        .where(inArray(treesTable.id, insertedTrees.map((tree) => tree.id)));
      const firstRunLogs = await db
        .select()
        .from(careLogsTable)
        .where(inArray(careLogsTable.treeId, insertedTrees.map((tree) => tree.id)));

      const firstRunHistoryTree = firstRunTrees.find((tree) => tree.id === historyTree.id)!;
      const firstRunNoHistoryTree = firstRunTrees.find((tree) => tree.id === noHistoryTree.id)!;
      const firstRunNullStatusTree = firstRunTrees.find((tree) => tree.id === nullStatusTree.id)!;
      const firstRunUnknownHistoryTree = firstRunTrees.find((tree) => tree.id === unknownHistoryTree.id)!;

      expect(firstRunHistoryTree.status).toBe("Thriving");
      expect(firstRunHistoryTree.isDormant).toBe(true);
      expect(firstRunHistoryTree.dormantSince?.toISOString().slice(0, 10)).toBe(historyDate);
      expect(firstRunHistoryTree.updatedAt.toISOString()).toBe("2025-04-01T12:00:00.000Z");

      expect(firstRunNoHistoryTree.status).toBe("Healthy");
      expect(firstRunNoHistoryTree.isDormant).toBe(true);
      expect(firstRunNoHistoryTree.dormantSince?.toISOString().slice(0, 10)).toBe("2025-04-23");
      expect(firstRunNoHistoryTree.updatedAt.toISOString()).toBe(fallbackUpdatedAt.toISOString());

      expect(firstRunNullStatusTree.status).toBeNull();
      expect(firstRunNullStatusTree.isDormant).toBe(false);
      expect(firstRunNullStatusTree.dormantSince).toBeNull();
      expect(firstRunNullStatusTree.updatedAt.toISOString()).toBe(nullStatusUpdatedAt.toISOString());

      expect(firstRunUnknownHistoryTree.status).toBe("Healthy");
      expect(firstRunUnknownHistoryTree.isDormant).toBe(true);
      expect(firstRunUnknownHistoryTree.dormantSince?.toISOString().slice(0, 10))
        .toBe(unknownHistoryDate);
      expect(firstRunUnknownHistoryTree.updatedAt.toISOString())
        .toBe("2025-04-29T10:15:00.000Z");

      await expect(migrateDormantHealthStatus({ userId: testUserId })).resolves.toBe(0);

      const secondRunLogs = await db
        .select()
        .from(careLogsTable)
        .where(inArray(careLogsTable.treeId, insertedTrees.map((tree) => tree.id)));
      const beganLogs = secondRunLogs.filter((log) => log.type === "Began dormancy");
      expect(beganLogs).toHaveLength(3);
      expect(beganLogs.filter((log) => log.treeId === historyTree.id).map((log) => log.date))
        .toEqual([historyDate]);
      expect(beganLogs.filter((log) => log.treeId === noHistoryTree.id).map((log) => log.date))
        .toEqual(["2025-04-23"]);
      expect(beganLogs.some((log) => log.treeId === nullStatusTree.id)).toBe(false);
      expect(beganLogs.filter((log) => log.treeId === unknownHistoryTree.id).map((log) => log.date))
        .toEqual([unknownHistoryDate]);

      console.info(
        "Real dev database rows after two migration runs:",
        JSON.stringify([
          {
            name: firstRunHistoryTree.name,
            status: firstRunHistoryTree.status,
            isDormant: firstRunHistoryTree.isDormant,
            dormantSince: firstRunHistoryTree.dormantSince?.toISOString(),
            updatedAt: firstRunHistoryTree.updatedAt.toISOString(),
            beganDormancyEntries: beganLogs.filter((log) => log.treeId === historyTree.id).length,
          },
          {
            name: firstRunNoHistoryTree.name,
            status: firstRunNoHistoryTree.status,
            isDormant: firstRunNoHistoryTree.isDormant,
            dormantSince: firstRunNoHistoryTree.dormantSince?.toISOString(),
            updatedAt: firstRunNoHistoryTree.updatedAt.toISOString(),
            beganDormancyEntries: beganLogs.filter((log) => log.treeId === noHistoryTree.id).length,
          },
          {
            name: firstRunNullStatusTree.name,
            status: firstRunNullStatusTree.status,
            isDormant: firstRunNullStatusTree.isDormant,
            dormantSince: firstRunNullStatusTree.dormantSince,
            updatedAt: firstRunNullStatusTree.updatedAt.toISOString(),
            beganDormancyEntries: beganLogs.filter((log) => log.treeId === nullStatusTree.id).length,
          },
          {
            name: firstRunUnknownHistoryTree.name,
            status: firstRunUnknownHistoryTree.status,
            isDormant: firstRunUnknownHistoryTree.isDormant,
            dormantSince: firstRunUnknownHistoryTree.dormantSince?.toISOString(),
            updatedAt: firstRunUnknownHistoryTree.updatedAt.toISOString(),
            beganDormancyEntries: beganLogs.filter((log) => log.treeId === unknownHistoryTree.id).length,
          },
        ], null, 2),
      );
    } finally {
      await db.delete(treesTable).where(eq(treesTable.userId, testUserId));
    }
  });
});
