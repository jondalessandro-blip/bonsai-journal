const RETRY_THRESHOLD_BYTES = 4 * 1024 * 1024; // 4 MB — retry at lower quality

function drawToCanvas(
  img: HTMLImageElement,
  maxWidth: number,
  maxHeight: number,
): HTMLCanvasElement {
  let { naturalWidth: w, naturalHeight: h } = img;
  const scaleW = w > maxWidth ? maxWidth / w : 1;
  const scaleH = h > maxHeight ? maxHeight / h : 1;
  const scale = Math.min(scaleW, scaleH);
  w = Math.round(w * scale);
  h = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: "image/webp" | "image/jpeg",
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          // WebP unsupported in this browser — fall back to JPEG
          canvas.toBlob(
            (fb) =>
              fb ? resolve(fb) : reject(new Error("canvas.toBlob failed")),
            "image/jpeg",
            quality,
          );
        }
      },
      format,
      quality,
    );
  });
}

/**
 * Compress an image file using the browser canvas.
 *
 * - Resizes to fit within maxWidth × maxHeight (preserving aspect ratio).
 * - Encodes at `quality` (0–1) in WebP, falling back to JPEG.
 * - If the result still exceeds 4 MB, retries once at quality 0.6.
 * - Returns a new File with the compressed bytes.
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.75,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = async () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = drawToCanvas(img, maxWidth, maxHeight);
        const format: "image/webp" | "image/jpeg" = "image/webp";

        let blob = await canvasToBlob(canvas, format, quality);

        // If still large, retry once at a lower quality
        if (blob.size > RETRY_THRESHOLD_BYTES) {
          blob = await canvasToBlob(canvas, format, 0.6);
        }

        const ext = blob.type === "image/webp" ? "webp" : "jpg";
        const baseName = file.name.replace(/\.[^.]+$/, "");
        resolve(new File([blob], `${baseName}.${ext}`, { type: blob.type }));
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Compression failed"));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = url;
  });
}
