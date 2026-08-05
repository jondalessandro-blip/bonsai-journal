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

const router: IRouter = Router();

// ---- Trees ----

router.get("/trees", async (req, res): Promise<void> => {
  const query = ListTreesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { search, climate, foliage, stage, tag, tags: tagsParam, limit, offset } = query.data;

  // Parse comma-separated tags (sent by the client as String(string[]))
  const tagsList: string[] = tagsParam
    ? tagsParam.split(",").map(t => t.trim()).filter(Boolean)
    : tag ? [tag] : [];

  const pageSize = Math.min(limit ?? 48, 200);
  const pageOffset = offset ?? 0;

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(treesTable.name, `%${search}%`),
        ilike(treesTable.species, `%${search}%`),
        sql`EXISTS (SELECT 1 FROM unnest(${treesTable.tags}) AS _t WHERE _t ILIKE ${'%' + search + '%'})`
      )
    );
  }
  if (climate) {
    conditions.push(eq(treesTable.climate, climate));
  }
  if (foliage) {
    conditions.push(eq(treesTable.foliage, foliage));
  }
  if (stage) {
    conditions.push(eq(treesTable.stage, stage));
  }
  if (tagsList.length > 0) {
    // OR logic: tree must have at least one of the selected tags
    conditions.push(or(...tagsList.map(t => sql`${t} = ANY(${treesTable.tags})`)));
  }

  // Exclude `notes` (large text) from list — detail endpoint returns full record
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
      tags: treesTable.tags,
      photoUrl: treesTable.photoUrl,
      createdAt: treesTable.createdAt,
      updatedAt: treesTable.updatedAt,
    })
    .from(treesTable)
    .where(conditions.length ? and(...conditions) : undefined)
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
    tags: t.tags,
    photoUrl: t.photoUrl,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  })));
});

router.post("/trees", async (req, res): Promise<void> => {
  const parsed = CreateTreeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { tags, ...rest } = parsed.data;
  const [tree] = await db
    .insert(treesTable)
    .values({ ...rest, tags: tags ?? [] })
    .returning();

  res.status(201).json(formatTree(tree));
});

router.get("/trees/:id", async (req, res): Promise<void> => {
  const params = GetTreeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [tree] = await db
    .select()
    .from(treesTable)
    .where(eq(treesTable.id, params.data.id));

  if (!tree) {
    res.status(404).json({ error: "Tree not found" });
    return;
  }

  res.json(formatTree(tree));
});

router.patch("/trees/:id", async (req, res): Promise<void> => {
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

  const [tree] = await db
    .update(treesTable)
    .set(parsed.data)
    .where(eq(treesTable.id, params.data.id))
    .returning();

  if (!tree) {
    res.status(404).json({ error: "Tree not found" });
    return;
  }

  res.json(formatTree(tree));
});

router.delete("/trees/:id", async (req, res): Promise<void> => {
  const params = DeleteTreeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [tree] = await db
    .delete(treesTable)
    .where(eq(treesTable.id, params.data.id))
    .returning();

  if (!tree) {
    res.status(404).json({ error: "Tree not found" });
    return;
  }

  res.sendStatus(204);
});

// ---- Care Logs ----

router.get("/trees/:id/logs", async (req, res): Promise<void> => {
  const params = ListTreeLogsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const logs = await db
    .select()
    .from(careLogsTable)
    .where(eq(careLogsTable.treeId, params.data.id))
    .orderBy(desc(careLogsTable.date));

  res.json(logs.map(formatLog));
});

router.post("/trees/:id/logs", async (req, res): Promise<void> => {
  const params = CreateTreeLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

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

router.patch("/trees/:id/logs/:logId", async (req, res): Promise<void> => {
  const params = DeleteTreeLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

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

router.delete("/trees/:id/logs/:logId", async (req, res): Promise<void> => {
  const params = DeleteTreeLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

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

// ---- Care Reminders (per tree) ----

router.get("/trees/:id/reminders", async (req, res): Promise<void> => {
  const params = ListTreeRemindersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const reminders = await db
    .select()
    .from(careRemindersTable)
    .where(eq(careRemindersTable.treeId, params.data.id))
    .orderBy(careRemindersTable.dueDate);

  res.json(reminders.map(formatReminder));
});

router.post("/trees/:id/reminders", async (req, res): Promise<void> => {
  const params = CreateTreeReminderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

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

router.patch("/trees/:id/reminders/:reminderId", async (req, res): Promise<void> => {
  const params = UpdateTreeReminderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

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

router.delete("/trees/:id/reminders/:reminderId", async (req, res): Promise<void> => {
  const params = DeleteTreeReminderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

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

router.get("/trees/:id/timeline", async (req, res): Promise<void> => {
  const params = GetTreeTimelineParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

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

router.get("/trees/:id/photos", async (req, res): Promise<void> => {
  const params = ListTreePhotosParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const photos = await db
    .select()
    .from(treePhotosTable)
    .where(eq(treePhotosTable.treeId, params.data.id))
    .orderBy(asc(treePhotosTable.takenAt), asc(treePhotosTable.createdAt));

  res.json(photos.map(formatPhoto));
});

router.post("/trees/:id/photos", async (req, res): Promise<void> => {
  const params = CreateTreePhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateTreePhotoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [tree] = await db
    .select({ id: treesTable.id, photoUrl: treesTable.photoUrl })
    .from(treesTable)
    .where(eq(treesTable.id, params.data.id));

  if (!tree) {
    res.status(404).json({ error: "Tree not found" });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const [photo] = await db
    .insert(treePhotosTable)
    .values({
      treeId: params.data.id,
      photoUrl: parsed.data.photoUrl,
      takenAt: parsed.data.takenAt ?? today,
    })
    .returning();

  // Auto-set the tree's cover photo if it doesn't have one yet.
  // This keeps the collection card thumbnail in sync without requiring
  // the client to make a separate PATCH call.
  if (!tree.photoUrl) {
    await db
      .update(treesTable)
      .set({ photoUrl: parsed.data.photoUrl, updatedAt: new Date() })
      .where(eq(treesTable.id, params.data.id));
  }

  res.status(201).json(formatPhoto(photo));
});

router.patch("/trees/:id/photos/:photoId", async (req, res): Promise<void> => {
  const params = UpdateTreePhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

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

router.delete("/trees/:id/photos/:photoId", async (req, res): Promise<void> => {
  const params = DeleteTreePhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

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

  res.sendStatus(204);
});

// ---- Collection stats ----

router.get("/collection/stats", async (_req, res): Promise<void> => {
  const [trees, recentlyAdded] = await Promise.all([
    db.select().from(treesTable),
    db
      .select()
      .from(treesTable)
      .orderBy(sql`${treesTable.createdAt} DESC`)
      .limit(3),
  ]);

  const countBy = (key: "climate" | "foliage") => {
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
    byTag: Array.from(tagCounts.entries()).map(([label, count]) => ({ label, count })),
    recentlyAdded: recentlyAdded.map(formatTree),
  });
});

// ---- Upcoming reminders ----

router.get("/reminders/upcoming", async (_req, res): Promise<void> => {
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
    stage: t.stage,
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
