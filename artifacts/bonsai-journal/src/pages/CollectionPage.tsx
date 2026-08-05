import { useListTrees, useListUpcomingReminders } from "@workspace/api-client-react";
import { TreeCard } from "@/components/TreeCard";
import { TreeGridTile } from "@/components/TreeGridTile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UpcomingCarePanel } from "@/components/UpcomingCarePanel";
import { Plus, Search, Leaf, Tag, Check } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { DEFAULT_TAGS } from "@/data/defaultTags";
import { useCustomTags } from "@/hooks/useCustomTags";

export default function CollectionPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [climate, setClimate] = useState<string>("all");
  const [foliage, setFoliage] = useState<string>("all");
  const [stage, setStage] = useState<string>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagsOpen, setTagsOpen] = useState(false);

  const { customTags } = useCustomTags();

  // Debounce search input — avoids an API call on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: rawTrees, isLoading: isTreesLoading } = useListTrees({
    search: debouncedSearch || undefined,
    climate: climate !== "all" ? climate : undefined,
    foliage: foliage !== "all" ? foliage : undefined,
    stage: stage !== "all" ? stage : undefined,
  });

  // Client-side tag filter (multi-select: any match)
  const trees = useMemo(() => {
    if (!rawTrees || selectedTags.length === 0) return rawTrees;
    return rawTrees.filter((t) =>
      selectedTags.some((st) => t.tags.includes(st))
    );
  }, [rawTrees, selectedTags]);

  // All available tags for the filter dropdown: default + custom + any on existing trees
  const allAvailableTags = useMemo(() => {
    const treeTags = (rawTrees ?? []).flatMap((t) => t.tags);
    return [
      ...new Set([
        ...DEFAULT_TAGS,
        ...customTags,
        ...treeTags,
      ]),
    ].sort();
  }, [rawTrees, customTags]);

  const { data: reminders } = useListUpcomingReminders();

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const searchQuery = debouncedSearch.toLowerCase();

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">

      {/* Upcoming Care Panel */}
      {reminders && reminders.length > 0 && (
        <UpcomingCarePanel reminders={reminders} />
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-serif text-foreground">My Collection</h1>
          <p className="text-muted-foreground mt-1">
            {isTreesLoading ? "Loading..." : `${trees?.length || 0} trees growing`}
          </p>
        </div>
        <Link href="/trees/new">
          <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4" />
            Add Tree
          </Button>
        </Link>
      </div>

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

      {/* Trees — mobile list (< sm) */}
      {isTreesLoading ? (
        <>
          {/* Mobile skeleton */}
          <div className="sm:hidden grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex flex-col gap-1.5 animate-pulse">
                <div className="w-full aspect-square rounded-xl bg-muted" />
                <div className="h-3 bg-muted rounded w-3/4 mx-auto" />
              </div>
            ))}
          </div>
          {/* Desktop skeleton */}
          <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-xl border bg-card/50 aspect-[3/4] animate-pulse" />
            ))}
          </div>
        </>
      ) : trees && trees.length > 0 ? (
        <>
          {/* Mobile grid */}
          <div className="sm:hidden grid grid-cols-3 gap-3">
            {trees.map(tree => (
              <TreeGridTile key={tree.id} tree={tree} />
            ))}
          </div>
          {/* Desktop grid */}
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

    </div>
  );
}
