import app from "./app";
import { logger } from "./lib/logger";
import { migrateExistingPhotos } from "./lib/migrate-photos";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Idempotent migration: copy legacy photoUrl values into tree_photos.
// Awaited before the server starts accepting traffic so the gallery is
// consistent from the first request. Race conditions between concurrent
// starts are handled at the DB level by a unique index on (tree_id, photo_url).
try {
  await migrateExistingPhotos();
} catch (err) {
  logger.warn({ err }, "Photo migration failed (non-fatal) — continuing startup");
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
