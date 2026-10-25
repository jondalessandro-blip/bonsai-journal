import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { listTrees, useRestoreTree } from "@workspace/api-client-react";
import type { Tree } from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Archive, Leaf, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PAGE_SIZE = 50;

function formatArchived(date?: string | null) {
  if (!date) return "Unknown date";
  try {
    return format(parseISO(date), "MMM d, yyyy");
  } catch {
    return date;
  }
}

export default function ArchivePage() {
  const queryClient = useQueryClient();
  const restoreTree = useRestoreTree();
  const [restoreTarget, setRestoreTarget] = useState<Tree | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching, isFetchingNextPage, fetchNextPage, hasNextPage } =
    useInfiniteQuery({
      queryKey: ["/api/trees", { archived: "archived" }],
      queryFn: ({ pageParam }) =>
        listTrees({ archived: "archived", limit: PAGE_SIZE, offset: pageParam as number }),
      initialPageParam: 0,
      getNextPageParam: (lastPage, allPages) =>
        lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
      staleTime: 60_000,
    });

  const trees = useMemo(() => {
    const rows = [...(data?.pages.flat() ?? [])];
    rows.sort((a, b) => (b.archivedDate ?? "").localeCompare(a.archivedDate ?? ""));
    return rows;
  }, [data]);

  const count = trees.length;

  const openRestore = (tree: Tree) => {
    restoreTree.reset();
    setRestoreTarget(tree);
  };

  const confirmRestore = () => {
    if (!restoreTarget || restoreTree.isPending) return;
    restoreTree.mutate(
      { id: restoreTarget.id },
      {
        onSuccess: () => {
          setRestoreTarget(null);
          queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
          queryClient.invalidateQueries({ queryKey: ["/api/reminders/upcoming"] });
          queryClient.invalidateQueries({ queryKey: ["/api/collection/stats"] });
        },
      },
    );
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <div>
        <Link
          href="/"
          data-testid="link-back-collection"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          My Collection
        </Link>
        <h1 className="mt-3 text-3xl font-serif text-foreground">Archive</h1>
        <p className="text-muted-foreground mt-1" data-testid="text-archive-count">
          {isLoading
            ? "Loading..."
            : isError
            ? "Could not load archive"
            : `${count} archived tree${count !== 1 ? "s" : ""}`}
        </p>
      </div>

      {isLoading ? (
        <ul className="space-y-3" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex gap-4 rounded-xl border bg-card p-4">
              <div className="h-20 w-20 shrink-0 rounded-lg bg-muted animate-pulse" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 w-1/3 rounded bg-muted animate-pulse" />
                <div className="h-3 w-1/4 rounded bg-muted animate-pulse" />
                <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
              </div>
            </li>
          ))}
        </ul>
      ) : isError ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
          <p className="text-sm text-destructive" data-testid="text-archive-error">
            {(error as Error | null)?.message || "Could not load archived trees."}
          </p>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} data-testid="button-retry-archive">
            {isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Try again
          </Button>
        </div>
      ) : count === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/60 px-6 py-16 text-center" data-testid="empty-archive">
          <div className="mb-4 rounded-full bg-muted p-4">
            <Archive className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-serif text-lg text-foreground">Nothing archived yet.</p>
          <p className="text-sm text-muted-foreground mt-1">Trees you archive will appear here.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {trees.map((tree) => {
              const thumb = tree.coverThumb || tree.photoUrl;
              return (
                <li
                  key={tree.id}
                  data-testid={`row-archived-${tree.id}`}
                  className="flex flex-col gap-4 rounded-xl border border-border/50 bg-card p-4 shadow-sm sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 gap-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {thumb ? (
                        <img src={thumb} alt={tree.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                          <Leaf className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <h2 className="break-words font-serif text-lg text-foreground">{tree.name}</h2>
                      {tree.species && <p className="truncate text-sm italic text-muted-foreground">{tree.species}</p>}
                      <p className="text-sm text-foreground/80">Archived on {formatArchived(tree.archivedDate)}</p>
                      {tree.archiveReason && <p className="break-words text-sm text-muted-foreground">{tree.archiveReason}</p>}
                      {tree.archiveNotes && (
                        <p className="line-clamp-2 break-words text-sm text-muted-foreground/90">{tree.archiveNotes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:shrink-0">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/trees/${tree.id}`} data-testid={`link-open-${tree.id}`}>Open</Link>
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={() => openRestore(tree)} data-testid={`button-restore-${tree.id}`}>
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restore
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          {hasNextPage && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} data-testid="button-load-more">
                {isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      <AlertDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => {
          if (!open && !restoreTree.isPending) setRestoreTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore tree</AlertDialogTitle>
            <AlertDialogDescription>
              Restore this tree to your collection? Its old reminders will not come back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {restoreTree.isError && (
            <p role="alert" className="text-sm text-destructive">
              {(restoreTree.error as Error | null)?.message || "Could not restore this tree. Please try again."}
            </p>
          )}
          <AlertDialogFooter>
            <Button variant="outline" disabled={restoreTree.isPending} onClick={() => setRestoreTarget(null)} data-testid="button-cancel-restore">
              Cancel
            </Button>
            <Button disabled={restoreTree.isPending} onClick={confirmRestore} data-testid="button-confirm-restore">
              {restoreTree.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Restore tree
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
