import { useInfiniteQuery } from "@tanstack/react-query";
import { listTrees, useListUpcomingReminders } from "@workspace/api-client-react";
import { TreeCard } from "@/components/TreeCard";
import { TreeGridTile } from "@/components/TreeGridTile";
import { BulkLogForm } from "@/components/BulkLogForm";
import { BulkReminderForm } from "@/components/BulkReminderForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UpcomingCarePanel } from "@/components/UpcomingCarePanel";
import { Plus, Search, Leaf, Tag, Check, Loader2, X, FilterX, Filter, ChevronDown, HelpCircle } from "lucide-react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useSearch, useLocation } from "wouter";

import { DEFAULT_TAGS } from "@/data/defaultTags";

const PAGE_SIZE = 24;
const CUSTOM_TAGS_KEY = "bonsai_custom_tags";

// Display labels for chips (full text — CSS truncation handles overflow in triggers)
const CLIMATE_LABELS: Record<string, string> = {
  "Hardy / Outdoor": "Hardy / Outdoor",
  "Tropical & Subtropical": "Tropical & Subtropical",
  "Hybrid/Other": "Hybrid/Other",
};
const FOLIAGE_LABELS: Record<string, string> = {
  "Deciduous": "Deciduous",
  "Conifer": "Conifer",
  "Deciduous Conifer": "Deciduous Conifer",
  "Broadleaf Evergreen": "Broadleaf Evergreen",
  "Succulent / Desert": "Succulent / Desert",
};
const STAGE_LABELS: Record<string, string> = {
  "Establishment": "Establishment",
  "Trunk Development": "Trunk Development",
  "Primary Branch Development": "Primary Branch Development",
  "Ramification & Refinement": "Ramification & Refinement",
};
const STATUS_LABELS: Record<string, string> = {
  "Thriving": "Thriving",
  "Dormant": "Dormant",
  "Stressed/In Distress": "Stressed/In Distress",
  "Sick": "Sick",
  "Dead/Beyond Recovery": "Dead/Beyond Recovery",
};

const CLIMATE_OPTIONS = ["Hardy / Outdoor", "Tropical & Subtropical", "Hybrid/Other"];
const FOLIAGE_OPTIONS = ["Deciduous", "Conifer", "Deciduous Conifer", "Broadleaf Evergreen", "Succulent / Desert"];
const STAGE_OPTIONS = ["Establishment", "Trunk Development", "Primary Branch Development", "Ramification & Refinement"];
const STAGE_ITEM_LABELS: Record<string, string> = {
  "Establishment": "1. Establishment",
  "Trunk Development": "2. Trunk Development",
  "Primary Branch Development": "3. Primary Branch Development",
  "Ramification & Refinement": "4. Ramification & Refinement",
};
const STATUS_OPTIONS = ["Thriving", "Dormant", "Stressed/In Distress", "Sick", "Dead/Beyond Recovery"];

type FilterState = { values: string[]; mode: "include" | "exclude" };

function deriveFilterState(params: URLSearchParams, field: string): FilterState {
  const excludeRaw = params.get(field + "Exclude");
  if (excludeRaw) return { values: excludeRaw.split(","), mode: "exclude" };
  const includeRaw = params.get(field);
  if (includeRaw) return { values: includeRaw.split(","), mode: "include" };
  return { values: [], mode: "include" };
}

export default function CollectionPage() {
  const searchString = useSearch();
  const [, setLocation] = useLocation();

  const [search, setSearch] = useState(() => new URLSearchParams(searchString).get("search") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(() => new URLSearchParams(searchString).get("search") ?? "");
  const [climateFilter, setClimateFilter] = useState<FilterState>(() => deriveFilterState(new URLSearchParams(searchString), "climate"));
  const [foliageFilter, setFoliageFilter] = useState<FilterState>(() => deriveFilterState(new URLSearchParams(searchString), "foliage"));
  const [stageFilter, setStageFilter] = useState<FilterState>(() => deriveFilterState(new URLSearchParams(searchString), "stage"));
  const [statusFilter, setStatusFilter] = useState<FilterState>(() => deriveFilterState(new URLSearchParams(searchString), "status"));
  const [climateOpen, setClimateOpen] = useState(false);
  const [foliageOpen, setFoliageOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    const tags = new URLSearchParams(searchString).get("tags");
    return tags ? tags.split(",") : [];
  });
  const [tagsMode, setTagsMode] = useState<"all" | "any">(() =>
    new URLSearchParams(searchString).get("tagsMode") === "any" ? "any" : "all",
  );
  const [tagsOpen, setTagsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(
    () => new URLSearchParams(searchString).get("ids") !== null,
  );
  const [selectedTreeIds, setSelectedTreeIds] = useState<Set<string>>(() => {
    const idsParam = new URLSearchParams(searchString).get("ids");
    return new Set(idsParam ? idsParam.split(",") : []);
  });
  const [bulkDialog, setBulkDialog] = useState<"log" | "schedule" | null>(null);
  const [bulkTreeIds, setBulkTreeIds] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    const applyFilter = (field: string, filter: FilterState) => {
      if (filter.values.length === 0) return;
      params.set(filter.mode === "exclude" ? field + "Exclude" : field, filter.values.join(","));
    };
    applyFilter("climate", climateFilter);
    applyFilter("foliage", foliageFilter);
    applyFilter("stage", stageFilter);
    applyFilter("status", statusFilter);
    if (selectedTags.length > 0) params.set("tags", selectedTags.join(","));
    if (tagsMode === "any") params.set("tagsMode", "any");
    const qs = params.toString();
    setLocation(qs ? "/?" + qs : "/", { replace: false });
  }, [debouncedSearch, climateFilter, foliageFilter, stageFilter, statusFilter, selectedTags, tagsMode]);

  // Master tag list — seeded with DEFAULT_TAGS so they appear in the filter even before
  // any tree uses them; only ever grows so the popover stays complete while a filter is active
  const [knownTags, setKnownTags] = useState<string[]>([...DEFAULT_TAGS].sort());

  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // True whenever any filter or search is active
  const hasActiveFilters =
    search !== "" ||
    climateFilter.values.length > 0 ||
    foliageFilter.values.length > 0 ||
    stageFilter.values.length > 0 ||
    statusFilter.values.length > 0 ||
    selectedTags.length > 0;

  // Count of active panel filters only (excludes search — always visible)
  const activeFilterCount =
    (climateFilter.values.length > 0 ? 1 : 0) +
    (foliageFilter.values.length > 0 ? 1 : 0) +
    (stageFilter.values.length > 0 ? 1 : 0) +
    (statusFilter.values.length > 0 ? 1 : 0) +
    selectedTags.length;

  // Reset every filter
  const clearAllFilters = useCallback(() => {
    setSearch("");
    setClimateFilter({ values: [], mode: "include" });
    setFoliageFilter({ values: [], mode: "include" });
    setStageFilter({ values: [], mode: "include" });
    setStatusFilter({ values: [], mode: "include" });
    setSelectedTags([]);
    setTagsMode("all");
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Build query params — all filtering is now server-side
  const queryParams = useMemo(() => ({
    search: debouncedSearch || undefined,
    climate: climateFilter.mode === "include" && climateFilter.values.length > 0 ? climateFilter.values : undefined,
    climateExclude: climateFilter.mode === "exclude" && climateFilter.values.length > 0 ? climateFilter.values : undefined,
    foliage: foliageFilter.mode === "include" && foliageFilter.values.length > 0 ? foliageFilter.values : undefined,
    foliageExclude: foliageFilter.mode === "exclude" && foliageFilter.values.length > 0 ? foliageFilter.values : undefined,
    stage: stageFilter.mode === "include" && stageFilter.values.length > 0 ? stageFilter.values : undefined,
    stageExclude: stageFilter.mode === "exclude" && stageFilter.values.length > 0 ? stageFilter.values : undefined,
    status: statusFilter.mode === "include" && statusFilter.values.length > 0 ? statusFilter.values : undefined,
    statusExclude: statusFilter.mode === "exclude" && statusFilter.values.length > 0 ? statusFilter.values : undefined,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    tagsMode: tagsMode === "any" ? "any" as const : undefined,
    limit: PAGE_SIZE,
  }), [debouncedSearch, climateFilter, foliageFilter, stageFilter, statusFilter, selectedTags, tagsMode]);

  const navFilterQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    const applyFilter = (field: string, filter: FilterState) => {
      if (filter.values.length === 0) return;
      params.set(filter.mode === "exclude" ? field + "Exclude" : field, filter.values.join(","));
    };
    applyFilter("climate", climateFilter);
    applyFilter("foliage", foliageFilter);
    applyFilter("stage", stageFilter);
    applyFilter("status", statusFilter);
    if (selectedTags.length > 0) params.set("tags", selectedTags.join(","));
    if (tagsMode === "any") params.set("tagsMode", "any");
    return params.toString();
  }, [debouncedSearch, climateFilter, foliageFilter, stageFilter, statusFilter, selectedTags, tagsMode]);

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
  const allLoadedSelected =
    trees.length > 0 && trees.every((tree) => selectedTreeIds.has(tree.id));

  const toggleTreeSelection = useCallback((treeId: string) => {
    setSelectedTreeIds((previous) => {
      const next = new Set(previous);
      if (next.has(treeId)) {
        next.delete(treeId);
      } else {
        next.add(treeId);
      }
      return next;
    });
  }, []);

  const toggleSelectMode = useCallback(() => {
    if (selectMode) setSelectedTreeIds(new Set());
    setSelectMode(!selectMode);
  }, [selectMode]);

  const toggleSelectAll = useCallback(() => {
    setSelectedTreeIds((previous) => {
      const everyLoadedTreeIsSelected =
        trees.length > 0 && trees.every((tree) => previous.has(tree.id));
      if (everyLoadedTreeIsSelected) return new Set();
      return new Set(trees.map((tree) => tree.id));
    });
  }, [trees]);

  // Grow the master tag list as new trees load — never shrinks so the popover
  // stays complete even when a tag filter is active and results are narrowed.
  useEffect(() => {
    if (!trees.length) return;
    setKnownTags((prev) => {
      const next = [...new Set([...prev, ...trees.flatMap((t) => t.tags)])].sort();
      return next.length === prev.length ? prev : next;
    });
  }, [trees]);

  // Prune localStorage stale tags (from deleted trees) — but don't touch selectedTags
  // so the active filter isn't cleared when filtered results don't contain all chosen tags.
  useEffect(() => {
    if (!data) return;
    try {
      const liveTagSet = new Set(trees.flatMap((t) => t.tags));
      const stored: string[] = JSON.parse(localStorage.getItem(CUSTOM_TAGS_KEY) || "[]");
      const pruned = stored.filter((t) => liveTagSet.has(t));
      localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(pruned));
    } catch { /* ignore */ }
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

  function toggleFilterValue(
    setter: React.Dispatch<React.SetStateAction<FilterState>>,
    value: string
  ) {
    setter((prev) => ({
      ...prev,
      values: prev.values.includes(value)
        ? prev.values.filter((v) => v !== value)
        : [...prev.values, value],
    }));
  }

  const searchQuery = debouncedSearch.toLowerCase();
  const totalLoaded = trees.length;
  const selectedCount = selectedTreeIds.size;

  const handleBulkSuccess = useCallback(() => {
    setBulkDialog(null);
    setSelectedTreeIds(new Set());
    setSelectMode(false);
  }, []);

  const openBulkDialog = useCallback(
    (dialog: "log" | "schedule") => {
      setBulkTreeIds(Array.from(selectedTreeIds));
      setBulkDialog(dialog);
    },
    [selectedTreeIds],
  );

  // Whether the panel is collapsed and has active filters
  const showChips = !filtersOpen && activeFilterCount > 0;

  return (
    <div
      className={`space-y-8 animate-in fade-in duration-500 ${
        selectedCount > 0 ? "pb-48 sm:pb-36" : "pb-12"
      }`}
    >

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
        <div className="flex items-center gap-2">
          <Link href="/help">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Help"
              className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/trees/new">
            <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="w-4 h-4" />
              Add Tree
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className={`flex flex-col gap-3 bg-card p-3 rounded-lg border shadow-sm transition-colors duration-200 ${!filtersOpen && activeFilterCount > 0 ? "border-primary/40 bg-primary/5" : ""}`}>
        {/* Search — always visible */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search by name, species, or tag..."
            className={`pl-9 bg-background border-none shadow-none focus-visible:ring-1${search ? " pr-9" : ""}`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearch("");
                searchInputRef.current?.blur();
              }
            }}
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setSearch("");
                searchInputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="h-px bg-border/50" />

        {/* Toggle row */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors select-none"
            aria-expanded={filtersOpen}
          >
            <Filter className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium">Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-semibold rounded-full w-4 h-4 flex items-center justify-center leading-none shrink-0">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 ml-auto shrink-0 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`}
            />
          </button>
          {selectMode && trees.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className="shrink-0 px-1 text-xs font-medium text-primary hover:text-primary/75 transition-colors"
            >
              {allLoadedSelected ? "Deselect all" : "Select all"}
            </button>
          )}
          <Button
            type="button"
            size="sm"
            variant={selectMode ? "secondary" : "outline"}
            onClick={toggleSelectMode}
            className="h-8 shrink-0"
          >
            {selectMode ? "Cancel" : "Select"}
          </Button>
        </div>

        {/* Collapsible filter panel */}
        {filtersOpen && (
          <div className="flex gap-2 w-full flex-wrap animate-in fade-in duration-200">
            {([
              ["Climate", "All Climates", climateFilter, setClimateFilter, climateOpen, setClimateOpen, CLIMATE_OPTIONS, CLIMATE_LABELS],
              ["Foliage", "All Foliage", foliageFilter, setFoliageFilter, foliageOpen, setFoliageOpen, FOLIAGE_OPTIONS, FOLIAGE_LABELS],
              ["Stage", "All Stages", stageFilter, setStageFilter, stageOpen, setStageOpen, STAGE_OPTIONS, STAGE_ITEM_LABELS],
              ["Status", "All Statuses", statusFilter, setStatusFilter, statusOpen, setStatusOpen, STATUS_OPTIONS, STATUS_LABELS],
            ] as const).map(([name, emptyLabel, filter, setter, open, setOpen, options, labels]) => (
              <Popover key={name} open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="bg-background border-none shadow-none focus:ring-1 h-9 px-3 font-normal text-sm justify-start gap-1.5 min-w-[150px]"
                  >
                    {filter.values.length > 0 ? (
                      <span className="flex items-center gap-1">
                        {filter.mode === "exclude" ? `Not: ${name}` : name}
                        <span className="bg-primary text-primary-foreground text-[10px] font-semibold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                          {filter.values.length}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{emptyLabel}</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="flex gap-1 mb-2 pb-2 border-b">
                    {(["include", "exclude"] as const).map((mode) => (
                      <Button
                        key={mode}
                        type="button"
                        size="sm"
                        variant={filter.mode === mode ? "default" : "ghost"}
                        className="h-7 flex-1 text-xs capitalize"
                        onClick={() => setter((prev) => ({ ...prev, mode }))}
                      >
                        {mode}
                      </Button>
                    ))}
                  </div>
                  <div className="space-y-0.5 max-h-60 overflow-y-auto">
                    {options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleFilterValue(setter, option)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted text-sm transition-colors text-left"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${filter.values.includes(option) ? "bg-primary border-primary" : "border-input"}`}>
                          {filter.values.includes(option) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                        </div>
                        <span>{labels[option] ?? option}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ))}

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
                <div className="flex gap-1 mb-2 pb-2 border-b">
                  {(["all", "any"] as const).map((mode) => (
                    <Button
                      key={mode}
                      type="button"
                      size="sm"
                      variant={tagsMode === mode ? "default" : "ghost"}
                      className="h-7 flex-1 text-xs capitalize"
                      onClick={() => setTagsMode(mode)}
                    >
                      {mode}
                    </Button>
                  ))}
                </div>
                {knownTags.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No tags yet</p>
                ) : (
                  <div className="space-y-0.5 max-h-60 overflow-y-auto">
                    {knownTags.map((tag) => (
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
                {selectedTags.length > 1 && (
                  <p className="mt-2 pt-2 border-t text-[11px] text-muted-foreground text-center leading-snug">
                    Showing trees with <strong>{tagsMode} {selectedTags.length} tags</strong>
                  </p>
                )}
                {selectedTags.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedTags([]);
                      setTagsMode("all");
                    }}
                    className={`w-full text-xs text-muted-foreground hover:text-foreground text-center transition-colors ${selectedTags.length > 1 ? "mt-1.5" : "mt-2 pt-2 border-t"}`}
                  >
                    Clear tags filter
                  </button>
                )}
              </PopoverContent>
            </Popover>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors self-center"
              >
                <FilterX className="w-3 h-3" />
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Active-filter chips — shown when panel is collapsed and filters are active */}
        {showChips && (
          <div className="flex flex-wrap gap-1.5 animate-in fade-in duration-200">
            {([
              [climateFilter, setClimateFilter, CLIMATE_LABELS],
              [foliageFilter, setFoliageFilter, FOLIAGE_LABELS],
              [stageFilter, setStageFilter, STAGE_LABELS],
              [statusFilter, setStatusFilter, STATUS_LABELS],
            ] as const).flatMap(([filter, setter, labels]) =>
              filter.values.map((value) => (
                <span key={`${filter.mode}-${value}`} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium rounded-full px-2.5 py-0.5">
                  {filter.mode === "exclude" ? "Not " : ""}{labels[value] ?? value}
                  <button
                    type="button"
                    aria-label={`Remove ${labels[value] ?? value} filter`}
                    onClick={() => toggleFilterValue(setter, value)}
                    className="hover:text-primary/70 transition-colors ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
            {selectedTags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium rounded-full px-2.5 py-0.5">
                <span className="capitalize">{tag}</span>
                <button
                  type="button"
                  aria-label={`Remove ${tag} tag filter`}
                  onClick={() => toggleTag(tag)}
                  className="hover:text-primary/70 transition-colors ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {/* Clear all — replaces the inline clear button; only shown here when collapsed */}
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
            >
              <FilterX className="w-3 h-3" />
              Clear all
            </button>
          </div>
        )}
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
              <TreeGridTile
                key={tree.id}
                tree={tree}
                navContext={navFilterQuery}
                selectMode={selectMode}
                isSelected={selectedTreeIds.has(tree.id)}
                onToggleSelect={() => toggleTreeSelection(tree.id)}
              />
            ))}
          </div>
          <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {trees.map(tree => (
              <TreeCard
                key={tree.id}
                tree={tree}
                searchQuery={searchQuery}
                navContext={navFilterQuery}
                selectMode={selectMode}
                isSelected={selectedTreeIds.has(tree.id)}
                onToggleSelect={() => toggleTreeSelection(tree.id)}
              />
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

      {selectedCount > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] sm:bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-40 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl border border-border/70 bg-background/95 p-3 shadow-xl backdrop-blur-md">
            <p className="min-w-0 flex-1 text-sm font-medium">
              {selectedCount} {selectedCount === 1 ? "tree" : "trees"} selected
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const firstSelectedTree = trees.find((tree) =>
                  selectedTreeIds.has(tree.id),
                );
                if (firstSelectedTree) {
                  setLocation(
                    `/trees/${firstSelectedTree.id}?ids=${Array.from(selectedTreeIds).join(",")}`,
                  );
                }
              }}
            >
              View
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => openBulkDialog("log")}
            >
              Log Care
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => openBulkDialog("schedule")}
            >
              Schedule Care
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={bulkDialog !== null}
        onOpenChange={(open) => {
          if (!open) setBulkDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkDialog === "schedule" ? "Schedule Care" : "Log Care"}
            </DialogTitle>
            <DialogDescription>
              Applying to {bulkTreeIds.length}{" "}
              {bulkTreeIds.length === 1 ? "tree" : "trees"}
            </DialogDescription>
          </DialogHeader>
          {bulkDialog === "log" && (
            <BulkLogForm
              treeIds={bulkTreeIds}
              onSuccess={handleBulkSuccess}
            />
          )}
          {bulkDialog === "schedule" && (
            <BulkReminderForm
              treeIds={bulkTreeIds}
              onSuccess={handleBulkSuccess}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
