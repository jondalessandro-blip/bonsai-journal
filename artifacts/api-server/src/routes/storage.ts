import { createHmac } from 'node:crypto';
import { Readable } from 'stream';
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from '@workspace/api-zod';
import { Router, type IRouter, type Request, type Response } from 'express';

import { ObjectPermission } from '../lib/objectAcl';
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from '../lib/objectStorage';
import { requireAuth, type AuthedRequest } from '../middlewares/requireAuth';

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * Generates an HMAC-SHA256 token that binds a userId to an objectPath.
 * Used to verify that the caller who requests an upload URL is the same
 * caller who later finalizes ownership — preventing ACL takeover.
 *
 * Requires SESSION_SECRET to be set. Throws at startup if absent so
 * misconfigured deployments fail loudly rather than silently weakening
 * the ownership guarantee.
 */
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      'SESSION_SECRET environment variable is not set. ' +
      'This is required for secure ownership token generation.',
    );
  }
  return secret;
}

function generateOwnershipToken(userId: string, objectPath: string): string {
  return createHmac('sha256', getSessionSecret())
    .update(`${userId}:${objectPath}`)
    .digest('hex');
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 * Requires auth middleware so public callers cannot mint write-capable URLs.
 */
router.post(
  '/storage/uploads/request-url',
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Missing or invalid required fields' });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;

      const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
      if (size > MAX_UPLOAD_BYTES) {
        res.status(413).json({ error: "File too large (max 5 MB)" });
        return;
      }

      const userId = (req as AuthedRequest).userId;
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath =
        objectStorageService.normalizeObjectEntityPath(uploadURL);
      const ownershipToken = generateOwnershipToken(userId, objectPath);

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          ownershipToken,
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, 'Error generating upload URL');
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  },
);

/**
 * POST /storage/uploads/finalize
 *
 * After a direct-to-GCS upload via presigned URL, the client calls this
 * endpoint to record the authenticated user as the owner of the object.
 * Sets a private ACL policy so only the uploader can later download the file.
 *
 * Upload flow:
 *   1. POST /storage/uploads/request-url  → { uploadURL, objectPath }
 *   2. PUT  <uploadURL>                   → upload file directly to GCS
 *   3. POST /storage/uploads/finalize     → { objectPath }  (this endpoint)
 */
router.post(
  '/storage/uploads/finalize',
  requireAuth,
  async (req: Request, res: Response) => {
    const objectPath =
      typeof req.body?.objectPath === 'string' && req.body.objectPath.length > 0
        ? req.body.objectPath
        : null;
    const ownershipToken =
      typeof req.body?.ownershipToken === 'string' && req.body.ownershipToken.length > 0
        ? req.body.ownershipToken
        : null;

    if (!objectPath || !ownershipToken) {
      res.status(400).json({ error: 'Missing objectPath or ownershipToken' });
      return;
    }

    try {
      const userId = (req as AuthedRequest).userId;

      // Verify the token was minted for this exact user+objectPath pair.
      // This prevents any other authenticated user from claiming ownership
      // of an object they did not upload.
      const expectedToken = generateOwnershipToken(userId, objectPath);
      if (ownershipToken !== expectedToken) {
        res.status(403).json({ error: 'Invalid ownership token' });
        return;
      }

      await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
        owner: userId,
        visibility: 'private',
      });

      res.status(200).json({ objectPath });
    } catch (error) {
      req.log.error({ err: error }, 'Error finalizing upload');
      res.status(500).json({ error: 'Failed to finalize upload' });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get(
  '/storage/public-objects/*filePath',
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join('/') : raw;
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const response = await objectStorageService.downloadObject(file);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        );
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      req.log.error({ err: error }, 'Error serving public object');
      res.status(500).json({ error: 'Failed to serve public object' });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get(
  '/storage/objects/*path',
  requireAuth,
  async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join('/') : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile =
      await objectStorageService.getObjectEntityFile(objectPath);

    const userId = (req as AuthedRequest).userId;
    const canAccess = await objectStorageService.canAccessObjectEntity({
      userId,
      objectFile,
      requestedPermission: ObjectPermission.READ,
    });
    if (!canAccess) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    // Private objects must never be stored by shared caches. Each request
    // must hit this auth-checked route; no intermediary may serve a cached
    // copy to a different caller.
    if (response.status === 200) {
      res.setHeader('Cache-Control', 'private, no-store');
    }

    if (response.body) {
      const nodeStream = Readable.fromWeb(
        response.body as ReadableStream<Uint8Array>,
      );
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, 'Object not found');
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    req.log.error({ err: error }, 'Error serving object');
    res.status(500).json({ error: 'Failed to serve object' });
  }
});

export default router;
