import { timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { sendNotification, setVapidDetails } from "web-push";
import {
  db,
  careRemindersTable,
  pushSubscriptionsTable,
  treesTable,
} from "@workspace/db";
import {
  DeleteNotificationSubscriptionBody,
  SaveNotificationSubscriptionBody,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import {
  countDigestRemindersByUser,
  formatDigestBody,
  getTorontoDate,
  type DigestReminder,
} from "../lib/daily-digest";

const router: IRouter = Router();
const TEST_NOTIFICATION_LIMIT = 3;
const TEST_NOTIFICATION_WINDOW_MS = 60_000;
const testNotificationAttempts = new Map<string, { count: number; resetAt: number }>();

type Subscription = typeof pushSubscriptionsTable.$inferSelect;
type PushPayload = { title: string; body: string; url: string };

function requireVapidConfiguration(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    res.status(503).json({
      error:
        "Push notifications are not configured. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT.",
    });
    return;
  }

  try {
    setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch {
    logger.error("Push notification VAPID configuration is invalid");
    res.status(503).json({ error: "Push notifications are not configured correctly." });
    return;
  }
  next();
}

function requireCronSecret(req: Request, res: Response, next: NextFunction): void {
  const configuredSecret = process.env.DIGEST_CRON_SECRET;
  if (!configuredSecret) {
    res.status(503).json({
      error: "Daily digest is not configured. Set DIGEST_CRON_SECRET.",
    });
    return;
  }

  const suppliedSecret = req.get("x-cron-secret");
  const expected = Buffer.from(configuredSecret, "utf8");
  const supplied = Buffer.from(suppliedSecret ?? "", "utf8");
  const matches =
    supplied.length === expected.length && timingSafeEqual(supplied, expected);
  if (!matches) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

function rateLimitTestNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const userId = (req as AuthedRequest).userId;
  const now = Date.now();
  for (const [key, value] of testNotificationAttempts) {
    if (value.resetAt <= now) testNotificationAttempts.delete(key);
  }

  const attempt = testNotificationAttempts.get(userId);
  if (!attempt || attempt.resetAt <= now) {
    testNotificationAttempts.set(userId, {
      count: 1,
      resetAt: now + TEST_NOTIFICATION_WINDOW_MS,
    });
    next();
    return;
  }
  if (attempt.count >= TEST_NOTIFICATION_LIMIT) {
    res.setHeader(
      "Retry-After",
      String(Math.max(1, Math.ceil((attempt.resetAt - now) / 1000))),
    );
    res.status(429).json({ error: "Too many test notifications. Try again shortly." });
    return;
  }
  attempt.count += 1;
  next();
}

function getPushStatusCode(error: unknown): number | undefined {
  if (error && typeof error === "object" && "statusCode" in error) {
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    return typeof statusCode === "number" ? statusCode : undefined;
  }
  return undefined;
}

async function removeSubscription(subscription: Subscription): Promise<number> {
  const removed = await db
    .delete(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.id, subscription.id))
    .returning({ id: pushSubscriptionsTable.id });
  return removed.length;
}

async function sendAndCleanUp(
  subscriptions: Subscription[],
  payload: PushPayload,
): Promise<{ sentSubscriptions: Subscription[]; removed: number }> {
  const sentSubscriptions: Subscription[] = [];
  let removed = 0;
  for (const subscription of subscriptions) {
    try {
      await sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
      );
      sentSubscriptions.push(subscription);
    } catch (error) {
      const statusCode = getPushStatusCode(error);
      if (statusCode === 404 || statusCode === 410) {
        try {
          removed += await removeSubscription(subscription);
        } catch (cleanupError) {
          logger.error(
            {
              subscriptionId: subscription.id,
              errorName:
                cleanupError instanceof Error ? cleanupError.name : "UnknownError",
            },
            "Could not remove an expired push subscription",
          );
        }
        continue;
      }
      logger.error(
        {
          subscriptionId: subscription.id,
          statusCode,
          errorName: error instanceof Error ? error.name : "UnknownError",
        },
        "Push notification delivery failed",
      );
    }
  }
  return { sentSubscriptions, removed };
}

router.get(
  "/notifications/public-key",
  requireAuth,
  requireVapidConfiguration,
  (_req, res): void => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
  },
);

router.post(
  "/notifications/subscriptions",
  requireAuth,
  requireVapidConfiguration,
  async (req, res): Promise<void> => {
    const parsed = SaveNotificationSubscriptionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid notification subscription." });
      return;
    }

    const { endpoint, keys } = parsed.data;
    const userId = (req as AuthedRequest).userId;
    await db
      .insert(pushSubscriptionsTable)
      .values({
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: req.get("user-agent") ?? null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptionsTable.endpoint,
        set: {
          userId,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: req.get("user-agent") ?? null,
        },
      });
    res.json({ success: true });
  },
);

router.delete(
  "/notifications/subscriptions",
  requireAuth,
  requireVapidConfiguration,
  async (req, res): Promise<void> => {
    const parsed = DeleteNotificationSubscriptionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid notification endpoint." });
      return;
    }

    await db
      .delete(pushSubscriptionsTable)
      .where(
        and(
          eq(pushSubscriptionsTable.endpoint, parsed.data.endpoint),
          eq(pushSubscriptionsTable.userId, (req as AuthedRequest).userId),
        ),
      );
    res.json({ success: true });
  },
);

router.post(
  "/notifications/test",
  requireAuth,
  requireVapidConfiguration,
  rateLimitTestNotifications,
  async (req, res): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const subscriptions = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.userId, userId));
    const { sentSubscriptions, removed } = await sendAndCleanUp(subscriptions, {
      title: "Bonsai Journal",
      body: "Notifications are working on this device.",
      url: "/",
    });
    res.json({ sent: sentSubscriptions.length, removed });
  },
);

router.post(
  "/internal/notifications/send-digest",
  requireCronSecret,
  requireVapidConfiguration,
  async (_req, res): Promise<void> => {
    const date = getTorontoDate();
    const subscriptions = await db.select().from(pushSubscriptionsTable);
    if (subscriptions.length === 0) {
      res.json({
        date,
        usersNotified: 0,
        notificationsSent: 0,
        subscriptionsRemoved: 0,
      });
      return;
    }

    const userIds = [...new Set(subscriptions.map(({ userId }) => userId))];
    const reminderRows = (await db
      .select({
        userId: treesTable.userId,
        dueDate: careRemindersTable.dueDate,
        completed: careRemindersTable.completed,
        archivedDate: treesTable.archivedDate,
      })
      .from(careRemindersTable)
      .innerJoin(treesTable, eq(careRemindersTable.treeId, treesTable.id))
      .where(
        and(
          inArray(treesTable.userId, userIds),
          isNull(treesTable.archivedDate),
          eq(careRemindersTable.completed, false),
          sql`${careRemindersTable.dueDate} <= ${date}`,
        ),
      )) as DigestReminder[];
    const countsByUser = countDigestRemindersByUser(reminderRows, date);
    const notifiedUsers = new Set<string>();
    let notificationsSent = 0;
    let subscriptionsRemoved = 0;

    for (const [userId, counts] of countsByUser) {
      const body = formatDigestBody(counts);
      if (!body) continue;
      const eligibleSubscriptions = subscriptions.filter(
        (subscription) =>
          subscription.userId === userId && subscription.lastDigestDate !== date,
      );
      if (eligibleSubscriptions.length === 0) continue;

      const { sentSubscriptions, removed } = await sendAndCleanUp(
        eligibleSubscriptions,
        { title: "Bonsai Journal", body, url: "/" },
      );
      subscriptionsRemoved += removed;
      for (const subscription of sentSubscriptions) {
        await db
          .update(pushSubscriptionsTable)
          .set({ lastDigestDate: date })
          .where(eq(pushSubscriptionsTable.id, subscription.id));
        notificationsSent += 1;
        notifiedUsers.add(userId);
      }
    }

    res.json({
      date,
      usersNotified: notifiedUsers.size,
      notificationsSent,
      subscriptionsRemoved,
    });
  },
);

export default router;
