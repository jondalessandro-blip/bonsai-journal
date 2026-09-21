// Care calendar engine. Pure functions only: no React, no network, no database.
// Timing is worked out in days (not whole months) so zones do not all collapse into the same month.

export type Part = "early" | "mid" | "late";
export type CareType =
  | "Pruning"
  | "Repotting"
  | "Fertilizing"
  | "Winter Prep"
  | "Watering"
  | "Wiring"
  | "Other";

export type Zone = {
  id: string;
  label: string;
  display: string;
  zone_value: number;
  last_frost: string | null; // "MM-DD", null = frost-free
  first_frost: string | null; // "MM-DD", null = frost-free
  shift_weeks: number; // + means later than zone 5b, - means earlier
};

export type Timing =
  | { kind: "season"; month: number; part: Part; shift?: "spring" | "autumn" | "none" }
  | { kind: "frost"; anchor: "last_frost" | "first_frost"; offset_days: number };

export type Task = {
  id: string;
  title: string;
  care_type: CareType;
  timing: Timing;
  trigger: string;
  desc: string;
  warning: string;
  optional: boolean;
  latest?: { month: number; part: Part };
  zones?: { min?: number; max?: number };
  frost_zones_only?: boolean;
};

export type ZoneNote = { min: number; max: number; note: string };

export type Group = {
  group_id: string;
  label: string;
  icon: string;
  examples: string;
  description: string;
  match: { keywords: string[] };
  tasks: Task[];
  zone_notes: ZoneNote[];
  species_notes: Record<string, string>;
};

export type CalendarTask = Task & {
  group_id: string;
  group_label: string;
  group_icon: string;
  month: number;
  part: Part;
  timeLabel: string; // e.g. "early May"
  dayOfYear: number;
};

export type CalendarMonth = { month: number; monthName: string; tasks: CalendarTask[] };

export type CalendarResult = {
  months: CalendarMonth[];
  zoneNotes: { group_id: string; group_label: string; notes: string[] }[];
};

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Days before the start of each month in a non-leap year.
const CUM_DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const YEAR_DAYS = 365;
const PART_OFFSET: Record<Part, number> = { early: 5, mid: 15, late: 25 };

function dayOfYearFromMMDD(mmdd: string): number {
  const [m, d] = mmdd.split("-").map(Number);
  return CUM_DAYS[m - 1] + d;
}

function seasonDay(month: number, part: Part): number {
  return CUM_DAYS[month - 1] + PART_OFFSET[part];
}

function wrapDay(day: number): number {
  return ((Math.round(day) - 1) % YEAR_DAYS + YEAR_DAYS) % YEAR_DAYS + 1;
}

function dayToMonthPart(day: number): { month: number; part: Part } {
  const d = wrapDay(day);
  let month = 12;
  for (let m = 11; m >= 0; m--) {
    if (d > CUM_DAYS[m]) {
      month = m + 1;
      break;
    }
  }
  const dom = d - CUM_DAYS[month - 1];
  const part: Part = dom <= 10 ? "early" : dom <= 20 ? "mid" : "late";
  return { month, part };
}

/** Returns the day of year this task lands on for this zone, or null if it does not apply there. */
export function resolveTaskDay(task: Task, zone: Zone): number | null {
  if (task.zones) {
    if (task.zones.min !== undefined && zone.zone_value < task.zones.min) return null;
    if (task.zones.max !== undefined && zone.zone_value > task.zones.max) return null;
  }
  if (task.frost_zones_only && (zone.first_frost === null || zone.last_frost === null)) return null;

  const t = task.timing;
  if (t.kind === "frost") {
    const anchor = zone[t.anchor];
    if (anchor === null) return null; // frost-free zone: frost-based tasks do not apply
    return wrapDay(dayOfYearFromMMDD(anchor) + t.offset_days);
  }

  const shiftMode = t.shift ?? "spring";
  const shiftDays =
    shiftMode === "spring" ? zone.shift_weeks * 7 : shiftMode === "autumn" ? -zone.shift_weeks * 7 : 0;
  let day = seasonDay(t.month, t.part) + shiftDays;

  if (task.latest) {
    const limit = seasonDay(task.latest.month, task.latest.part);
    if (day > limit) day = limit;
  }
  return wrapDay(day);
}

export function generateCalendar(
  zone: Zone,
  selectedGroups: Group[],
  options: { includeOptional?: boolean } = {},
): CalendarResult {
  const includeOptional = options.includeOptional ?? false;
  const months: CalendarMonth[] = MONTH_NAMES.map((monthName, i) => ({
    month: i + 1,
    monthName,
    tasks: [],
  }));

  for (const group of selectedGroups) {
    for (const task of group.tasks) {
      if (task.optional && !includeOptional) continue;
      const day = resolveTaskDay(task, zone);
      if (day === null) continue;
      const { month, part } = dayToMonthPart(day);
      months[month - 1].tasks.push({
        ...task,
        group_id: group.group_id,
        group_label: group.label,
        group_icon: group.icon,
        month,
        part,
        timeLabel: `${part} ${MONTH_NAMES[month - 1]}`,
        dayOfYear: day,
      });
    }
  }

  for (const m of months) m.tasks.sort((a, b) => a.dayOfYear - b.dayOfYear);

  const zoneNotes = selectedGroups
    .map((g) => ({
      group_id: g.group_id,
      group_label: g.label,
      notes: g.zone_notes
        .filter((n) => zone.zone_value >= n.min && zone.zone_value <= n.max)
        .map((n) => n.note),
    }))
    .filter((g) => g.notes.length > 0);

  return { months, zoneNotes };
}

export type MergedCalendarTask = {
  task: CalendarTask;
  groups: { group_id: string; group_label: string; group_icon: string }[];
};

export function mergeIdenticalTasks(tasks: CalendarTask[]): MergedCalendarTask[] {
  const merged = new Map<string, MergedCalendarTask>();

  for (const task of tasks) {
    const key = JSON.stringify([
      task.title,
      task.care_type,
      task.timeLabel,
      task.desc,
      task.warning,
      task.trigger,
    ]);
    const existing = merged.get(key);

    if (existing) {
      existing.groups.push({
        group_id: task.group_id,
        group_label: task.group_label,
        group_icon: task.group_icon,
      });
    } else {
      merged.set(key, {
        task,
        groups: [
          {
            group_id: task.group_id,
            group_label: task.group_label,
            group_icon: task.group_icon,
          },
        ],
      });
    }
  }

  return Array.from(merged.values());
}
