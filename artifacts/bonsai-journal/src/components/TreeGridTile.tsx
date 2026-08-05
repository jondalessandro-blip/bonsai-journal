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
        {(tree.coverThumb ?? tree.photoUrl) ? (
          <img
            src={(tree.coverThumb ?? tree.photoUrl)!}
            alt={tree.name}
            loading="lazy"
            decoding="async"
            width={200}
            height={200}
            className="w-full h-full"
            style={{
              objectFit: "cover",
              objectPosition: `${tree.coverPosition?.x ?? 50}% ${tree.coverPosition?.y ?? 50}%`,
              transform: `scale(${tree.coverPosition?.zoom ?? 1})`,
              transformOrigin: `${tree.coverPosition?.x ?? 50}% ${tree.coverPosition?.y ?? 50}%`,
            }}
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

      {/* Status badge — uses span because outer element is already a button */}
      {tree.status && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            setLocation(`/?status=${encodeURIComponent(tree.status!)}`);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              setLocation(`/?status=${encodeURIComponent(tree.status!)}`);
            }
          }}
          className={[
            "mx-auto mt-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium leading-none cursor-pointer hover:opacity-75 transition-opacity",
            tree.status === "Thriving"             ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"     :
            tree.status === "Dormant"              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"         :
            tree.status === "Stressed/In Distress" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"    :
            tree.status === "Sick"                 ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" :
            tree.status === "Dead/Beyond Recovery" ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"            :
                                                     "bg-muted text-muted-foreground"
          ].join(" ")}
        >
          {tree.status}
        </span>
      )}
    </button>
  );
});
