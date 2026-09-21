import { useEffect, useMemo, useState } from "react";
import {
  generateCalendar,
  mergeIdenticalTasks,
  type Group,
  type Zone,
} from "@/lib/calendarEngine";
import zonesJson from "@/data/careCalendar/zones.json";
import groupsJson from "@/data/careCalendar/groups.json";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const zones = zonesJson as Zone[];
const groups = groupsJson as unknown as Group[];

const STORAGE_KEY = "bonsai:careCalendar";
const DEFAULT_ZONE_ID = "5b";
const DEFAULT_GROUP_IDS = ["hardy_deciduous"];

type CalendarPreferences = {
  zoneId: string;
  groupIds: string[];
  includeOptional: boolean;
};

const GROUP_STYLES: Record<string, string> = {
  hardy_deciduous:
    "border-l-green-600/70 bg-green-50/50 dark:bg-green-950/20",
  pine_two_flush: "border-l-blue-600/70 bg-blue-50/50 dark:bg-blue-950/20",
  pine_one_flush: "border-l-teal-600/70 bg-teal-50/50 dark:bg-teal-950/20",
  juniper: "border-l-emerald-700/70 bg-emerald-50/50 dark:bg-emerald-950/20",
  tropical: "border-l-amber-600/70 bg-amber-50/50 dark:bg-amber-950/20",
};

function defaultPreferences(): CalendarPreferences {
  return {
    zoneId: DEFAULT_ZONE_ID,
    groupIds: [...DEFAULT_GROUP_IDS],
    includeOptional: false,
  };
}

function isValidPreferences(value: unknown): value is CalendarPreferences {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Partial<CalendarPreferences>;
  return (
    typeof candidate.zoneId === "string" &&
    Array.isArray(candidate.groupIds) &&
    candidate.groupIds.every((groupId) => typeof groupId === "string") &&
    typeof candidate.includeOptional === "boolean"
  );
}

function readPreferences(): CalendarPreferences {
  const fallback = defaultPreferences();

  try {
    if (typeof window === "undefined") return fallback;

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return fallback;

    const parsed: unknown = JSON.parse(stored);
    if (!isValidPreferences(parsed)) return fallback;

    const hasKnownZone = zones.some((zone) => zone.id === parsed.zoneId);
    const hasOnlyKnownGroups = parsed.groupIds.every((groupId) =>
      groups.some((group) => group.group_id === groupId),
    );
    if (!hasKnownZone || !hasOnlyKnownGroups) return fallback;

    return {
      zoneId: parsed.zoneId,
      groupIds: [...parsed.groupIds],
      includeOptional: parsed.includeOptional,
    };
  } catch {
    return fallback;
  }
}

export default function CalendarPage() {
  const [preferences, setPreferences] = useState<CalendarPreferences>(
    readPreferences,
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Storage is optional; the calendar remains usable when it is unavailable.
    }
  }, [preferences]);

  const selectedZone =
    zones.find((zone) => zone.id === preferences.zoneId) ??
    zones.find((zone) => zone.id === DEFAULT_ZONE_ID) ??
    zones[0];

  const selectedGroups = useMemo(
    () =>
      groups.filter((group) =>
        preferences.groupIds.includes(group.group_id),
      ),
    [preferences.groupIds],
  );

  const calendar = useMemo(
    () =>
      generateCalendar(selectedZone, selectedGroups, {
        includeOptional: preferences.includeOptional,
      }),
    [preferences.includeOptional, selectedGroups, selectedZone],
  );

  const currentMonth = new Date().getMonth() + 1;

  const handleGroupChange = (groupId: string, checked: boolean) => {
    setPreferences((current) => ({
      ...current,
      groupIds: checked
        ? [...current.groupIds, groupId]
        : current.groupIds.filter((id) => id !== groupId),
    }));
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl text-foreground">Care Calendar</h1>
        <p className="max-w-3xl text-muted-foreground">
          These are typical timings for your climate zone. Dates are
          approximate, so always go by what your tree is actually doing.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Build your calendar</CardTitle>
          <CardDescription>
            Choose a zone and the kinds of trees you are caring for.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-7">
          <div className="space-y-2">
            <label
              htmlFor="calendar-zone"
              className="text-sm font-medium text-foreground"
            >
              Step 1: Choose your climate zone
            </label>
            <Select
              value={selectedZone.id}
              onValueChange={(zoneId) =>
                setPreferences((current) => ({ ...current, zoneId }))
              }
            >
              <SelectTrigger id="calendar-zone" className="max-w-md">
                <SelectValue placeholder="Choose a zone" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((zone) => (
                  <SelectItem key={zone.id} value={zone.id}>
                    {zone.display}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">
              Step 2: Choose your tree groups
            </legend>
            <div className="grid gap-3 md:grid-cols-2">
              {groups.map((group) => {
                const inputId = `calendar-group-${group.group_id}`;
                const checked = preferences.groupIds.includes(group.group_id);

                return (
                  <label
                    key={group.group_id}
                    htmlFor={inputId}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 p-3 transition-colors hover:bg-muted/50"
                  >
                    <Checkbox
                      id={inputId}
                      checked={checked}
                      onCheckedChange={(value) =>
                        handleGroupChange(group.group_id, value === true)
                      }
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-medium">
                        <span aria-hidden="true" className="text-lg">
                          {group.icon}
                        </span>
                        {group.label}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {group.examples}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 p-3">
            <div className="space-y-1">
              <label
                htmlFor="calendar-advanced"
                className="text-sm font-medium text-foreground"
              >
                Show advanced tasks
              </label>
              <p className="text-xs text-muted-foreground">
                Include optional and more specialized work in the calendar.
              </p>
            </div>
            <Switch
              id="calendar-advanced"
              checked={preferences.includeOptional}
              onCheckedChange={(includeOptional) =>
                setPreferences((current) => ({
                  ...current,
                  includeOptional,
                }))
              }
              aria-label="Show advanced tasks"
            />
          </div>
        </CardContent>
      </Card>

      {calendar.zoneNotes.length > 0 && (
        <Alert className="border-primary/20 bg-primary/5">
          <AlertTitle>Zone notes for {selectedZone.label}</AlertTitle>
          <AlertDescription>
            <ul className="space-y-2">
              {calendar.zoneNotes.flatMap((zoneNote) =>
                zoneNote.notes.map((note) => (
                  <li key={`${zoneNote.group_id}-${note}`}>
                    <span className="font-medium">{zoneNote.group_label}:</span>{" "}
                    {note}
                  </li>
                )),
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <section aria-labelledby="calendar-months-heading" className="space-y-4">
        <div>
          <h2
            id="calendar-months-heading"
            className="font-serif text-2xl text-foreground"
          >
            Your year at a glance
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tasks are shown in approximate timing order for {selectedZone.display}.
          </p>
        </div>

        <div className="space-y-4">
          {selectedGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Tick at least one tree group above to see your calendar.
            </p>
          ) : (
            calendar.months.map((month) => (
              <Card key={month.month}>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-xl">{month.monthName}</CardTitle>
                  {month.month === currentMonth && (
                    <Badge variant="secondary">This month</Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {month.tasks.length === 0 ? (
                    <p className="text-sm italic text-muted-foreground">
                      Nothing scheduled
                    </p>
                  ) : (
                    mergeIdenticalTasks(month.tasks).map((mergedTask) => {
                      const task = mergedTask.task;
                      const isMerged = mergedTask.groups.length > 1;

                      return (
                        <article
                          key={`${task.id}-${mergedTask.groups.map((group) => group.group_id).join("-")}`}
                          className={`rounded-lg border border-border/60 border-l-4 p-4 ${
                            isMerged
                              ? "border-l-border bg-muted/30"
                              : (GROUP_STYLES[task.group_id] ??
                                "border-l-border bg-muted/30")
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              aria-hidden="true"
                              className={`mt-0.5 text-xl leading-none ${
                                isMerged ? "flex gap-1" : ""
                              }`}
                            >
                              {mergedTask.groups.map((group) => (
                                <span key={group.group_id}>{group.group_icon}</span>
                              ))}
                            </span>
                            <div className="min-w-0 flex-1 space-y-2">
                              {isMerged && (
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-medium">Applies to:</span>{" "}
                                  {mergedTask.groups
                                    .map((group) => group.group_label)
                                    .join(", ")}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-medium text-foreground">
                                  {task.title}
                                </h3>
                                <Badge variant="outline">{task.care_type}</Badge>
                                <span className="text-xs font-medium text-muted-foreground">
                                  {task.timeLabel}
                                </span>
                              </div>
                              <p className="text-sm leading-relaxed text-foreground/90">
                                {task.desc}
                              </p>
                              {task.warning && (
                                <p className="text-sm leading-relaxed text-red-700 dark:text-red-300">
                                  <span className="font-semibold">Warning:</span>{" "}
                                  {task.warning}
                                </p>
                              )}
                              <p className="text-xs italic leading-relaxed text-muted-foreground">
                                Trigger: {task.trigger}
                              </p>
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>
    </div>
  );
}