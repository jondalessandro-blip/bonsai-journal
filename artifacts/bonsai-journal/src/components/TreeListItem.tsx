import { useLocation } from "wouter";
import { Tree } from "@workspace/api-client-react/src/generated/api.schemas";
import { Badge } from "./ui/badge";
import { Leaf, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";

/** Compact list row used on mobile screens only. */
export function TreeListItem({ tree }: { tree: Tree }) {
  const [, setLocation] = useLocation();

  return (
    <button
      className="w-full flex items-center gap-3 px-1 py-3 text-left active:bg-muted/60 transition-colors"
      onClick={() => setLocation(`/trees/${tree.id}`)}
    >
      {/* Thumbnail */}
      <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-muted border border-border/50">
        {tree.photoUrl ? (
          <img
            src={tree.photoUrl}
            alt={tree.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Leaf className="w-5 h-5 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="font-serif font-medium text-foreground truncate leading-tight">
          {tree.name}
        </p>
        {tree.species && (
          <p className="text-xs italic text-muted-foreground truncate mt-0.5">
            {tree.species}
          </p>
        )}
        <div className="flex flex-wrap gap-1 mt-1.5">
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
          {tree.acquiredDate && (
            <span className="text-[10px] text-muted-foreground leading-[18px]">
              Since {format(parseISO(tree.acquiredDate), "yyyy")}
            </span>
          )}
        </div>
      </div>

      {/* Chevron */}
      <ChevronRight className="shrink-0 w-4 h-4 text-muted-foreground/50" />
    </button>
  );
}
