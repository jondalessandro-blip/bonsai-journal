import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { db, feedbackTable } from "@workspace/db";
import { insertFeedbackSchema } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import type { Request } from "express";

const ADMIN_EMAIL = "jon.dalessandro@gmail.com";

const router: IRouter = Router();

router.post("/feedback", requireAuth, async (req: Request, res) => {
  const { userId } = req as AuthedRequest;

  const parsed = insertFeedbackSchema.safeParse({ ...req.body, userId });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const [created] = await db.insert(feedbackTable).values(parsed.data).returning();
  res.status(201).json(created);
});

router.get("/feedback", requireAuth, async (req: Request, res) => {
  const { userId } = req as AuthedRequest;

  const user = await clerkClient().users.getUser(userId);
  const email = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId,
  )?.emailAddress;

  if (email !== ADMIN_EMAIL) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const rows = await db
    .select()
    .from(feedbackTable)
    .orderBy(desc(feedbackTable.createdAt));

  res.json(rows);
});

export default router;
