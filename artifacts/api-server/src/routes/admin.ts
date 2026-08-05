/**
 * POST /admin/nuke-photos
 *
 * Deletes every photo file from object storage and clears all photo fields
 * from the database. Trees themselves are NOT deleted.
 *
 * Requires body: { "confirm": "DELETE PHOTOS" }
 *
 * Returns:
 *   { deletedStorageFiles, failedDeletes, clearedTrees, deletedPhotoRows }
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { isNotNull, or, sql } from "drizzle-orm";
import { db, treesTable, treePhotosTable } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const storage = new ObjectStorageService();

/**
 * Convert a stored serve URL (e.g. "/api/storage/objects/uploads/UUID")
 * to the internal object-entity path ("/objects/uploads/UUID") that
 * ObjectStorageService.getObjectEntityFile() expects.
 */
function serveUrlToObjectPath(serveUrl: string): string | null {
  // Strip leading "/api/storage" if present
  const prefix = "/api/storage";
  if (serveUrl.startsWith(prefix)) {
    return serveUrl.slice(prefix.length);
  }
  // Already a bare /objects/... path
  if (serveUrl.startsWith("/objects/")) {
    return serveUrl;
  }
  return null;
}

async function deleteStorageFile(url: string): Promise<"deleted" | "missing" | "error"> {
  const objectPath = serveUrlToObjectPath(url);
  if (!objectPath) return "error";
  try {
    const file = await storage.getObjectEntityFile(objectPath);
    await file.delete();
    return "deleted";
  } catch (err) {
    if (err instanceof ObjectNotFoundError) return "missing";
    logger.warn({ err, objectPath }, "Failed to delete storage object");
    return "error";
  }
}

router.post("/admin/nuke-photos", async (req: Request, res: Response) => {
  const { confirm } = req.body ?? {};
  if (confirm !== "DELETE PHOTOS") {
    return res.status(400).json({
      error: 'Send body { "confirm": "DELETE PHOTOS" } to proceed.',
    });
  }

  logger.warn("NUKE-PHOTOS: starting — this will delete all photo files and clear photo fields");

  // ── 1. Collect all URLs to delete from storage ─────────────────────────

  // tree_photos rows
  const photoRows = await db
    .select({ id: treePhotosTable.id, photoUrl: treePhotosTable.photoUrl, photoThumb: treePhotosTable.photoThumb })
    .from(treePhotosTable);

  // trees with a cover photo or thumb
  const treeRows = await db
    .select({ id: treesTable.id, photoUrl: treesTable.photoUrl, coverThumb: treesTable.coverThumb })
    .from(treesTable)
    .where(or(isNotNull(treesTable.photoUrl), isNotNull(treesTable.coverThumb)));

  // Deduplicate URLs (a gallery photo URL and a cover URL may be the same file)
  const urlSet = new Set<string>();
  for (const row of photoRows) {
    if (row.photoUrl) urlSet.add(row.photoUrl);
    if (row.photoThumb) urlSet.add(row.photoThumb);
  }
  for (const row of treeRows) {
    if (row.photoUrl) urlSet.add(row.photoUrl);
    if (row.coverThumb) urlSet.add(row.coverThumb);
  }

  const allUrls = Array.from(urlSet);
  logger.info({ count: allUrls.length }, "NUKE-PHOTOS: unique storage files to delete");

  // ── 2. Delete storage files (parallel, best-effort) ─────────────────────
  const results = await Promise.all(allUrls.map(deleteStorageFile));
  const deleted = results.filter((r) => r === "deleted").length;
  const missing = results.filter((r) => r === "missing").length;
  const failed  = results.filter((r) => r === "error").length;

  logger.info({ deleted, missing, failed }, "NUKE-PHOTOS: storage deletion complete");

  // ── 3. Delete all tree_photos rows ──────────────────────────────────────
  const deletedRows = await db.execute(sql`DELETE FROM tree_photos`);
  const deletedPhotoRows = (deletedRows as unknown as { rowCount?: number }).rowCount ?? 0;

  // ── 4. Clear photo fields on all trees ──────────────────────────────────
  const updated = await db.execute(sql`
    UPDATE trees
    SET photo_url = NULL, cover_thumb = NULL, cover_position = NULL
    WHERE photo_url IS NOT NULL OR cover_thumb IS NOT NULL
  `);
  const clearedTrees = (updated as unknown as { rowCount?: number }).rowCount ?? 0;

  logger.warn(
    { deleted, missing, failed, clearedTrees, deletedPhotoRows },
    "NUKE-PHOTOS: complete",
  );

  return res.json({
    deletedStorageFiles: deleted,
    missingStorageFiles: missing,
    failedStorageDeletes: failed,
    clearedTrees,
    deletedPhotoRows,
    summary: `Deleted ${deleted} storage files (${missing} already gone, ${failed} errors). Cleared ${clearedTrees} trees. Removed ${deletedPhotoRows} photo rows.`,
  });
});

export default router;
