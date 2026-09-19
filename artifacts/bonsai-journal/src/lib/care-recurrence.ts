import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  format,
  parseISO,
} from "date-fns";

export function skipExcludedMonths(
  date: Date,
  excludedMonths: number[],
): Date {
  if (new Set(excludedMonths).size >= 12) {
    throw new Error("At least one month must remain available");
  }

  while (excludedMonths.includes(date.getMonth() + 1)) {
    date = addMonths(date, 1);
  }

  return date;
}

export function computeNextDueDate(
  currentDueDate: string,
  intervalValue: number,
  intervalUnit: "days" | "weeks" | "months" | "years",
  excludedMonths: number[],
): string {
  const today = new Date();
  const parsedCurrentDueDate = parseISO(currentDueDate);
  const startDate =
    parsedCurrentDueDate > today ? parsedCurrentDueDate : today;
  let nextDate: Date;

  switch (intervalUnit) {
    case "weeks":
      nextDate = addWeeks(startDate, intervalValue);
      break;
    case "months":
      nextDate = addMonths(startDate, intervalValue);
      break;
    case "years":
      nextDate = addYears(startDate, intervalValue);
      break;
    case "days":
    default:
      nextDate = addDays(startDate, intervalValue);
      break;
  }

  return format(skipExcludedMonths(nextDate, excludedMonths), "yyyy-MM-dd");
}