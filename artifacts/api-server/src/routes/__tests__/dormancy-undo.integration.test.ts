import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { db, pool, careLogsTable, treesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: vi.fn(),
}));

import app from "../../app";
import { getAuth } from "@clerk/express";

const userId = `dormancy-undo-test-${randomUUID()}`;
const otherUserId = `dormancy-undo-other-${randomUUID()}`;

describe("dormancy undo against the dev database", () => {
  beforeEach(() => {
    vi.mocked(getAuth).mockReturnValue({ userId } as never);
  });

  afterAll(async () => {
    await db.delete(treesTable).where(eq(treesTable.userId, userId));
    await db.delete(treesTable).where(eq(treesTable.userId, otherUserId));
    await pool.end();
  });

  it("undoes a single and bulk change without removing older timeline entries", async () => {
    const previousSince = new Date("2025-01-14T00:00:00.000Z");
    const [singleTree, bulkTreeOne, bulkTreeTwo, otherUsersTree] = await db
      .insert(treesTable)
      .values([
        {
          userId,
          name: "Undo dormancy: single",
          status: "Sick",
          isDormant: false,
          dormantSince: null,
        },
        {
          userId,
          name: "Undo dormancy: bulk one",
          status: "Thriving",
          isDormant: true,
          dormantSince: previousSince,
        },
        {
          userId,
          name: "Undo dormancy: bulk two",
          status: "Healthy",
          isDormant: true,
          dormantSince: new Date("2025-02-18T00:00:00.000Z"),
        },
        {
          userId: otherUserId,
          name: "Undo dormancy: other owner",
          status: "Healthy",
          isDormant: false,
          dormantSince: null,
        },
      ])
      .returning();

    try {
      await db.insert(careLogsTable).values([
        { treeId: singleTree.id, type: "Ended dormancy", date: "2024-11-05" },
        { treeId: bulkTreeOne.id, type: "Began dormancy", date: "2024-12-15" },
        { treeId: bulkTreeTwo.id, type: "Began dormancy", date: "2024-12-18" },
      ]);

      const singleChange = await request(app)
        .post("/api/trees/dormancy/bulk")
        .send({ treeIds: [singleTree.id], dormant: true });
      expect(singleChange.status).toBe(200);
      expect(singleChange.body.updatedCount).toBe(1);
      expect(singleChange.body.undoItems).toHaveLength(1);

      const beganEntryId = singleChange.body.undoItems[0].logId;
      const singleUndo = await request(app)
        .post("/api/trees/dormancy/undo")
        .send({ items: singleChange.body.undoItems });
      expect(singleUndo.status).toBe(200);
      expect(singleUndo.body).toEqual({ restoredCount: 1 });

      const [restoredSingle] = await db.select().from(treesTable)
        .where(eq(treesTable.id, singleTree.id));
      expect(restoredSingle).toMatchObject({
        isDormant: false,
        dormantSince: null,
        status: "Sick",
      });
      const singleLogs = await db.select().from(careLogsTable)
        .where(eq(careLogsTable.treeId, singleTree.id));
      expect(singleLogs.map((log) => log.type)).toEqual(["Ended dormancy"]);
      expect(singleLogs.some((log) => log.id === beganEntryId)).toBe(false);

      const bulkChange = await request(app)
        .post("/api/trees/dormancy/bulk")
        .send({ treeIds: [bulkTreeOne.id, bulkTreeTwo.id], dormant: false });
      expect(bulkChange.status).toBe(200);
      expect(bulkChange.body.updatedCount).toBe(2);
      expect(bulkChange.body.undoItems).toHaveLength(2);

      const endedEntryIds = bulkChange.body.undoItems.map((item: { logId: string }) => item.logId);
      const bulkUndo = await request(app)
        .post("/api/trees/dormancy/undo")
        .send({ items: bulkChange.body.undoItems });
      expect(bulkUndo.status).toBe(200);
      expect(bulkUndo.body).toEqual({ restoredCount: 2 });

      const restoredBulkTrees = await db.select().from(treesTable)
        .where(inArray(treesTable.id, [bulkTreeOne.id, bulkTreeTwo.id]));
      expect(restoredBulkTrees.find((tree) => tree.id === bulkTreeOne.id)).toMatchObject({
        isDormant: true,
        dormantSince: previousSince,
        status: "Thriving",
      });
      expect(restoredBulkTrees.find((tree) => tree.id === bulkTreeTwo.id)).toMatchObject({
        isDormant: true,
        dormantSince: new Date("2025-02-18T00:00:00.000Z"),
        status: "Healthy",
      });

      const bulkLogs = await db.select().from(careLogsTable)
        .where(inArray(careLogsTable.treeId, [bulkTreeOne.id, bulkTreeTwo.id]));
      expect(bulkLogs).toHaveLength(2);
      expect(bulkLogs.map((log) => log.type)).toEqual(["Began dormancy", "Began dormancy"]);
      expect(bulkLogs.some((log) => endedEntryIds.includes(log.id))).toBe(false);

      const unauthorizedBulk = await request(app)
        .post("/api/trees/dormancy/bulk")
        .send({ treeIds: [otherUsersTree.id], dormant: true });
      expect(unauthorizedBulk.status).toBe(404);

      const unauthorizedUndo = await request(app)
        .post("/api/trees/dormancy/undo")
        .send({
          items: [{
            ...singleChange.body.undoItems[0],
            treeId: otherUsersTree.id,
          }],
        });
      expect(unauthorizedUndo.status).toBe(404);

      const bypassDormancy = await request(app)
        .patch(`/api/trees/${otherUsersTree.id}`)
        .send({ isDormant: true });
      expect(bypassDormancy.status).toBe(400);

      const [unchangedOtherTree] = await db.select().from(treesTable)
        .where(eq(treesTable.id, otherUsersTree.id));
      expect(unchangedOtherTree).toMatchObject({ isDormant: false, dormantSince: null });
    } finally {
      await db.delete(treesTable).where(inArray(treesTable.id, [
        singleTree.id,
        bulkTreeOne.id,
        bulkTreeTwo.id,
        otherUsersTree.id,
      ]));
    }
  });
});
