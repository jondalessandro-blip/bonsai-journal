import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const pushSubscriptionsTable = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    lastDigestDate: text("last_digest_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("push_subscriptions_endpoint_unique").on(table.endpoint)],
);

export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
