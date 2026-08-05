import { useRef, useState, useCallback, useEffect } from "react";
import { Move, ZoomIn, ZoomOut, Check, X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useListTreePhotos, useUpdateTree } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface CoverPosition {
  x: number;    // 0–100 (left → right)
  y: number;    // 0–100 (top → bottom)
  zoom: number; // 0.5 – 2.5; zoom <= 1 = fit/contain, zoom > 1 = cover+crop
}

const DEFAULT_POS: CoverPosition = { x: 50, y: 50, zoom: 1 };
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;

// zoom <= 1 → contain mode (whole image visible, letterbox)
// zoom >  1 → cover mode  (cropped, scale applied, draggable)
const isFitMode = (zoom: number) => zoom <= 1;

function lsKey(treeId: string) {
  return `bonsai-cover-${treeId}`;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function loadPosition(treeId: string, serverPos: CoverPosition | null | undefined): CoverPosition {
  try {
    const raw = localStorage.getItem(lsKey(treeId));
    if (raw) return { ...DEFAULT_POS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return serverPos ? { ...DEFAULT_POS, ...serverPos } : DEFAULT_POS;
}

function zoomLabel(zoom: number): string {
  if (isFitMode(zoom)) return "Fit";
  return `${Math.round(zoom * 100)}%`;
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

  const coverPhoto = photos.length > 0 ? photos[photos.length - 1] : null;

  const [isEditing, setIsEditing] = useState(false);
  const [pos, setPos] = useState<CoverPosition>(() =>
    loadPosition(treeId, serverCoverPosition)
  );
  const [draft, setDraft] = useState<CoverPosition>(pos);

  useEffect(() => {
    const p = loadPosition(treeId, serverCoverPosition);
    setPos(p);
    setDraft(p);
  }, [treeId]); // intentionally excludes serverCoverPosition to avoid loop

  const isDragging = useRef(false);
  const dragAnchor = useRef<{ clientX: number; clientY: number; posX: number; posY: number } | null>(null);

  const startEdit = () => { setDraft({ ...pos }); setIsEditing(true); };

  const cancel = () => { setDraft({ ...pos }); setIsEditing(false); };

  const save = () => {
    const next = { ...draft };
    setPos(next);
    setIsEditing(false);
    try { localStorage.setItem(lsKey(treeId), JSON.stringify(next)); } catch { /* ignore */ }
    updateTree.mutate(
      { id: treeId, data: { coverPosition: next } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId] }) }
    );
  };

  const applyPreset = (preset: Partial<CoverPosition>) =>
    setDraft(d => ({ ...d, ...preset }));

  // Drag — only active when zoom > 1
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isEditing || isFitMode(draft.zoom)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = true;
    dragAnchor.current = { clientX: e.clientX, clientY: e.clientY, posX: draft.x, posY: draft.y };
  }, [isEditing, draft.zoom, draft.x, draft.y]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isEditing || !isDragging.current || !dragAnchor.current) return;
    const container = containerRef.current;
    if (!container) return;
    const anchor = dragAnchor.current; // capture before async updater
    const { width } = container.getBoundingClientRect();
    const dx = e.clientX - anchor.clientX;
    const dy = e.clientY - anchor.clientY;
    // full container-width drag = 100 units of change, divided by zoom (larger image = finer control)
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

  useEffect(() => {
    if (!isEditing) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") cancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!coverPhoto) return null;

  const current = isEditing ? draft : pos;
  const fitMode = isFitMode(current.zoom);
  const draftFit = isFitMode(draft.zoom);
  // Drag cursor only when we're in cover mode
  const dragActive = isEditing && !draftFit;

  // Image styles switch between contain (fit) and cover (crop) modes
  const imgStyle: React.CSSProperties = fitMode
    ? {
        objectFit: "contain",
        objectPosition: "center",
        transform: "none",
        transition: isEditing ? "none" : "object-position 0.4s ease",
        userSelect: "none",
      }
    : {
        objectFit: "cover",
        objectPosition: `${current.x}% ${current.y}%`,
        transform: `scale(${current.zoom})`,
        transformOrigin: `${current.x}% ${current.y}%`,
        transition: isEditing ? "none" : "transform 0.4s ease, object-position 0.4s ease",
        userSelect: "none",
      };

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden shadow-sm bg-black"
      style={{ height: 300 }}
    >
      {/* Photo layer */}
      <div
        ref={containerRef}
        className={[
          "absolute inset-0 select-none touch-none",
          dragActive ? "cursor-grab active:cursor-grabbing" : "",
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
          style={imgStyle}
        />
      </div>

      {/* Scrim — only over cover mode (contain shows letterbox, not scrim) */}
      {!fitMode && (
        <div
          className="absolute inset-0 pointer-events-none transition-colors duration-300"
          style={{
            background: isEditing
              ? "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.10) 55%, transparent 100%)"
              : "linear-gradient(to top, rgba(0,0,0,0.30) 0%, transparent 50%)",
          }}
        />
      )}
      {/* Minimal bottom scrim for controls legibility in fit mode */}
      {fitMode && (
        <div
          className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 100%)" }}
        />
      )}

      {/* Drag hint — only in cover mode */}
      {isEditing && dragActive && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <span className="bg-black/65 backdrop-blur-sm text-white text-xs font-medium rounded-full px-3 py-1 shadow">
            Drag to reposition
          </span>
        </div>
      )}
      {/* Fit mode hint */}
      {isEditing && draftFit && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <span className="bg-black/65 backdrop-blur-sm text-white text-xs font-medium rounded-full px-3 py-1 shadow">
            Slide right to zoom in and crop
          </span>
        </div>
      )}

      {/* Controls */}
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
                value={[draft.zoom]}
                onValueChange={([v]) => setDraft(d => ({ ...d, zoom: v }))}
                className="flex-1"
              />
              <ZoomIn className="w-4 h-4 text-white/80 shrink-0" />
              <span className="text-white/80 text-xs font-mono w-10 text-right tabular-nums">
                {zoomLabel(draft.zoom)}
              </span>
            </div>

            {/* Presets + actions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => applyPreset({ y: 75 })}
                className="text-xs bg-black/65 backdrop-blur-sm text-white rounded-lg px-2.5 py-1.5 hover:bg-black/80 transition-colors font-medium"
                title="Focus on Nebari — bottom of tree"
              >
                🌿 Nebari
              </button>
              <button
                onClick={() => applyPreset({ y: 25 })}
                className="text-xs bg-black/65 backdrop-blur-sm text-white rounded-lg px-2.5 py-1.5 hover:bg-black/80 transition-colors font-medium"
                title="Focus on Apex — top of tree"
              >
                ☁️ Apex
              </button>
              <button
                onClick={() => applyPreset({ zoom: 1, x: 50, y: 50 })}
                className="text-xs bg-black/65 backdrop-blur-sm text-white rounded-lg px-2.5 py-1.5 hover:bg-black/80 transition-colors font-medium"
                title="Show whole tree — no crop"
              >
                🌳 Fit Whole
              </button>

              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={cancel}
                  className="flex items-center gap-1 text-xs bg-white/20 backdrop-blur-sm text-white rounded-lg px-2.5 py-1.5 hover:bg-white/30 transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
                <button
                  onClick={save}
                  disabled={updateTree.isPending}
                  className="flex items-center gap-1 text-xs bg-primary text-primary-foreground rounded-lg px-2.5 py-1.5 hover:bg-primary/90 transition-colors font-semibold shadow disabled:opacity-60"
                >
                  <Check className="w-3.5 h-3.5" /> Save Position
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
              <Move className="w-3.5 h-3.5" /> Reposition
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
