import { useEffect } from "react";
import { X, ZoomIn } from "lucide-react";

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
      {/* Close button */}
      <button
        className="absolute top-4 right-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Image — stop propagation so clicking the image itself doesn't close */}
      <div
        className="max-w-[90vw] max-h-[90vh] rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt ?? "Photo"}
          className="max-w-[90vw] max-h-[90vh] object-contain"
        />
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
