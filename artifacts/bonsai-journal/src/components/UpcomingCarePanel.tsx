import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AlertCircle, Maximize2, X, CalendarClock, ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useCompleteRemindersBulk, type UpcomingReminder } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface Props {
  reminders: UpcomingReminder[];
}

function urgencyClass(days: number) {
  if (days < 0) return "bg-destructive/10 text-destructive border-destructive/30";
  if (days === 0) return "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-400/30";
  if (days <= 3) return "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-400/30";
  return "bg-background text-foreground border-border/50";
}

function daysLabel(days: number) {
  if (days < 0) return "Overdue";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days}d`;
}

export function UpcomingCarePanel({ reminders }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [dateMode, setDateMode] = useState<"single" | "scheduled">("single");
  const today = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(today);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [successFading, setSuccessFading] = useState(false);
  const queryClient = useQueryClient();
  const complete = useCompleteRemindersBulk();
  const hasReminders = reminders.length > 0;
  const selected = reminders.filter(r => selectedIds.has(r.id));
  const shown = reminders.filter(r =>
    [r.treeName, r.type, r.notes ?? ""].some(value => value.toLowerCase().includes(search.toLowerCase())),
  );
  const types = [...new Set(reminders.map(r => r.type))];
  const selectable = (r: UpcomingReminder) => dateMode === "single" || r.daysUntilDue <= 0;
  const validDate = date !== "" && date <= today;
  const canSubmit = selected.length > 0 && (dateMode === "scheduled" || validDate);
  const recurringCount = selected.filter(r => r.recurring).length;
  const breakdown = types.map(type => ({ type, count: selected.filter(r => r.type === type).length }))
    .filter(item => item.count > 0);

  function leaveSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
    setSearch("");
    setError("");
    setConfirmOpen(false);
  }

  function close() {
    if (complete.isPending) return;
    leaveSelectMode();
    setExpanded(false);
  }

  function toggleTasks(tasks: UpcomingReminder[]) {
    if (complete.isPending) return;
    const eligible = tasks.filter(selectable);
    setSelectedIds(previous => {
      const next = new Set(previous);
      const remove = eligible.every(r => previous.has(r.id));
      eligible.forEach(r => remove ? next.delete(r.id) : next.add(r.id));
      return next;
    });
  }

  function changeDateMode(mode: "single" | "scheduled") {
    setDateMode(mode);
    if (mode === "scheduled") {
      setSelectedIds(previous => new Set(reminders
        .filter(r => previous.has(r.id) && r.daysUntilDue <= 0).map(r => r.id)));
    }
  }

  function submit() {
    if (!canSubmit || complete.isPending) return;
    setError("");
    const count = selected.length;
    complete.mutate({
      data: dateMode === "single"
        ? { reminderIds: selected.map(r => r.id), dateMode, today, date }
        : { reminderIds: selected.map(r => r.id), dateMode, today },
    }, {
      onSuccess: () => {
        for (const key of ["/api/reminders/upcoming", "/api/trees", "/api/collection/stats"]) {
          void queryClient.invalidateQueries({ queryKey: [key] });
        }
        leaveSelectMode();
        setSuccess(`Marked ${count} task${count === 1 ? "" : "s"} done.`);
      },
      onError: (failure) => {
        setError(failure.message || "Could not mark tasks done. Please try again.");
      },
    });
  }

  useEffect(() => {
    if (!success) return;
    setSuccessFading(false);
    const fadeTimer = window.setTimeout(() => setSuccessFading(true), 3500);
    const timer = window.setTimeout(() => setSuccess(""), 4000);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(timer);
    };
  }, [success]);

  // Also release the lock if a refetch removes the last task without unmounting.
  useEffect(() => {
    if (!hasReminders) {
      setExpanded(false);
      leaveSelectMode();
    }
  }, [hasReminders]);
  const overdueCount = reminders.filter((reminder) => reminder.daysUntilDue < 0).length;

  // Prevent body scroll when panel is fullscreen
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (expanded && hasReminders) {
      document.body.style.overflow = "hidden";
    }
    return () => { document.body.style.overflow = previousOverflow; };
  }, [expanded, hasReminders]);

  // Close on Escape
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || confirmOpen || complete.isPending) return;
      if (selectMode) leaveSelectMode();
      else setExpanded(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [expanded, selectMode, confirmOpen, complete.isPending]);

  return (
    <>
      {/* ── Collapsed banner ───────────────────────────────────────── */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg overflow-hidden">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          <div className="flex items-center gap-2.5 text-primary min-w-0">
            <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-sm leading-tight">Upcoming Care Needed</p>
              <p className="text-xs opacity-70 leading-tight">
                {overdueCount > 0 && `${overdueCount} overdue · `}
                {reminders.length - overdueCount} upcoming task{reminders.length - overdueCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={() => setExpanded(true)}
            className="shrink-0 flex items-center gap-1.5 text-xs text-primary/80 hover:text-primary font-medium px-2.5 py-1.5 rounded-md hover:bg-primary/10 transition-colors"
            aria-label="View all upcoming and overdue care tasks"
          >
            <span className="hidden sm:inline">View all</span>
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable pill list */}
        <div className="px-4 pt-2 pb-4">
          {/* Three 2.125rem rows plus two 0.375rem gaps; padding stays outside the scroll area. */}
          <div className="overflow-y-auto max-h-[7.125rem] space-y-1.5 scrollbar-thin">
            {reminders.map(r => (
              <Link
                key={r.id}
                href={`/trees/${r.treeId}`}
                className={`flex items-center justify-between gap-2 text-xs border rounded-md px-3 py-2 hover:opacity-80 transition-opacity ${urgencyClass(r.daysUntilDue)}`}
              >
                <span className="font-medium truncate">{r.treeName}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="opacity-70">{r.type}</span>
                  <span className="font-semibold">{daysLabel(r.daysUntilDue)}</span>
                  <ArrowRight className="w-3 h-3 opacity-40" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Full-screen overlay ─────────────────────────────────────── */}
      {expanded && hasReminders && (
        <div
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Upcoming Care — full view"
        >
          {/* Top bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b bg-card shrink-0">
            <div className="flex items-center gap-2.5 text-primary">
              <CalendarClock className="w-5 h-5" />
              <div>
                <h2 className="font-serif text-lg leading-tight">Upcoming Care</h2>
                <p className="text-xs text-muted-foreground">
                  {overdueCount > 0 && `${overdueCount} overdue · `}
                  {reminders.length - overdueCount} upcoming task{reminders.length - overdueCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost" size="sm" disabled={complete.isPending}
                data-testid="button-select-care"
                onClick={() => {
                  if (selectMode) leaveSelectMode();
                  else { setSelectMode(true); setDate(today); setSuccess(""); }
                }}
              >
                {selectMode ? "Done selecting" : "Select"}
              </Button>
              <button
                onClick={close}
                disabled={complete.isPending}
                className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Close full-screen view"
                data-testid="button-close-care"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {selectMode && (
            <div className="border-b px-4 py-3 space-y-2 shrink-0">
              <Input
                type="search" aria-label="Search care tasks" placeholder="Search trees, task types or notes"
                value={search} onChange={e => setSearch(e.target.value)}
                disabled={complete.isPending} data-testid="input-search-care"
              />
              <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                {types.map(type => {
                  const tasks = shown.filter(r => r.type === type);
                  const eligible = tasks.filter(selectable);
                  return (
                    <Button key={type} variant="outline" size="sm"
                      data-testid={`button-care-type-${type}`}
                      disabled={!eligible.length || complete.isPending}
                      aria-pressed={eligible.length > 0 && eligible.every(r => selectedIds.has(r.id))}
                      onClick={() => toggleTasks(tasks)}>
                      {type} ({tasks.length})
                    </Button>
                  );
                })}
                <Button variant="ghost" size="sm" disabled={complete.isPending}
                  data-testid="button-select-shown-care"
                  onClick={() => setSelectedIds(previous => new Set([...previous, ...shown.filter(selectable).map(r => r.id)]))}>
                  Select all shown
                </Button>
                <Button variant="ghost" size="sm" disabled={complete.isPending}
                  data-testid="button-clear-care" onClick={() => setSelectedIds(new Set())}>Clear</Button>
              </div>
            </div>
          )}

          {/* Scrollable list */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2">
            {success && <p role="status" data-testid="status-care-success"
              className={`text-sm text-primary transition-opacity duration-500 ${successFading ? "opacity-0" : "opacity-100"}`}>{success}</p>}
            {error && !confirmOpen && <p role="alert" data-testid="text-care-error" className="text-sm text-destructive">{error}</p>}
            {shown.length === 0 && <p className="text-sm text-muted-foreground">No matching tasks.</p>}
            {shown.map(r => {
              const disabled = !selectable(r);
              const content = <>
                {/* Left: urgency badge */}
                <div className="shrink-0 mt-0.5 min-w-[4rem] text-center">
                  <span className="text-xs font-bold leading-tight block">
                    {daysLabel(r.daysUntilDue)}
                  </span>
                  <span className="text-[10px] opacity-60 leading-tight block">
                    {format(parseISO(r.dueDate), "MMM d")}
                  </span>
                </div>

                {/* Divider */}
                <div className="w-px self-stretch bg-current opacity-15 shrink-0" />

                {/* Right: details */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm leading-tight">{r.treeName}</p>
                  <p className="text-xs opacity-75 mt-0.5">{r.type}</p>
                  {r.notes && (
                    <p className="text-xs opacity-55 mt-1 line-clamp-2">{r.notes}</p>
                  )}
                  {selectMode && disabled && <p className="text-xs mt-1">Not due yet</p>}
                </div>

                {selectMode ? (
                  <Checkbox checked={selectedIds.has(r.id)} disabled={disabled || complete.isPending}
                    aria-label={`Select ${r.treeName}: ${r.type}${r.notes ? ` — ${r.notes}` : ""}`}
                    data-testid={`checkbox-care-${r.id}`}
                    className="self-center"
                    onClick={e => e.stopPropagation()}
                    onCheckedChange={() => toggleTasks([r])} />
                ) : <ArrowRight className="w-4 h-4 shrink-0 self-center opacity-40" />}
              </>;
              const rowClass = `flex items-start gap-3 border rounded-xl px-4 py-3.5 hover:opacity-80 transition-opacity ${urgencyClass(r.daysUntilDue)}`;
              return selectMode ? (
                <div key={r.id} data-testid={`row-care-${r.id}`}
                  className={`${rowClass} ${disabled ? "opacity-45 bg-muted cursor-not-allowed" : "cursor-pointer"}`}
                  onClick={() => toggleTasks([r])}>
                  {content}
                </div>
              ) : (
                <Link key={r.id} href={`/trees/${r.treeId}`} onClick={close} className={rowClass}>
                  {content}
                </Link>
              );
            })}
          </div>
          {selectMode && (
            <div className="border-t bg-card px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shrink-0 space-y-3">
              <p className="text-sm font-medium" role="status" data-testid="status-care-selected">{selected.length} selected</p>
              <fieldset disabled={complete.isPending} className="space-y-2">
                <legend className="sr-only">Completion date</legend>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="care-date-mode" checked={dateMode === "single"}
                      onChange={() => changeDateMode("single")} data-testid="radio-care-single" />
                    Done on
                  </label>
                  <Input type="date" aria-label="Done on date" required max={today}
                    value={date} disabled={dateMode !== "single" || complete.isPending}
                    onChange={e => setDate(e.target.value)} data-testid="input-care-date" className="w-auto min-w-0" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="care-date-mode" checked={dateMode === "scheduled"}
                    onChange={() => changeDateMode("scheduled")} data-testid="radio-care-scheduled" />
                  On each task's scheduled date
                </label>
              </fieldset>
              <Button className="w-full sm:w-auto" disabled={!canSubmit || complete.isPending}
                data-testid="button-complete-care"
                onClick={() => selected.length === 1 ? submit() : setConfirmOpen(true)}>
                {complete.isPending ? "Marking done..." : `Mark ${selected.length} done`}
              </Button>
            </div>
          )}
        </div>
      )}
      <AlertDialog open={confirmOpen} onOpenChange={open => { if (!complete.isPending) setConfirmOpen(open); }}>
        <AlertDialogContent onEscapeKeyDown={e => { if (complete.isPending) e.preventDefault(); }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {selected.length} tasks done?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>{selected.length} tasks across {new Set(selected.map(r => r.treeId)).size} trees.</p>
                <p>{breakdown.map(({ type, count }) => `${type} x ${count}`).join(", ")}</p>
                <p>Completion date: {dateMode === "scheduled" ? "each task's scheduled date" : validDate ? format(parseISO(date), "MMM d") : "Choose a date"}.</p>
                {recurringCount > 0 && <p>{recurringCount} of these repeat and will be rescheduled.</p>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p role="alert" data-testid="text-care-confirm-error" className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={complete.isPending} data-testid="button-cancel-care">Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={complete.isPending || !canSubmit}
              data-testid="button-confirm-care" onClick={e => { e.preventDefault(); submit(); }}>
              {complete.isPending ? "Marking done..." : "Mark done"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
