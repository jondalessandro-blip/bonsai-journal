import { useState, useEffect } from "react";
import { Link } from "wouter";
import { AlertCircle, Maximize2, X, CalendarClock, ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { UpcomingReminder } from "@workspace/api-client-react/src/generated/api.schemas";

interface Props {
  reminders: UpcomingReminder[];
}

function urgencyClass(days: number) {
  if (days <= 0) return "bg-destructive/10 text-destructive border-destructive/30";
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

  // Prevent body scroll when panel is fullscreen
  useEffect(() => {
    if (expanded) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [expanded]);

  // Close on Escape
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [expanded]);

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
                {reminders.length} task{reminders.length !== 1 ? "s" : ""} due soon
              </p>
            </div>
          </div>
          <button
            onClick={() => setExpanded(true)}
            className="shrink-0 flex items-center gap-1.5 text-xs text-primary/80 hover:text-primary font-medium px-2.5 py-1.5 rounded-md hover:bg-primary/10 transition-colors"
            aria-label="View all upcoming care tasks"
          >
            <span className="hidden sm:inline">View all</span>
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable pill list */}
        <div className="px-4 pb-3.5 overflow-y-auto max-h-28 space-y-1.5 scrollbar-thin">
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

      {/* ── Full-screen overlay ─────────────────────────────────────── */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Upcoming Care — full view"
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-4 border-b bg-card shrink-0">
            <div className="flex items-center gap-2.5 text-primary">
              <CalendarClock className="w-5 h-5" />
              <div>
                <h2 className="font-serif text-lg leading-tight">Upcoming Care</h2>
                <p className="text-xs text-muted-foreground">
                  {reminders.length} task{reminders.length !== 1 ? "s" : ""} in the next 30 days
                </p>
              </div>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Close full-screen view"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
            {reminders.map(r => (
              <Link
                key={r.id}
                href={`/trees/${r.treeId}`}
                onClick={() => setExpanded(false)}
                className={`flex items-start gap-3 border rounded-xl px-4 py-3.5 hover:opacity-80 transition-opacity ${urgencyClass(r.daysUntilDue)}`}
              >
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
                </div>

                <ArrowRight className="w-4 h-4 shrink-0 self-center opacity-40" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
