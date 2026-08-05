import { memo } from "react";
import { useLocation } from "wouter";
import type { Tree } from "@workspace/api-client-react";
import { Leaf } from "lucide-react";

/** 3-column grid tile used on mobile screens only. */
export const TreeGridTile = memo(function TreeGridTile({ tree }: { tree: Tree }) {
  const [, setLocation] = useLocation();

  return (
    <button
      className="flex flex-col items-stretch text-left active:opacity-70 transition-opacity"
      onClick={() => setLocation(`/trees/${tree.id}`)}
    >
      {/* Square thumbnail */}
      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-muted border border-border/40">
        {tree.photoUrl ? (
          <img
            src={tree.photoUrl}
            alt={tree.name}
            loading="lazy"
            decoding="async"
            width={200}
            height={200}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Leaf className="w-6 h-6 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Name */}
      <p className="mt-1.5 text-[13px] font-serif font-medium text-foreground text-center leading-tight line-clamp-2 px-0.5">
        {tree.name}
      </p>
    </button>
  );
});
