import { useListTrees, useListUpcomingReminders } from "@workspace/api-client-react";
import { TreeCard } from "@/components/TreeCard";
import { TreeGridTile } from "@/components/TreeGridTile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, AlertCircle, Leaf } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";

export default function CollectionPage() {
  const [search, setSearch] = useState("");
  const [climate, setClimate] = useState<string>("all");
  const [foliage, setFoliage] = useState<string>("all");

  const { data: trees, isLoading: isTreesLoading } = useListTrees({
    search: search || undefined,
    climate: climate !== "all" ? climate : undefined,
    foliage: foliage !== "all" ? foliage : undefined
  });

  const { data: reminders } = useListUpcomingReminders();

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      
      {/* Reminders Banner */}
      {reminders && reminders.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3 text-primary">
            <AlertCircle className="w-5 h-5" />
            <div>
              <p className="font-medium text-sm">Upcoming Care Needed</p>
              <p className="text-xs opacity-80">{reminders.length} task{reminders.length > 1 ? 's' : ''} due soon</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {reminders.slice(0, 2).map(r => (
              <Link key={r.id} href={`/trees/${r.treeId}`} className="text-xs bg-background border border-primary/20 px-3 py-1.5 rounded-md hover:border-primary/50 transition-colors">
                <span className="font-medium">{r.treeName}</span>: {r.type}
              </Link>
            ))}
            {reminders.length > 2 && (
              <span className="text-xs px-2 py-1.5 text-muted-foreground flex items-center">+{reminders.length - 2} more</span>
            )}
          </div>
        </div>
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

      <div className="flex flex-col sm:flex-row gap-3 bg-card p-3 rounded-lg border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or species..." 
            className="pl-9 bg-background border-none shadow-none focus-visible:ring-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="h-px sm:h-auto sm:w-px bg-border/50" />
        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={climate} onValueChange={setClimate}>
            <SelectTrigger className="w-full sm:w-[160px] bg-background border-none shadow-none focus:ring-1">
              <SelectValue placeholder="Climate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Climates</SelectItem>
              <SelectItem value="Hardy / Outdoor">Hardy / Outdoor</SelectItem>
              <SelectItem value="Cold Hardy Conifer">Cold Hardy Conifer</SelectItem>
              <SelectItem value="Tropical & Subtropical">Tropical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={foliage} onValueChange={setFoliage}>
            <SelectTrigger className="w-full sm:w-[160px] bg-background border-none shadow-none focus:ring-1">
              <SelectValue placeholder="Foliage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Foliage</SelectItem>
              <SelectItem value="Deciduous">Deciduous</SelectItem>
              <SelectItem value="Conifer">Conifer</SelectItem>
              <SelectItem value="Broadleaf Evergreen">Broadleaf</SelectItem>
              <SelectItem value="Succulent / Desert">Succulent</SelectItem>
            </SelectContent>
          </Select>
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
              <TreeCard key={tree.id} tree={tree} />
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
