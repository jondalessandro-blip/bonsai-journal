import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  ImagePlus,
  Loader2,
  Pencil,
  Trash2,
  Check,
  X as XIcon,
} from "lucide-react";
import {
  useListTreePhotos,
  useCreateTreePhoto,
  useUpdateTreePhoto,
  useDeleteTreePhoto,
} from "@workspace/api-client-react";
import type { TreePhoto } from "@workspace/api-client-react";
import { usePhotoUpload } from "@/hooks/use-photo-upload";
import { Lightbox } from "@/components/Lightbox";
import { Button } from "@/components/ui/button";

interface Props {
  treeId: string;
}

export function ProgressionGallery({ treeId }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const queryKey = ["/api/trees", treeId, "photos"];

  const { data: photos = [], isLoading } = useListTreePhotos(treeId, {
    query: { queryKey, enabled: !!treeId },
  });

  const createPhoto = useCreateTreePhoto();
  const updatePhoto = useUpdateTreePhoto();
  const deletePhoto = useDeleteTreePhoto();
  const { uploadPhoto, isUploading, progress } = usePhotoUpload();

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const result = await uploadPhoto(file);
    if (result) {
      const today = new Date().toISOString().slice(0, 10);
      createPhoto.mutate(
        {
          id: treeId,
          data: {
            photoUrl: result.serveUrl,
            ...(result.thumbUrl ? { photoThumb: result.thumbUrl } : {}),
            takenAt: today,
          },
        },
        { onSuccess: invalidate },
      );
    }
  };

  const startEdit = (photo: TreePhoto) => {
    setEditingId(photo.id);
    setEditingDate(photo.takenAt);
  };

  const saveEdit = () => {
    if (!editingId || !editingDate) return;
    updatePhoto.mutate(
      { id: treeId, photoId: editingId, data: { takenAt: editingDate } },
      {
        onSuccess: () => {
          invalidate();
          setEditingId(null);
        },
      },
    );
  };

  const handleDelete = (photoId: string) => {
    deletePhoto.mutate(
      { id: treeId, photoId },
      {
        onSuccess: () => {
          invalidate();
          setConfirmDeleteId(null);
          // Close lightbox if the deleted photo was open
          setLightboxIndex(null);
        },
      },
    );
  };

  const currentLightboxPhoto =
    lightboxIndex !== null ? photos[lightboxIndex] : null;

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif">Progression</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || createPhoto.isPending}
        >
          {isUploading || createPhoto.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ImagePlus className="w-4 h-4 mr-2" />
          )}
          {isUploading ? `${progress}%` : "Add Photo"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="aspect-[4/3] rounded-lg bg-muted animate-pulse" />
              <div className="h-3 w-20 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && photos.length === 0 && (
        <button
          className="w-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/60 py-14 text-center hover:border-primary/40 hover:bg-muted/30 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <ImagePlus className="w-10 h-10 mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            No progression photos yet
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Tap to document this tree&apos;s journey
          </p>
        </button>
      )}

      {/* Gallery grid */}
      {!isLoading && photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((photo, idx) => (
            <div key={photo.id} className="group relative">
              {/* Tile */}
              <div
                className="aspect-[4/3] rounded-lg overflow-hidden border border-border/50 bg-muted cursor-zoom-in relative"
                onClick={() => {
                  if (confirmDeleteId !== photo.id) setLightboxIndex(idx);
                }}
              >
                <img
                  src={photo.photoUrl}
                  alt={`Progression — ${photo.takenAt}`}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* Delete button — always visible on mobile, hover-only on desktop */}
                <div className="absolute top-1.5 right-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity flex gap-1 z-10">
                  {confirmDeleteId === photo.id ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(photo.id);
                        }}
                        className="flex items-center gap-1 text-[10px] font-semibold bg-destructive text-destructive-foreground rounded px-2 py-1 shadow"
                      >
                        <Check className="w-3 h-3" />
                        Delete
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(null);
                        }}
                        className="bg-card/90 text-foreground rounded p-1 shadow"
                        aria-label="Cancel"
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(photo.id);
                      }}
                      className="bg-black/60 text-white rounded p-1.5 hover:bg-destructive transition-colors shadow"
                      aria-label="Delete photo"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Date — click to edit */}
              <div className="mt-1.5 px-0.5">
                {editingId === photo.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={editingDate}
                      onChange={(e) => setEditingDate(e.target.value)}
                      className="flex-1 min-w-0 text-xs border rounded px-1.5 py-0.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <button
                      onClick={saveEdit}
                      disabled={updatePhoto.isPending}
                      className="p-1 rounded hover:bg-primary/10 text-primary transition-colors shrink-0"
                      aria-label="Save date"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors shrink-0"
                      aria-label="Cancel"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    className="group/date flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
                    onClick={() => startEdit(photo)}
                    title="Click to edit date"
                  >
                    <time dateTime={photo.takenAt}>
                      {format(parseISO(photo.takenAt), "MMM d, yyyy")}
                    </time>
                    <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/date:opacity-50 transition-opacity shrink-0" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {currentLightboxPhoto && (
        <Lightbox
          src={currentLightboxPhoto.photoUrl}
          alt={`Progression — ${format(parseISO(currentLightboxPhoto.takenAt), "MMM d, yyyy")}`}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </section>
  );
}
