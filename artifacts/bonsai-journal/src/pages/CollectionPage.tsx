import { useInfiniteQuery } from "@tanstack/react-query";
import { listTrees, useListUpcomingReminders } from "@workspace/api-client-react";
import { TreeCard } from "@/components/TreeCard";
import { TreeGridTile } from "@/components/TreeGridTile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UpcomingCarePanel } from "@/components/UpcomingCarePanel";
import { Plus, Search, Leaf, Tag, Check, Loader2 } from "lucide-react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useSearch, useLocation } from "wouter";

const PAGE_SIZE = 24;
const CUSTOM_TAGS_KEY = "bonsai_custom_tags";

export default function CollectionPage() {
  const searchString = useSearch();
  const [, setLocation] = useLocation();

  // Derive initial status from URL on first render
  const urlStatus = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get("status") ?? "all";
  }, [searchString]);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [climate, setClimate] = useState<string>("all");
  const [foliage, setFoliage] = useState<string>("all");
  const [stage, setStage] = useState<string>("all");
  const [status, setStatus] = useState<string>(urlStatus);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagsOpen, setTagsOpen] = useState(false);

  // Keep status state in sync with URL (handles browser back/forward)
  useEffect(() => {
    setStatus(urlStatus);
  }, [urlStatus]);

  // Update URL when status filter changes
  const handleStatusChange = useCallback((value: string) => {
    setStatus(value);
    const params = new URLSearchParams(searchString);
    if (value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    const qs = params.toString();
    setLocation(qs ? `/?${qs}` : "/", { replace: false });
  }, [searchString, setLocation]);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Build query params — all filtering is now server-side
  const queryParams = useMemo(() => ({
    search: debouncedSearch || undefined,
    climate: climate !== "all" ? climate : undefined,
    foliage: foliage !== "all" ? foliage : undefined,
    stage: stage !== "all" ? stage : undefined,
    status: status !== "all" ? status : undefined,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    limit: PAGE_SIZE,
  }), [debouncedSearch, climate, foliage, stage, status, selectedTags]);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ["/api/trees", queryParams],
    queryFn: ({ pageParam }) =>
      listTrees({ ...queryParams, offset: pageParam as number }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    staleTime: 60_000,
  });

  const trees = useMemo(() => data?.pages.flat() ?? [], [data]);

  // Derive available tags for the filter dropdown from loaded pages only
  const allAvailableTags = useMemo(() => {
    return [...new Set(trees.flatMap((t) => t.tags))].sort();
  }, [trees]);

  // Prune localStorage and drop stale selected tags whenever loaded data changes
  useEffect(() => {
    if (!data) return;
    const liveTagSet = new Set(trees.flatMap((t) => t.tags));
    try {
      const stored: string[] = JSON.parse(localStorage.getItem(CUSTOM_TAGS_KEY) || "[]");
      const pruned = stored.filter((t) => liveTagSet.has(t));
      localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(pruned));
    } catch { /* ignore */ }
    setSelectedTags((prev) => prev.filter((t) => liveTagSet.has(t)));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // IntersectionObserver — auto-load next page when sentinel scrolls into view
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const { data: reminders } = useListUpcomingReminders();

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const searchQuery = debouncedSearch.toLowerCase();
  const totalLoaded = trees.length;

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">

      {reminders && reminders.length > 0 && (
        <UpcomingCarePanel reminders={reminders} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-serif text-foreground">My Collection</h1>
          <p className="text-muted-foreground mt-1">
            {isLoading
              ? "Loading..."
              : hasNextPage
              ? `${totalLoaded}+ trees growing`
              : `${totalLoaded} tree${totalLoaded !== 1 ? "s" : ""} growing`}
          </p>
        </div>
        <Link href="/trees/new">
          <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4" />
            Add Tree
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 bg-card p-3 rounded-lg border shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, species, or tag..."
            className="pl-9 bg-background border-none shadow-none focus-visible:ring-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="h-px bg-border/50" />
        <div className="flex gap-2 w-full flex-wrap">
          <Select value={climate} onValueChange={setClimate}>
            <SelectTrigger className="w-full sm:w-[150px] bg-background border-none shadow-none focus:ring-1">
              <SelectValue placeholder="Climate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Climates</SelectItem>
              <SelectItem value="Hardy / Outdoor">Hardy / Outdoor</SelectItem>
              <SelectItem value="Tropical & Subtropical">Tropical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={foliage} onValueChange={setFoliage}>
            <SelectTrigger className="w-full sm:w-[150px] bg-background border-none shadow-none focus:ring-1">
              <SelectValue placeholder="Foliage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Foliage</SelectItem>
              <SelectItem value="Deciduous">Deciduous</SelectItem>
              <SelectItem value="Conifer">Conifer</SelectItem>
              <SelectItem value="Broadleaf Evergreen">Broadleaf Evergr.</SelectItem>
              <SelectItem value="Succulent / Desert">Succulent</SelectItem>
            </SelectContent>
          </Select>
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="w-full sm:w-[150px] bg-background border-none shadow-none focus:ring-1">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              <SelectItem value="Establishment">1. Establishment</SelectItem>
              <SelectItem value="Trunk Development">2. Trunk Dev.</SelectItem>
              <SelectItem value="Primary Branch Development">3. Branch Dev.</SelectItem>
              <SelectItem value="Ramification & Refinement">4. Refinement</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full sm:w-[150px] bg-background border-none shadow-none focus:ring-1">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Thriving">Thriving</SelectItem>
              <SelectItem value="Dormant">Dormant</SelectItem>
              <SelectItem value="Stressed/In Distress">Stressed</SelectItem>
              <SelectItem value="Sick">Sick</SelectItem>
              <SelectItem value="Dead/Beyond Recovery">Dead</SelectItem>
            </SelectContent>
          </Select>

          {/* Tags multi-select */}
          <Popover open={tagsOpen} onOpenChange={setTagsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="bg-background border-none shadow-none focus:ring-1 h-9 px-3 font-normal text-sm justify-start gap-1.5 min-w-[120px]"
              >
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                {selectedTags.length > 0 ? (
                  <span className="flex items-center gap-1">
                    Tags
                    <span className="bg-primary text-primary-foreground text-[10px] font-semibold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                      {selectedTags.length}
                    </span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">All Tags</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              {allAvailableTags.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No tags yet</p>
              ) : (
                <div className="space-y-0.5 max-h-60 overflow-y-auto">
                  {allAvailableTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted text-sm transition-colors text-left"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${selectedTags.includes(tag) ? "bg-primary border-primary" : "border-input"}`}>
                        {selectedTags.includes(tag) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </div>
                      <span className="capitalize">{tag}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="w-full mt-2 pt-2 border-t text-xs text-muted-foreground hover:text-foreground text-center transition-colors"
                >
                  Clear tags filter
                </button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Tree grids */}
      {isLoading ? (
        <>
          <div className="sm:hidden grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex flex-col gap-1.5 animate-pulse">
                <div className="w-full aspect-square rounded-xl bg-muted" />
                <div className="h-3 bg-muted rounded w-3/4 mx-auto" />
              </div>
            ))}
          </div>
          <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="rounded-xl border bg-card/50 aspect-[4/3] animate-pulse" />
            ))}
          </div>
        </>
      ) : trees.length > 0 ? (
        <>
          <div className="sm:hidden grid grid-cols-3 gap-3">
            {trees.map(tree => (
              <TreeGridTile key={tree.id} tree={tree} />
            ))}
          </div>
          <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {trees.map(tree => (
              <TreeCard key={tree.id} tree={tree} searchQuery={searchQuery} />
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-24 bg-card/30 rounded-xl border border-dashed">
          <Leaf className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-serif text-xl mb-2">No trees found</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
            Your collection is empty or no trees match your current filters.
          </p>
          <Link href="/trees/new">
            <Button variant="outline">Plant a Seed</Button>
          </Link>
        </div>
      )}

      {/* Infinite scroll sentinel + loading indicator */}
      <div ref={sentinelRef} className="flex justify-center py-4">
        {isFetchingNextPage && (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
