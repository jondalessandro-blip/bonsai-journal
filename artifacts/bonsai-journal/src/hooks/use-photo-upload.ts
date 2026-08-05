import { useCallback, useState } from "react";

interface UploadResult {
  objectPath: string;
  /** Full URL to use as photoUrl, served through the API */
  serveUrl: string;
}

/**
 * Resize and compress an image file client-side before upload.
 * Outputs a JPEG with longest edge capped at maxPx and the given quality.
 * Keeps EXIF-free output; ~150–350 KB for typical garden photos.
 */
async function resizeImage(
  file: File,
  maxPx = 1400,
  quality = 0.82,
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
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        },
        "image/jpeg",
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

export function usePhotoUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadPhoto = useCallback(async (file: File): Promise<UploadResult | null> => {
    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Step 1: resize + compress client-side before touching the network
      setProgress(5);
      let uploadBlob: Blob;
      try {
        uploadBlob = await resizeImage(file);
      } catch {
        // If canvas resize fails (e.g. SVG), fall back to original file
        uploadBlob = file;
      }
      setProgress(10);

      // Step 2: request presigned URL from our API
      const metaRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: uploadBlob.size,
          contentType: "image/jpeg",
        }),
      });

      if (!metaRes.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadURL, objectPath } = await metaRes.json();
      setProgress(30);

      // Step 3: upload the resized blob directly to GCS via presigned URL
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: uploadBlob,
        headers: { "Content-Type": "image/jpeg" },
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload photo");
      }

      setProgress(100);

      // objectPath looks like "/objects/uploads/some-uuid"
      // serve via /api/storage + objectPath
      const serveUrl = `/api/storage${objectPath}`;

      return { objectPath, serveUrl };
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
