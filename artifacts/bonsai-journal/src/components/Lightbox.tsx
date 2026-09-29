import { useEffect, useRef, useState } from "react";
import {
  X,
  ZoomIn,
  Plus,
  Minus,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Loader2,
} from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface LightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  note?: string | null;
  onSaveNote?: (note: string) => Promise<void>;
  isSavingNote?: boolean;
}

export function Lightbox({
  src,
  alt,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  note,
  onSaveNote,
  isSavingNote = false,
}: LightboxProps) {
  const [savedNote, setSavedNote] = useState(note ?? null);
  const [noteDraft, setNoteDraft] = useState(note ?? "");
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const transitionInProgress = useRef(false);
  const isBusy = isSavingNote || isSubmittingNote;

  const cancelNoteEdit = () => {
    if (isBusy) return;
    setNoteDraft(savedNote ?? "");
    setNoteError(null);
    setIsEditingNote(false);
  };

  const beginNoteEdit = () => {
    if (isBusy) return;
    setNoteDraft(savedNote ?? "");
    setNoteError(null);
    setIsEditingNote(true);
  };

  const saveNoteEdit = async (): Promise<boolean> => {
    if (!onSaveNote) return true;
    if (noteDraft === (savedNote ?? "")) {
      setNoteError(null);
      setIsEditingNote(false);
      return true;
    }

    setIsSubmittingNote(true);
    setNoteError(null);
    try {
      const value = noteDraft.trim() ? noteDraft : "";
      await onSaveNote(value);
      setSavedNote(value || null);
      setNoteDraft(value);
      setIsEditingNote(false);
      return true;
    } catch {
      setNoteError("Couldn’t save the note. Your text is still here; try again.");
      return false;
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const runAfterSaving = async (action: () => void) => {
    if (transitionInProgress.current || isBusy) return;

    if (!isEditingNote || noteDraft === (savedNote ?? "")) {
      setIsEditingNote(false);
      action();
      return;
    }

    transitionInProgress.current = true;
    try {
      if (await saveNoteEdit()) action();
    } finally {
      transitionInProgress.current = false;
    }
  };

  // Keep Escape and arrow keys available to the textarea while editing.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditingNote) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          cancelNoteEdit();
        }
        return;
      }
      if (e.key === "Escape") void runAfterSaving(onClose);
      if (e.key === "ArrowLeft" && hasPrev) void runAfterSaving(onPrev);
      if (e.key === "ArrowRight" && hasNext) void runAfterSaving(onNext);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasNext, hasPrev, isEditingNote, onClose, onNext, onPrev, noteDraft, savedNote, isBusy]);

  const notePanel = onSaveNote ? (
    <section
      aria-label="Photo note"
      className="absolute bottom-4 left-16 right-16 z-20 max-h-[45dvh] overflow-y-auto rounded-xl border border-white/15 bg-black/75 px-3 py-2.5 text-white shadow-xl backdrop-blur-md sm:left-24 sm:right-24 sm:px-4 sm:py-3"
      onClick={(e) => e.stopPropagation()}
    >
      {isEditingNote ? (
        <div className="space-y-2">
          <textarea
            aria-label="Photo note"
            value={noteDraft}
            maxLength={500}
            rows={3}
            onChange={(e) => setNoteDraft(e.target.value)}
            disabled={isBusy}
            className="block max-h-[24dvh] min-h-16 w-full resize-y rounded-md border border-white/20 bg-black/35 px-2.5 py-2 text-sm leading-relaxed text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/60 disabled:opacity-70"
            placeholder="Add a note about this photo…"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs tabular-nums text-white/65" aria-live="polite">
              {noteDraft.length}/500
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelNoteEdit}
                disabled={isBusy}
                className="rounded-md px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveNoteEdit()}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-white/90 disabled:opacity-65"
              >
                {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isBusy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
          {noteError && (
            <p role="alert" className="text-xs text-red-200">
              {noteError}
            </p>
          )}
        </div>
      ) : savedNote ? (
        <div className="flex items-start gap-2.5">
          <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-white">
            {savedNote}
          </p>
          <button
            type="button"
            onClick={beginNoteEdit}
            disabled={isBusy}
            aria-label="Edit note"
            title="Edit note"
            className="shrink-0 rounded-md p-1.5 text-white/75 hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={beginNoteEdit}
          disabled={isBusy}
          className="flex w-full items-center gap-2 text-left text-sm text-white/75 transition-colors hover:text-white disabled:opacity-50"
        >
          <Pencil className="h-3.5 w-3.5" />
          Add a note
        </button>
      )}
    </section>
  ) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => void runAfterSaving(onClose)}
    >
      {/* Close button — stopPropagation so it doesn't also fire the backdrop close */}
      <button
        className="absolute top-4 right-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
        onClick={(e) => { e.stopPropagation(); void runAfterSaving(onClose); }}
        aria-label="Close"
      >
        <X className="w-6 h-6" />
      </button>

      <button
        className="fixed left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-black/50"
        onClick={(e) => {
          e.stopPropagation();
          void runAfterSaving(onPrev);
        }}
        disabled={!hasPrev}
        aria-label="Previous photo"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <button
        className="fixed right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-black/50"
        onClick={(e) => {
          e.stopPropagation();
          void runAfterSaving(onNext);
        }}
        disabled={!hasNext}
        aria-label="Next photo"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/*
       * Zoom/pan wrapper.
       * - stopPropagation on this container prevents clicks inside the image
       *   area from bubbling up to the backdrop's onClose handler, preserving
       *   the original "click outside the image to close" behaviour.
       * - key={src} resets transform state whenever the photo changes.
       */}
      <div onClick={(e) => e.stopPropagation()}>
        <TransformWrapper
          key={src}
          initialScale={1}
          minScale={0.5}
          maxScale={8}
          doubleClick={{ mode: "toggle" }}
          wheel={{ step: 0.1 }}
          centerOnInit
        >
          {({ zoomIn, zoomOut }) => (
            <>
              {/*
               * Desktop +/- controls.
               * Hidden on small screens (mobile uses pinch gestures).
               * Absolutely positioned relative to the fixed backdrop so they
               * always appear at the bottom-centre of the viewport regardless
               * of image size.
               * stopPropagation so these buttons don't trigger the backdrop
               * close handler either (they sit inside the stop-prop div via
               * the DOM tree, but explicit stops are a cleaner guard).
               */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 hidden sm:flex items-center gap-2">
                <button
                  className="rounded-full bg-black/50 p-2.5 text-white hover:bg-black/70 transition-colors"
                  onClick={(e) => { e.stopPropagation(); zoomOut(); }}
                  aria-label="Zoom out"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <button
                  className="rounded-full bg-black/50 p-2.5 text-white hover:bg-black/70 transition-colors"
                  onClick={(e) => { e.stopPropagation(); zoomIn(); }}
                  aria-label="Zoom in"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <TransformComponent wrapperClass="flex items-center justify-center">
                <img
                  src={src}
                  alt={alt ?? "Photo"}
                  style={{ maxWidth: "100vw", maxHeight: "100dvh", objectFit: "contain", display: "block" }}
                  className="select-none"
                  draggable={false}
                />
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>
      {notePanel}
    </div>
  );
}

/** Small overlay hint shown on hover over a photo thumbnail */
export function PhotoZoomHint() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors duration-200 cursor-zoom-in group">
      <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg" />
    </div>
  );
}
