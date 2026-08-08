import { Router, type IRouter } from "express";
import { db, feedbackTable } from "@workspace/db";
import { insertFeedbackSchema } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import type { Request } from "express";

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

export default router;
