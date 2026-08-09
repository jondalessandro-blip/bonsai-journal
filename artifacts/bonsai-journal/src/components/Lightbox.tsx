import { useEffect } from "react";
import { X, ZoomIn, Plus, Minus } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface LightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export function Lightbox({ src, alt, onClose }: LightboxProps) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Close button — stopPropagation so it doesn't also fire the backdrop close */}
      <button
        className="absolute top-4 right-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Close"
      >
        <X className="w-6 h-6" />
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
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden sm:flex items-center gap-2">
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

              <TransformComponent wrapperClass="rounded-xl overflow-hidden shadow-2xl">
                <img
                  src={src}
                  alt={alt ?? "Photo"}
                  style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", display: "block" }}
                  className="select-none"
                  draggable={false}
                />
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>
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
