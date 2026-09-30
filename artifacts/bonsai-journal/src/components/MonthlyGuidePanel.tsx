import { getMonthlyGuide } from "@/lib/monthlyGuide";
import { MONTH_NAMES } from "@/lib/calendarEngine";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type MonthlyGuidePanelProps = {
  selectedMonth: number;
  currentMonth: number;
  onMonthChange: (month: number) => void;
};

export function MonthlyGuidePanel({
  selectedMonth,
  currentMonth,
  onMonthChange,
}: MonthlyGuidePanelProps) {
  const guide = getMonthlyGuide(selectedMonth);
  const monthName = MONTH_NAMES[selectedMonth - 1] ?? "";

  return (
    <div className="space-y-4" data-testid="monthly-guide-panel">
      <div
        role="group"
        aria-label="Choose a month"
        className="grid grid-cols-6 gap-2 sm:flex sm:flex-wrap"
        data-testid="monthly-guide-month-picker"
      >
        {MONTH_NAMES.map((name, i) => {
          const month = i + 1;
          const selected = month === selectedMonth;
          const isCurrent = month === currentMonth;
          return (
            <button
              key={name}
              type="button"
              aria-pressed={selected}
              aria-label={isCurrent ? `${name}, current month` : name}
              aria-current={isCurrent ? "date" : undefined}
              data-testid={`button-month-${month}`}
              onClick={() => onMonthChange(month)}
              className={`relative inline-flex min-h-9 items-center justify-center rounded-full border px-2 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-4 ${
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted"
              }`}
            >
              {name.slice(0, 3)}
              {isCurrent && (
                <span
                  aria-hidden="true"
                  data-testid={`marker-current-month-${month}`}
                  className={`absolute right-1.5 top-1 h-1.5 w-1.5 rounded-full ${
                    selected ? "bg-primary-foreground" : "bg-primary"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="space-y-6 p-6 sm:p-8">
          {!guide ? (
            <p
              className="py-10 text-center font-serif text-lg text-muted-foreground"
              data-testid="text-guide-missing"
            >
              The guide for {monthName} is on its way.
            </p>
          ) : (
            <>
              <header className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2
                    className="font-serif text-3xl text-foreground sm:text-4xl"
                    data-testid="text-guide-title"
                  >
                    {guide.title}
                  </h2>
                  {selectedMonth === currentMonth && (
                    <Badge variant="secondary" data-testid="badge-this-month">
                      This month
                    </Badge>
                  )}
                </div>
                <p
                  className="max-w-3xl text-lg leading-relaxed text-muted-foreground"
                  data-testid="text-guide-intro"
                >
                  {guide.intro}
                </p>
              </header>

              <div className="grid gap-4 md:grid-cols-2">
                {guide.sections.map((section, si) => (
                  <section
                    key={section.heading}
                    data-testid={`section-guide-${si}`}
                    className="rounded-xl border border-border/70 border-l-4 border-l-primary/40 bg-muted/30 p-5"
                  >
                    <h3 className="font-serif text-lg text-foreground">
                      {section.heading}
                    </h3>
                    <ul className="mt-3 space-y-3">
                      {section.items.map((item, ii) => (
                        <li
                          key={ii}
                          className="flex items-start gap-3 leading-relaxed text-foreground/90"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>

              <div
                className="rounded-xl border border-primary/20 bg-primary/5 p-5"
                data-testid="callout-guide-focus"
              >
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
                  {monthName} focus
                </p>
                <p className="mt-2 leading-relaxed text-foreground">
                  {guide.focus}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <p
        className="text-sm text-muted-foreground"
        data-testid="text-guide-disclaimer"
      >
        Written for cold-winter climates, so timing may differ where you live.
      </p>
    </div>
  );
}

export default MonthlyGuidePanel;
