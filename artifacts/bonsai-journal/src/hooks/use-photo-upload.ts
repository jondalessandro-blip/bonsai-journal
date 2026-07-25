import { useCallback, useState } from "react";

interface UploadResult {
  objectPath: string;
  /** Full URL to use as photoUrl, served through the API */
  serveUrl: string;
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
      // Step 1: request presigned URL from our API
      setProgress(10);
      const metaRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "image/jpeg",
        }),
      });

      if (!metaRes.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadURL, objectPath } = await metaRes.json();
      setProgress(30);

      // Step 2: upload file directly to GCS via presigned URL
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "image/jpeg" },
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
