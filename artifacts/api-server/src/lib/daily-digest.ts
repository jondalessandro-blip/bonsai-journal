export interface DigestReminder {
  userId: string | null;
  dueDate: string;
  completed: boolean;
  archivedDate: string | null;
}

export interface DigestCounts {
  dueToday: number;
  overdue: number;
}

export function getTorontoDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function countDigestRemindersByUser(
  reminders: DigestReminder[],
  date: string,
): Map<string, DigestCounts> {
  const counts = new Map<string, DigestCounts>();
  for (const reminder of reminders) {
    if (
      !reminder.userId ||
      reminder.completed ||
      reminder.archivedDate !== null ||
      reminder.dueDate > date
    ) {
      continue;
    }

    const userCounts = counts.get(reminder.userId) ?? { dueToday: 0, overdue: 0 };
    if (reminder.dueDate === date) userCounts.dueToday += 1;
    else userCounts.overdue += 1;
    counts.set(reminder.userId, userCounts);
  }
  return counts;
}

export function formatDigestBody({ dueToday, overdue }: DigestCounts): string | null {
  const parts: string[] = [];
  if (dueToday > 0) {
    parts.push(`${dueToday} ${dueToday === 1 ? "task" : "tasks"} due today`);
  }
  if (overdue > 0) {
    parts.push(`${overdue} ${overdue === 1 ? "task" : "tasks"} overdue`);
  }
  return parts.length ? parts.join(", ") : null;
}
