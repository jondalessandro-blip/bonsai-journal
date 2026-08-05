import { useGetCollectionStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TreeCard } from "@/components/TreeCard";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TreePine, Droplets, Leaf, Activity, Plus } from "lucide-react";
import { Link } from "wouter";

const STATUS_ORDER = [
  "Thriving",
  "Dormant",
  "Stressed/In Distress",
  "Sick",
  "Dead/Beyond Recovery",
];

const STATUS_COLORS: Record<string, string> = {
  "Thriving":             "#16a34a", // green-600
  "Dormant":              "#2563eb", // blue-600
  "Stressed/In Distress": "#d97706", // amber-600
  "Sick":                 "#ea580c", // orange-600
  "Dead/Beyond Recovery": "#dc2626", // red-600
};

const STATUS_BG: Record<string, string> = {
  "Thriving":             "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  "Dormant":              "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "Stressed/In Distress": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  "Sick":                 "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  "Dead/Beyond Recovery": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export default function StatsPage() {
  const { data: stats, isLoading } = useGetCollectionStats();

  if (isLoading || !stats) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-10 w-48 bg-muted rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-32 bg-muted rounded-xl"></div>
          <div className="h-32 bg-muted rounded-xl"></div>
          <div className="h-32 bg-muted rounded-xl"></div>
        </div>
      </div>
    );
  }

  const primaryColor = "hsl(var(--primary))";

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-foreground">Collection Stats</h1>
          <p className="text-muted-foreground mt-1">A high-level view of your garden.</p>
        </div>
        <Link href="/trees/new">
          <Button className="shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            Add Tree
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-primary/10 p-4 rounded-full">
              <TreePine className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Trees</p>
              <p className="text-4xl font-serif text-foreground">{stats.totalTrees}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-secondary p-4 rounded-full">
              <Leaf className="w-8 h-8 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Foliage Types</p>
              <p className="text-4xl font-serif text-foreground">{stats.byFoliage.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-muted p-4 rounded-full">
              <Droplets className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Climates</p>
              <p className="text-4xl font-serif text-foreground">{stats.byClimate.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">By Climate</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byClimate} layout="vertical" margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} width={120} />
                <Tooltip 
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                  {stats.byClimate.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={primaryColor} fillOpacity={0.8 - (index * 0.15)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">By Foliage Type</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byFoliage} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={32}>
                  {stats.byFoliage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={primaryColor} fillOpacity={0.8 - (index * 0.15)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {stats.byStatus && stats.byStatus.length > 0 && (() => {
        const ordered = STATUS_ORDER
          .map(s => stats.byStatus.find(b => b.label === s))
          .filter((b): b is { label: string; count: number } => !!b);
        // Append any unknown statuses not in STATUS_ORDER
        const known = new Set(STATUS_ORDER);
        const extras = stats.byStatus.filter(b => !known.has(b.label));
        const allItems = [...ordered, ...extras];
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Health Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {allItems.map(({ label, count }) => (
                  <div
                    key={label}
                    className={`flex flex-col items-center gap-1 rounded-xl p-4 text-center ${STATUS_BG[label] ?? "bg-muted text-muted-foreground"}`}
                  >
                    <span className="text-3xl font-serif font-semibold">{count}</span>
                    <span className="text-xs font-medium leading-tight">{label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {stats.recentlyAdded && stats.recentlyAdded.length > 0 && (
        <div className="pt-8">
          <h2 className="text-2xl font-serif mb-6">Recently Added</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {stats.recentlyAdded.map(tree => (
              <TreeCard key={tree.id} tree={tree} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
