import { memo } from "react";
import { useLocation } from "wouter";
import type { Tree } from "@workspace/api-client-react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";

interface TreeCardProps {
  tree: Tree;
  searchQuery?: string;
  navContext?: string;
}

export const TreeCard = memo(function TreeCard({
  tree,
  searchQuery = "",
  navContext = "",
}: TreeCardProps) {
  const [, setLocation] = useLocation();

  const visibleTags = tree.tags.slice(0, 2);
  const extraCount = tree.tags.length - visibleTags.length;

  const tagMatches = (tag: string) =>
    searchQuery.length > 0 && tag.toLowerCase().includes(searchQuery);

  return (
    <Card
      className="group overflow-hidden cursor-pointer hover:shadow-md transition-all duration-300 border-border/50 hover:border-primary/30"
      onClick={() => setLocation(`/trees/${tree.id}${navContext ? `?${navContext}` : ""}`)}
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-muted relative">
        {(tree.coverThumb ?? tree.photoUrl) ? (
          <img
            src={(tree.coverThumb ?? tree.photoUrl)!}
            alt={tree.name}
            loading="lazy"
            decoding="async"
            width={400}
            height={300}
            className="w-full h-full"
            style={{
              objectFit: "cover",
              objectPosition: `${tree.coverPosition?.x ?? 50}% ${tree.coverPosition?.y ?? 50}%`,
              transform: `scale(${tree.coverPosition?.zoom ?? 1})`,
              transformOrigin: `${tree.coverPosition?.x ?? 50}% ${tree.coverPosition?.y ?? 50}%`,
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50">
            <span className="text-xs tracking-widest uppercase">No Photo</span>
          </div>
        )}
      </div>

      <CardContent className="p-4">
        <div className="mb-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-serif text-lg font-medium text-foreground leading-tight group-hover:text-primary transition-colors">
              {tree.name}
            </h3>
            {tree.status && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation(`/?status=${encodeURIComponent(tree.status!)}`);
                }}
                className={[
                  "shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none mt-0.5 cursor-pointer hover:opacity-75 transition-opacity",
                  tree.status === "Thriving"             ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"  :
                  tree.status === "Dormant"              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"     :
                  tree.status === "Stressed/In Distress" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" :
                  tree.status === "Sick"                 ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" :
                  tree.status === "Dead/Beyond Recovery" ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"         :
                                                           "bg-muted text-muted-foreground"
                ].join(" ")}
              >
                {tree.status}
              </button>
            )}
          </div>
          {tree.species && (
            <p className="text-sm italic text-muted-foreground mt-0.5">
              {tree.species}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {tree.style && (
            <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
              {tree.style}
            </Badge>
          )}
          {tree.foliage && (
            <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 border-border/60">
              {tree.foliage}
            </Badge>
          )}
        </div>

        {tree.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-colors"
                style={
                  tagMatches(tag)
                    ? { backgroundColor: "#00695C", color: "#fff" }
                    : { backgroundColor: "#E0F2F1", color: "#00695C" }
                }
              >
                {tag}
              </span>
            ))}
            {extraCount > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] text-muted-foreground border border-border/50">
                +{extraCount} more
              </span>
            )}
          </div>
        )}

        {tree.acquiredDate && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-4 pt-3 border-t border-border/40">
            <Calendar className="w-3 h-3" />
            <span>Since {format(parseISO(tree.acquiredDate), 'yyyy')}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
