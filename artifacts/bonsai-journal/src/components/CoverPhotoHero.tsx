import { useRef, useState, useCallback, useEffect } from "react";
import { Move, ZoomIn, ZoomOut, Check, X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useListTreePhotos, useUpdateTree } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_COVER_POSITION,
  coverPositionStorageKey,
  type CoverPosition,
} from "@/lib/coverPosition";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;

const DEFAULT_POS = DEFAULT_COVER_POSITION;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function loadPosition(treeId: string, serverPos: CoverPosition | null | undefined): CoverPosition {
  try {
    const raw = localStorage.getItem(coverPositionStorageKey(treeId));
    if (raw) return { ...DEFAULT_POS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return serverPos ? { ...DEFAULT_POS, ...serverPos } : DEFAULT_POS;
}

interface Props {
  treeId: string;
  serverCoverPosition?: { x: number; y: number; zoom: number } | null;
}

export function CoverPhotoHero({ treeId, serverCoverPosition }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const updateTree = useUpdateTree();

  const { data: photos = [] } = useListTreePhotos(treeId, {
    query: { queryKey: ["/api/trees", treeId, "photos"], enabled: !!treeId },
  });

  // Most recent photo is the cover
  const coverPhoto = photos.length > 0 ? photos[photos.length - 1] : null;

  const [isEditing, setIsEditing] = useState(false);
  const [pos, setPos] = useState<CoverPosition>(() =>
    loadPosition(treeId, serverCoverPosition)
  );
  const [draft, setDraft] = useState<CoverPosition>(pos);
  const previousCoverUrl = useRef<string | undefined>(undefined);

  // Re-initialise when tree changes
  useEffect(() => {
    previousCoverUrl.current = undefined;
    const p = loadPosition(treeId, serverCoverPosition);
    setPos(p);
    setDraft(p);
  }, [treeId]); // intentionally exclude serverCoverPosition to avoid loop

  const isDragging = useRef(false);
  const dragAnchor = useRef<{ clientX: number; clientY: number; posX: number; posY: number } | null>(null);

  const startEdit = () => {
    setDraft({ ...pos });
    setIsEditing(true);
  };

  const cancel = () => {
    setDraft({ ...pos });
    setIsEditing(false);
  };

  const save = () => {
    const next = { ...draft };
    setPos(next);
    setIsEditing(false);
    try { localStorage.setItem(coverPositionStorageKey(treeId), JSON.stringify(next)); } catch { /* ignore */ }
    // Persist position AND sync cover photo fields so the collection
    // thumbnail always matches what's shown in the record header.
    updateTree.mutate(
      {
        id: treeId,
        data: {
          coverPosition: next,
          ...(coverPhoto ? { photoUrl: coverPhoto.photoUrl } : {}),
          ...(coverPhoto?.photoThumb ? { coverThumb: coverPhoto.photoThumb } : {}),
        },
      },
      {
        onSuccess: () => {
          // Invalidate both the detail query and the collection list so the
          // gallery thumbnail refreshes immediately.
          queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
        },
      }
    );
  };

  const applyPreset = (preset: Partial<CoverPosition>) => {
    setDraft(d => ({ ...d, ...preset }));
  };

  // A new most-recent photo is a new cover and must not inherit the previous
  // cover's focal point or zoom.
  useEffect(() => {
    if (!coverPhoto) return;
    const coverUrl = coverPhoto.photoUrl;
    if (previousCoverUrl.current === undefined) {
      previousCoverUrl.current = coverUrl;
      return;
    }
    if (previousCoverUrl.current === coverUrl) return;

    previousCoverUrl.current = coverUrl;
    const reset = { ...DEFAULT_POS };
    setPos(reset);
    setDraft(reset);
    try {
      localStorage.setItem(coverPositionStorageKey(treeId), JSON.stringify(reset));
    } catch { /* ignore */ }
  }, [coverPhoto?.photoUrl, treeId]);

  // Pointer drag
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isEditing || draft.zoom <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = true;
    dragAnchor.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      posX: draft.x,
      posY: draft.y,
    };
  }, [isEditing, draft.zoom, draft.x, draft.y]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isEditing || draft.zoom <= 1 || !isDragging.current || !dragAnchor.current) return;
    const container = containerRef.current;
    if (!container) return;
    // Capture ref values before entering the async state updater
    const anchor = dragAnchor.current;
    const { width } = container.getBoundingClientRect();
    const dx = e.clientX - anchor.clientX;
    const dy = e.clientY - anchor.clientY;
    // Full container-width drag = 100 units of change at zoom=1
    const sens = 100 / Math.max(width, 1) / Math.max(draft.zoom, 1);
    setDraft(d => ({
      ...d,
      x: clamp(anchor.posX - dx * sens, 0, 100),
      y: clamp(anchor.posY - dy * sens, 0, 100),
    }));
  }, [isEditing, draft.zoom]);

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
    dragAnchor.current = null;
  }, []);

  // Escape to cancel
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") cancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!coverPhoto) return null;

  const current = isEditing ? draft : pos;

  return (
    <div
      className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black shadow-sm"
    >
      {/* Photo layer */}
      <div
        ref={containerRef}
        className={[
          "absolute inset-0 select-none touch-none",
          isEditing && current.zoom > 1 ? "cursor-grab active:cursor-grabbing" : "",
        ].join(" ")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          src={coverPhoto.photoUrl}
          alt="Cover photo"
          draggable={false}
          className="w-full h-full pointer-events-none"
          style={{
            objectFit: current.zoom <= 1 ? "contain" : "cover",
            objectPosition: current.zoom <= 1 ? "50% 50%" : `${current.x}% ${current.y}%`,
            transform: `scale(${current.zoom})`,
            transformOrigin: `${current.x}% ${current.y}%`,
            transition: isEditing ? "none" : "transform 0.4s ease, object-position 0.4s ease",
            userSelect: "none",
          }}
        />
      </div>

      {/* Scrim — darker in edit mode */}
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-300"
        style={{
          background: isEditing
            ? "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)"
            : "linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 50%)",
        }}
      />

      {/* Drag hint badge */}
      {isEditing && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <span className="bg-black/65 backdrop-blur-sm text-white text-xs font-medium rounded-full px-3 py-1 shadow">
            Drag to reposition
          </span>
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-3 space-y-2">
        {isEditing ? (
          <>
            {/* Zoom row */}
            <div className="flex items-center gap-2 bg-black/65 backdrop-blur-sm rounded-xl px-3 py-2">
              <ZoomOut className="w-4 h-4 text-white/80 shrink-0" />
              <Slider
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.05}
                // Keep the fitted state visually at the left end. Zoom values
                // below 1 remain available, but all of them use whole-image
                // contain mode.
                value={[draft.zoom <= 1 ? MIN_ZOOM : draft.zoom]}
                onValueChange={([v]) => setDraft(d => ({ ...d, zoom: v }))}
                className="flex-1"
              />
              <ZoomIn className="w-4 h-4 text-white/80 shrink-0" />
              <span className="text-white/80 text-xs font-mono w-9 text-right tabular-nums">
                {draft.zoom <= 1 ? "Fit" : `${Math.round(draft.zoom * 100)}%`}
              </span>
            </div>

            {/* Presets + actions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => applyPreset({ y: 75 })}
                className="text-xs bg-black/65 backdrop-blur-sm text-white rounded-lg px-2.5 py-1.5 hover:bg-black/80 transition-colors font-medium"
                title="Focus on Nebari"
              >
                🌿 Nebari
              </button>
              <button
                onClick={() => applyPreset({ y: 25 })}
                className="text-xs bg-black/65 backdrop-blur-sm text-white rounded-lg px-2.5 py-1.5 hover:bg-black/80 transition-colors font-medium"
                title="Focus on Apex"
              >
                ☁️ Apex
              </button>
              <button
                onClick={() => applyPreset({ zoom: 1, x: 50, y: 50 })}
                className="text-xs bg-black/65 backdrop-blur-sm text-white rounded-lg px-2.5 py-1.5 hover:bg-black/80 transition-colors font-medium"
                title="Fit Whole Tree"
              >
                🌳 Fit Whole
              </button>

              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={cancel}
                  className="flex items-center gap-1 text-xs bg-white/20 backdrop-blur-sm text-white rounded-lg px-2.5 py-1.5 hover:bg-white/30 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={updateTree.isPending}
                  className="flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded-lg px-2.5 py-1.5 hover:bg-primary/90 transition-colors font-semibold shadow disabled:opacity-60"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Position
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex justify-end">
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 text-xs bg-black/65 backdrop-blur-sm text-white rounded-lg px-2.5 py-1.5 hover:bg-black/80 transition-colors font-medium shadow"
            >
              <Move className="w-3.5 h-3.5" />
              Reposition
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
