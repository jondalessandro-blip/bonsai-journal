import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";

interface FeedbackRow {
  id: string;
  userId: string;
  category: string;
  message: string;
  createdAt: string;
}

const CATEGORY_STYLES: Record<string, string> = {
  bug: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  idea: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  other: "bg-muted text-muted-foreground",
};

async function fetchFeedback(): Promise<FeedbackRow[]> {
  const res = await fetch("/api/feedback", { credentials: "include" });
  if (res.status === 403) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  if (!res.ok) {
    throw new Error("Failed to load feedback");
  }
  return res.json() as Promise<FeedbackRow[]>;
}

export default function FeedbackAdminPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["feedback-admin"],
    queryFn: fetchFeedback,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (error && (error as { status?: number }).status === 403) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Not authorized.
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center text-sm text-destructive">
        Something went wrong. Please try again.
      </div>
    );
  }

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-medium">Feedback</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {rows.length} {rows.length === 1 ? "submission" : "submissions"}, newest first
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No feedback yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <Card key={row.id} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={[
                        "shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none capitalize",
                        CATEGORY_STYLES[row.category] ?? CATEGORY_STYLES.other,
                      ].join(" ")}
                    >
                      {row.category}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(parseISO(row.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="mt-3 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {row.message}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
