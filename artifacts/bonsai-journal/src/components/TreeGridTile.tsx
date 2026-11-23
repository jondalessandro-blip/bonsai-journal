import { memo } from "react";
import { useLocation } from "wouter";
import type { Tree } from "@workspace/api-client-react";
import { Leaf, Snowflake } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface TreeGridTileProps {
  tree: Tree;
  navContext?: string;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

/** 3-column grid tile used on mobile screens only. */
export const TreeGridTile = memo(function TreeGridTile({
  tree,
  navContext = "",
  selectMode = false,
  isSelected = false,
  onToggleSelect,
}: TreeGridTileProps) {
  const [, setLocation] = useLocation();

  const handleActivate = () => {
    if (selectMode) {
      onToggleSelect?.();
      return;
    }
    setLocation(`/trees/${tree.id}${navContext ? `?${navContext}` : ""}`);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selectMode ? isSelected : undefined}
      className={[
        "flex flex-col items-stretch text-left active:opacity-70 transition-all rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selectMode && isSelected ? "ring-2 ring-primary ring-offset-2" : "",
      ].join(" ")}
      onClick={handleActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleActivate();
        }
      }}
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
              transform: `scale(${Math.max(tree.coverPosition?.zoom ?? 1, 1)})`,
              transformOrigin: `${tree.coverPosition?.x ?? 50}% ${tree.coverPosition?.y ?? 50}%`,
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Leaf className="w-6 h-6 text-muted-foreground/30" />
          </div>
        )}
        {tree.isDormant && (
          <span
            data-testid={`badge-dormant-${tree.id}`}
            aria-label="Dormant"
            title="Dormant"
            className="absolute left-1.5 top-1.5 inline-flex items-center justify-center rounded-full border border-sky-200/80 bg-sky-50/95 p-1 text-sky-800 shadow-sm dark:border-sky-800 dark:bg-sky-950/90 dark:text-sky-200"
          >
            <Snowflake className="h-3.5 w-3.5" />
          </span>
        )}
        {selectMode && (
          <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-full bg-background/90 p-0.5 shadow-md backdrop-blur-sm">
            <Checkbox
              checked={isSelected}
              tabIndex={-1}
              aria-hidden="true"
              className="h-5 w-5 rounded-full border-2 border-primary bg-background data-[state=checked]:bg-primary"
            />
          </span>
        )}
      </div>

      {/* Name */}
      <p className="mt-1.5 text-[13px] font-serif font-medium text-foreground text-center leading-tight line-clamp-2 px-0.5">
        {tree.name}
      </p>

      {/* Status badge — uses span because outer element is already a button */}
      {tree.status && tree.status !== "Dormant" && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            if (selectMode) return;
            e.stopPropagation();
            setLocation(`/?status=${encodeURIComponent(tree.status!)}`);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              if (selectMode) {
                onToggleSelect?.();
                return;
              }
              setLocation(`/?status=${encodeURIComponent(tree.status!)}`);
            }
          }}
          className={[
            "mx-auto mt-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium leading-none cursor-pointer hover:opacity-75 transition-opacity",
            tree.status === "Thriving"             ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"     :
            tree.status === "Healthy"              ? "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300"        :
            tree.status === "Stressed/In Distress" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"    :
            tree.status === "Sick"                 ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" :
            tree.status === "Dead/Beyond Recovery" ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"            :
                                                     "bg-muted text-muted-foreground"
          ].join(" ")}
        >
          {tree.status}
        </span>
      )}
    </div>
  );
});
