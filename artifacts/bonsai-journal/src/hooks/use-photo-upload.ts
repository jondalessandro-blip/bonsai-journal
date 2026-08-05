import { useCallback, useState } from "react";

export interface UploadResult {
  objectPath: string;
  /** 1400px JPEG — for record detail view */
  serveUrl: string;
  /** 400px WebP — for collection grid thumbnail */
  thumbUrl: string | null;
}

/**
 * Resize and compress an image using the browser canvas.
 * @param file   Source image file
 * @param maxPx  Longest edge cap in pixels
 * @param quality Encode quality 0–1
 * @param format  MIME type ('image/jpeg' | 'image/webp')
 */
async function resizeImage(
  file: File | Blob,
  maxPx: number,
  quality: number,
  format: "image/jpeg" | "image/webp" = "image/jpeg",
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > maxPx || h > maxPx) {
        if (w >= h) {
          h = Math.round((h / w) * maxPx);
          w = maxPx;
        } else {
          w = Math.round((w / h) * maxPx);
          h = maxPx;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not available"));

      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            // WebP may not be supported — fall back to JPEG
            canvas.toBlob(
              (fb) => { fb ? resolve(fb) : reject(new Error("Canvas toBlob failed")); },
              "image/jpeg",
              quality,
            );
          }
        },
        format,
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for resizing"));
    };

    img.src = url;
  });
}

async function requestPresignedUrl(
  name: string,
  size: number,
  contentType: string,
): Promise<{ uploadURL: string; objectPath: string }> {
  const res = await fetch("/api/storage/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, size, contentType }),
  });
  if (!res.ok) throw new Error("Failed to get upload URL");
  return res.json();
}

async function putBlob(uploadURL: string, blob: Blob, contentType: string): Promise<void> {
  const res = await fetch(uploadURL, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) throw new Error("Upload PUT failed");
}

export function usePhotoUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadPhoto = useCallback(async (file: File): Promise<UploadResult | null> => {
    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      // ── Step 1: resize both sizes client-side ────────────────────────
      setProgress(5);
      let medium: Blob;
      let thumb: Blob | null = null;

      try {
        // Medium: 1400px JPEG 82% — record detail view
        medium = await resizeImage(file, 1400, 0.82, "image/jpeg");
        // Thumb: 400px WebP 70% — collection grid
        thumb = await resizeImage(file, 400, 0.70, "image/webp");
      } catch {
        // Canvas unavailable — fall back to original file, no thumb
        medium = file;
        thumb = null;
      }
      setProgress(15);

      // ── Step 2: request presigned URLs in parallel ───────────────────
      const [mediumMeta, thumbMeta] = await Promise.all([
        requestPresignedUrl(file.name, medium.size, "image/jpeg"),
        thumb
          ? requestPresignedUrl(file.name + ".thumb", thumb.size, "image/webp")
          : Promise.resolve(null),
      ]);
      setProgress(30);

      // ── Step 3: upload both in parallel ─────────────────────────────
      await Promise.all([
        putBlob(mediumMeta.uploadURL, medium, "image/jpeg"),
        thumb && thumbMeta
          ? putBlob(thumbMeta.uploadURL, thumb, "image/webp")
          : Promise.resolve(),
      ]);
      setProgress(100);

      const serveUrl = `/api/storage${mediumMeta.objectPath}`;
      const thumbUrl = thumbMeta ? `/api/storage${thumbMeta.objectPath}` : null;

      return { objectPath: mediumMeta.objectPath, serveUrl, thumbUrl };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { uploadPhoto, isUploading, progress, error };
}
