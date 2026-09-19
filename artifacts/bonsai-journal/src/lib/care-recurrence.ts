import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  format,
} from "date-fns";

export function computeNextDueDate(
  intervalValue: number,
  intervalUnit: "days" | "weeks" | "months" | "years",
  excludedMonths: number[],
): string {
  if (new Set(excludedMonths).size >= 12) {
    throw new Error("At least one month must remain available");
  }

  const today = new Date();
  let nextDate: Date;

  switch (intervalUnit) {
    case "weeks":
      nextDate = addWeeks(today, intervalValue);
      break;
    case "months":
      nextDate = addMonths(today, intervalValue);
      break;
    case "years":
      nextDate = addYears(today, intervalValue);
      break;
    case "days":
    default:
      nextDate = addDays(today, intervalValue);
      break;
  }

  while (excludedMonths.includes(nextDate.getMonth() + 1)) {
    nextDate = addMonths(nextDate, 1);
  }

  return format(nextDate, "yyyy-MM-dd");
}