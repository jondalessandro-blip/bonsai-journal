import { Router, type IRouter } from "express";
import { and, asc, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import { db, treesTable, careLogsTable, careRemindersTable, treePhotosTable } from "@workspace/db";
import {
  ListTreesQueryParams,
  CreateTreeBody,
  GetTreeParams,
  UpdateTreeParams,
  UpdateTreeBody,
  DeleteTreeParams,
  ListTreeLogsParams,
  CreateTreeLogParams,
  CreateTreeLogBody,
  DeleteTreeLogParams,
  ListTreeRemindersParams,
  CreateTreeReminderParams,
  CreateTreeReminderBody,
  UpdateTreeReminderParams,
  UpdateTreeReminderBody,
  DeleteTreeReminderParams,
  GetTreeTimelineParams,
  ListTreePhotosParams,
  CreateTreePhotoParams,
  CreateTreePhotoBody,
  UpdateTreePhotoParams,
  UpdateTreePhotoBody,
  DeleteTreePhotoParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import type { Request } from "express";

const router: IRouter = Router();

// Helper: verify a tree belongs to the authenticated user.
// Returns the tree row or sends 404 and returns null.
async function getOwnedTree(
  req: Request,
  res: { status: (n: number) => { json: (o: object) => void } },
  treeId: string,
): Promise<typeof treesTable.$inferSelect | null> {
  const userId = (req as AuthedRequest).userId;
  const [tree] = await db
    .select()
    .from(treesTable)
    .where(and(eq(treesTable.id, treeId), eq(treesTable.userId, userId)));
  if (!tree) {
    res.status(404).json({ error: "Tree not found" });
    return null;
  }
  return tree;
}

// ---- Trees ----

router.get("/trees", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const query = ListTreesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { search, climate, foliage, stage, status, tag, tags: tagsParam, limit, offset } = query.data;

  // `tags` is now a string[] from the generated query schema.
  // `tag` is a single-value legacy alias; merge both into one list.
  const tagsList: string[] = [
    ...(tagsParam ?? []),
    ...(tag ? [tag] : []),
  ].map(t => t.trim()).filter(Boolean);

  const pageSize = Math.min(limit ?? 48, 200);
  const pageOffset = offset ?? 0;

  const conditions = [eq(treesTable.userId, userId)];
  if (search) {
    conditions.push(
      or(
        ilike(treesTable.name, `%${search}%`),
        ilike(treesTable.species, `%${search}%`),
        sql`EXISTS (SELECT 1 FROM unnest(${treesTable.tags}) AS _t WHERE _t ILIKE ${'%' + search + '%'})`
      )!,
    );
  }
  if (climate) conditions.push(eq(treesTable.climate, climate));
  if (foliage) conditions.push(eq(treesTable.foliage, foliage));
  if (stage) conditions.push(eq(treesTable.stage, stage));
  if (status) conditions.push(eq(treesTable.status, status));
  if (tagsList.length > 0) {
    conditions.push(and(...tagsList.map(t => sql`${t} = ANY(${treesTable.tags})`))!);
  }

  const trees = await db
    .select({
      id: treesTable.id,
      name: treesTable.name,
      species: treesTable.species,
      acquiredDate: treesTable.acquiredDate,
      climate: treesTable.climate,
      foliage: treesTable.foliage,
      style: treesTable.style,
      stage: treesTable.stage,
      status: treesTable.status,
      tags: treesTable.tags,
      photoUrl: treesTable.photoUrl,
      coverThumb: treesTable.coverThumb,
      coverPosition: treesTable.coverPosition,
      createdAt: treesTable.createdAt,
      updatedAt: treesTable.updatedAt,
    })
    .from(treesTable)
    .where(and(...conditions))
    .orderBy(treesTable.createdAt)
    .limit(pageSize)
    .offset(pageOffset);

  res.json(trees.map(t => ({
    id: t.id,
    name: t.name,
    species: t.species,
    acquiredDate: t.acquiredDate,
    climate: t.climate,
    foliage: t.foliage,
    style: t.style,
    stage: t.stage,
    status: t.status,
    tags: t.tags,
    photoUrl: t.photoUrl,
    coverThumb: t.coverThumb,
    coverPosition: t.coverPosition ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  })));
});

router.post("/trees", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const parsed = CreateTreeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { tags, ...rest } = parsed.data;
  const [tree] = await db
    .insert(treesTable)
    .values({ ...rest, tags: tags ?? [], userId })
    .returning();

  res.status(201).json(formatTree(tree));
});

router.get("/trees/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetTreeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const tree = await getOwnedTree(req, res, params.data.id);
  if (!tree) return;

  res.json(formatTree(tree));
});

router.patch("/trees/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as unknown as AuthedRequest).userId;
  const params = UpdateTreeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTreeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let tree: typeof treesTable.$inferSelect | undefined;

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ status: treesTable.status })
      .from(treesTable)
      .where(and(eq(treesTable.id, params.data.id), eq(treesTable.userId, userId)))
      .for("update");

    if (!existing) return;

    const [updated] = await tx
      .update(treesTable)
      .set(parsed.data)
      .where(and(eq(treesTable.id, params.data.id), eq(treesTable.userId, userId)))
      .returning();

    if (!updated) return;
    tree = updated;

    const newStatus = parsed.data.status;
    if (newStatus !== undefined && newStatus !== existing.status) {
      const today = new Date().toISOString().slice(0, 10);
      const oldLabel = existing.status ?? "Unknown";
      const newLabel = newStatus ?? "Unknown";
      await tx.insert(careLogsTable).values({
        treeId: updated.id,
        type: "Status Change",
        date: today,
        notes: `${oldLabel} → ${newLabel}`,
      });
    }
  });

  if (!tree) {
    res.status(404).json({ error: "Tree not found" });
    return;
  }

  res.json(formatTree(tree));
});

router.delete("/trees/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as unknown as AuthedRequest).userId;
  const params = DeleteTreeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [tree] = await db
    .delete(treesTable)
    .where(and(eq(treesTable.id, params.data.id), eq(treesTable.userId, userId)))
    .returning();

  if (!tree) {
    res.status(404).json({ error: "Tree not found" });
    return;
  }

  res.sendStatus(204);
});

// ---- Care Logs ----

router.get("/trees/:id/logs", requireAuth, async (req, res): Promise<void> => {
  const params = ListTreeLogsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const tree = await getOwnedTree(req, res, params.data.id);
  if (!tree) return;

  const logs = await db
    .select()
    .from(careLogsTable)
    .where(eq(careLogsTable.treeId, params.data.id))
    .orderBy(desc(careLogsTable.date));

  res.json(logs.map(formatLog));
});

router.post("/trees/:id/logs", requireAuth, async (req, res): Promise<void> => {
  const params = CreateTreeLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const tree = await getOwnedTree(req, res, params.data.id);
  if (!tree) return;

  const parsed = CreateTreeLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [log] = await db
    .insert(careLogsTable)
    .values({ treeId: params.data.id, ...parsed.data })
    .returning();

  res.status(201).json(formatLog(log));
});

router.patch("/trees/:id/logs/:logId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteTreeLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const tree = await getOwnedTree(req, res, params.data.id);
  if (!tree) return;

  const parsed = CreateTreeLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [log] = await db
    .update(careLogsTable)
    .set(parsed.data)
    .where(
      and(
        eq(careLogsTable.id, params.data.logId),
        eq(careLogsTable.treeId, params.data.id),
      ),
    )
    .returning();

  if (!log) {
    res.status(404).json({ error: "Log not found" });
    return;
  }

  res.json(formatLog(log));
});

router.delete("/trees/:id/logs/:logId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteTreeLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const tree = await getOwnedTree(req, res, params.data.id);
  if (!tree) return;

  const [log] = await db
    .delete(careLogsTable)
    .where(
      and(
        eq(careLogsTable.id, params.data.logId),
        eq(careLogsTable.treeId, params.data.id),
      ),
    )
    .returning();

  if (!log) {
    res.status(404).json({ error: "Log not found" });
    return;
  }

  res.sendStatus(204);
});

// ---- Care Reminders ----

router.get("/trees/:id/reminders", requireAuth, async (req, res): Promise<void> => {
  const params = ListTreeRemindersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const tree = await getOwnedTree(req, res, params.data.id);
  if (!tree) return;

  const reminders = await db
    .select()
    .from(careRemindersTable)
    .where(eq(careRemindersTable.treeId, params.data.id))
    .orderBy(careRemindersTable.dueDate);

  res.json(reminders.map(formatReminder));
});

router.post("/trees/:id/reminders", requireAuth, async (req, res): Promise<void> => {
  const params = CreateTreeReminderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const tree = await getOwnedTree(req, res, params.data.id);
  if (!tree) return;

  const parsed = CreateTreeReminderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [reminder] = await db
    .insert(careRemindersTable)
    .values({ treeId: params.data.id, ...parsed.data })
    .returning();

  res.status(201).json(formatReminder(reminder));
});

router.patch("/trees/:id/reminders/:reminderId", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateTreeReminderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const tree = await getOwnedTree(req, res, params.data.id);
  if (!tree) return;

  const parsed = UpdateTreeReminderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [reminder] = await db
    .update(careRemindersTable)
    .set(parsed.data)
    .where(
      and(
        eq(careRemindersTable.id, params.data.reminderId),
        eq(careRemindersTable.treeId, params.data.id),
      ),
    )
    .returning();

  if (!reminder) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }

  res.json(formatReminder(reminder));
});

router.delete("/trees/:id/reminders/:reminderId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteTreeReminderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const tree = await getOwnedTree(req, res, params.data.id);
  if (!tree) return;

  const [reminder] = await db
    .delete(careRemindersTable)
    .where(
      and(
        eq(careRemindersTable.id, params.data.reminderId),
        eq(careRemindersTable.treeId, params.data.id),
      ),
    )
    .returning();

  if (!reminder) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }

  res.sendStatus(204);
});

// ---- Timeline ----

router.get("/trees/:id/timeline", requireAuth, async (req, res): Promise<void> => {
  const params = GetTreeTimelineParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const tree = await getOwnedTree(req, res, params.data.id);
  if (!tree) return;

  const [logs, reminders] = await Promise.all([
    db.select().from(careLogsTable).where(eq(careLogsTable.treeId, params.data.id)),
    db.select().from(careRemindersTable).where(eq(careRemindersTable.treeId, params.data.id)),
  ]);

  const timeline = [
    ...logs.map((l) => ({
      id: l.id,
      kind: "log" as const,
      date: l.date,
      type: l.type,
      notes: l.notes,
      completed: null,
    })),
    ...reminders.map((r) => ({
      id: r.id,
      kind: "reminder" as const,
      date: r.dueDate,
      type: r.type,
      notes: r.notes,
      completed: r.completed,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  res.json(timeline);
});

// ---- Progression Photos ----

router.get("/trees/:id/photos", requireAuth, async (req, res): Promise<void> => {
  const params = ListTreePhotosParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const tree = await getOwnedTree(req, res, params.data.id);
  if (!tree) return;

  const photos = await db
    .select()
    .from(treePhotosTable)
    .where(eq(treePhotosTable.treeId, params.data.id))
    .orderBy(
      asc(treePhotosTable.takenAt),
      asc(treePhotosTable.createdAt),
      asc(treePhotosTable.insertionSeq),
    );

  res.json(photos.map(formatPhoto));
});

router.post("/trees/:id/photos", requireAuth, async (req, res): Promise<void> => {
  const params = CreateTreePhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const tree = await getOwnedTree(req, res, params.data.id);
  if (!tree) return;

  const parsed = CreateTreePhotoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const [photo] = await db
    .insert(treePhotosTable)
    .values({
      treeId: params.data.id,
      photoUrl: parsed.data.photoUrl,
      photoThumb: parsed.data.photoThumb ?? null,
      takenAt: parsed.data.takenAt ?? today,
    })
    .returning();

  res.status(201).json(formatPhoto(photo));
});

router.patch("/trees/:id/photos/:photoId", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateTreePhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const tree = await getOwnedTree(req, res, params.data.id);
  if (!tree) return;

  const parsed = UpdateTreePhotoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [photo] = await db
    .update(treePhotosTable)
    .set({ takenAt: parsed.data.takenAt })
    .where(
      and(
        eq(treePhotosTable.id, params.data.photoId),
        eq(treePhotosTable.treeId, params.data.id),
      ),
    )
    .returning();

  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  res.json(formatPhoto(photo));
});

router.delete("/trees/:id/photos/:photoId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteTreePhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const tree = await getOwnedTree(req, res, params.data.id);
  if (!tree) return;

  const [photo] = await db
    .delete(treePhotosTable)
    .where(
      and(
        eq(treePhotosTable.id, params.data.photoId),
        eq(treePhotosTable.treeId, params.data.id),
      ),
    )
    .returning();

  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  // Find the new most-recent remaining photo to use as the cover
  const [newCoverPhoto] = await db
    .select()
    .from(treePhotosTable)
    .where(eq(treePhotosTable.treeId, params.data.id))
    .orderBy(
      desc(treePhotosTable.takenAt),
      desc(treePhotosTable.createdAt),
      desc(treePhotosTable.insertionSeq),
    )
    .limit(1);

  // When the deleted photo was the designated cover its stored focal-point
  // (coverPosition) is no longer valid for the replacement photo, so clear it.
  const deletedWasCover = photo.photoUrl === tree.photoUrl;

  await db
    .update(treesTable)
    .set({
      photoUrl: newCoverPhoto?.photoUrl ?? null,
      coverThumb: newCoverPhoto?.photoThumb ?? null,
      ...(deletedWasCover ? { coverPosition: null } : {}),
    })
    .where(eq(treesTable.id, params.data.id));

  res.sendStatus(204);
});

// ---- Collection stats (scoped to current user) ----

router.get("/collection/stats", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;

  const [trees, recentlyAdded] = await Promise.all([
    db.select().from(treesTable).where(eq(treesTable.userId, userId)),
    db
      .select()
      .from(treesTable)
      .where(eq(treesTable.userId, userId))
      .orderBy(sql`${treesTable.createdAt} DESC`)
      .limit(3),
  ]);

  const countBy = (key: "climate" | "foliage" | "status") => {
    const map = new Map<string, number>();
    for (const t of trees) {
      const val = t[key];
      if (val) map.set(val, (map.get(val) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
  };

  const tagCounts = new Map<string, number>();
  for (const t of trees) {
    for (const tag of t.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  res.json({
    totalTrees: trees.length,
    byClimate: countBy("climate"),
    byFoliage: countBy("foliage"),
    byStatus: countBy("status"),
    byTag: Array.from(tagCounts.entries()).map(([label, count]) => ({ label, count })),
    recentlyAdded: recentlyAdded.map(formatTree),
  });
});

// ---- Upcoming reminders (scoped to current user) ----

router.get("/reminders/upcoming", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const today = new Date();
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);

  const todayStr = today.toISOString().slice(0, 10);
  const in30Str = in30.toISOString().slice(0, 10);

  const rows = await db
    .select({
      id: careRemindersTable.id,
      treeId: careRemindersTable.treeId,
      treeName: treesTable.name,
      type: careRemindersTable.type,
      dueDate: careRemindersTable.dueDate,
      notes: careRemindersTable.notes,
      completed: careRemindersTable.completed,
    })
    .from(careRemindersTable)
    .innerJoin(treesTable, eq(careRemindersTable.treeId, treesTable.id))
    .where(
      and(
        eq(treesTable.userId, userId),
        eq(careRemindersTable.completed, false),
        sql`${careRemindersTable.dueDate} >= ${todayStr}`,
        sql`${careRemindersTable.dueDate} <= ${in30Str}`,
      ),
    )
    .orderBy(careRemindersTable.dueDate);

  res.json(
    rows.map((r) => ({
      ...r,
      daysUntilDue: Math.ceil(
        (new Date(r.dueDate).getTime() - today.setHours(0, 0, 0, 0)) / 86400000,
      ),
    })),
  );
});

// ---- Helpers ----

function formatPhoto(p: typeof treePhotosTable.$inferSelect) {
  return {
    id: p.id,
    treeId: p.treeId,
    photoUrl: p.photoUrl,
    photoThumb: p.photoThumb ?? null,
    takenAt: p.takenAt,
    createdAt: p.createdAt.toISOString(),
  };
}

function formatTree(t: typeof treesTable.$inferSelect) {
  return {
    id: t.id,
    name: t.name,
    species: t.species,
    acquiredDate: t.acquiredDate,
    climate: t.climate,
    foliage: t.foliage,
    style: t.style,
    tags: t.tags,
    notes: t.notes,
    photoUrl: t.photoUrl,
    coverThumb: t.coverThumb ?? null,
    stage: t.stage,
    status: t.status,
    coverPosition: t.coverPosition ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

function formatLog(l: typeof careLogsTable.$inferSelect) {
  return {
    id: l.id,
    treeId: l.treeId,
    type: l.type,
    date: l.date,
    notes: l.notes,
    createdAt: l.createdAt.toISOString(),
  };
}

function formatReminder(r: typeof careRemindersTable.$inferSelect) {
  return {
    id: r.id,
    treeId: r.treeId,
    type: r.type,
    dueDate: r.dueDate,
    notes: r.notes,
    completed: r.completed,
    createdAt: r.createdAt.toISOString(),
  };
}

export default router;
