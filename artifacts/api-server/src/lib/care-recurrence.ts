export type RecurrenceIntervalUnit = "days" | "weeks" | "months" | "years";

function createUtcDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month, day);
  return date;
}

function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Invalid calendar date");
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = createUtcDate(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Invalid calendar date");
  }
  return date;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const targetMonth = createUtcDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + months,
    1,
  );
  const lastDayOfMonth = createUtcDate(
    targetMonth.getUTCFullYear(),
    targetMonth.getUTCMonth() + 1,
    0,
  ).getUTCDate();

  return createUtcDate(
    targetMonth.getUTCFullYear(),
    targetMonth.getUTCMonth(),
    Math.min(date.getUTCDate(), lastDayOfMonth),
  );
}

export function skipExcludedMonths(
  date: Date,
  excludedMonths: number[],
): Date {
  const excluded = new Set(excludedMonths);
  if ([...excluded].filter((month) => month >= 1 && month <= 12).length === 12) {
    throw new Error("At least one month must remain available");
  }

  let result = new Date(date);
  let checkedMonths = 0;
  while (excluded.has(result.getUTCMonth() + 1)) {
    result = addMonths(result, 1);
    checkedMonths += 1;
    if (checkedMonths >= 12) {
      throw new Error("At least one month must remain available");
    }
  }
  return result;
}

export function computeNextDueDate(
  currentDueDate: string,
  intervalValue: number,
  intervalUnit: RecurrenceIntervalUnit,
  excludedMonths: number[],
  today: string,
): string {
  const current = parseDateOnly(currentDueDate);
  const localToday = parseDateOnly(today);
  const start = current > localToday ? current : localToday;
  let nextDate: Date;

  switch (intervalUnit) {
    case "weeks":
      nextDate = addDays(start, intervalValue * 7);
      break;
    case "months":
      nextDate = addMonths(start, intervalValue);
      break;
    case "years":
      nextDate = addMonths(start, intervalValue * 12);
      break;
    case "days":
    default:
      nextDate = addDays(start, intervalValue);
      break;
  }

  if (Number.isNaN(nextDate.getTime())) {
    throw new Error("Invalid recurrence date");
  }
  const adjusted = skipExcludedMonths(nextDate, excludedMonths);
  return [
    String(adjusted.getUTCFullYear()).padStart(4, "0"),
    String(adjusted.getUTCMonth() + 1).padStart(2, "0"),
    String(adjusted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}
