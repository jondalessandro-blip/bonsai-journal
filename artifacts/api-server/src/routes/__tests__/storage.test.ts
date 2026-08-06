import { createHmac } from 'node:crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

/** Mirrors the server-side generateOwnershipToken logic for test use. */
function makeOwnershipToken(userId: string, objectPath: string): string {
  const secret = process.env.SESSION_SECRET ?? 'dev-secret';
  return createHmac('sha256', secret).update(`${userId}:${objectPath}`).digest('hex');
}

// ---------------------------------------------------------------------------
// Mock @clerk/express BEFORE importing the app so the module is replaced
// for every module that imports it (including clerkMiddleware and requireAuth).
// ---------------------------------------------------------------------------
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: vi.fn(),
}));

// vi.hoisted runs before vi.mock factories, so these refs are available inside the factory.
const {
  mockGetObjectEntityUploadURL,
  mockNormalizeObjectEntityPath,
  mockGetObjectEntityFile,
  mockCanAccessObjectEntity,
  mockDownloadObject,
  mockTrySetObjectEntityAclPolicy,
} = vi.hoisted(() => ({
  mockGetObjectEntityUploadURL: vi
    .fn()
    .mockResolvedValue(
      'https://storage.googleapis.com/fake-bucket/objects/test-uuid?X-Goog-Signature=abc',
    ),
  mockNormalizeObjectEntityPath: vi.fn().mockReturnValue('/objects/test-uuid'),
  mockGetObjectEntityFile: vi
    .fn()
    .mockResolvedValue({ name: 'objects/test-uuid' }),
  mockCanAccessObjectEntity: vi.fn().mockResolvedValue(true),
  mockDownloadObject: vi.fn().mockResolvedValue({
    status: 200,
    headers: new Headers({ 'content-type': 'image/jpeg' }),
    body: null,
  }),
  mockTrySetObjectEntityAclPolicy: vi.fn().mockResolvedValue('/objects/test-uuid'),
}));

// Mock the ObjectStorageService so no real GCS calls are made.
vi.mock('../../lib/objectStorage', () => {
  class ObjectStorageService {
    getObjectEntityUploadURL = mockGetObjectEntityUploadURL;
    normalizeObjectEntityPath = mockNormalizeObjectEntityPath;
    getObjectEntityFile = mockGetObjectEntityFile;
    canAccessObjectEntity = mockCanAccessObjectEntity;
    downloadObject = mockDownloadObject;
    trySetObjectEntityAclPolicy = mockTrySetObjectEntityAclPolicy;
  }

  class ObjectNotFoundError extends Error {
    constructor() {
      super('Object not found');
      this.name = 'ObjectNotFoundError';
    }
  }

  return { ObjectStorageService, ObjectNotFoundError };
});

// Import the app after mocks are registered.
import app from '../../app';
import { getAuth } from '@clerk/express';

const ENDPOINT = '/api/storage/uploads/request-url';

const validBody = {
  name: 'photo.jpg',
  size: 1024,
  contentType: 'image/jpeg',
};

describe('POST /api/storage/uploads/request-url', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 401 – anonymous / unauthenticated request
  // -------------------------------------------------------------------------
  it('returns 401 when no session is present', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: null } as any);

    const res = await request(app).post(ENDPOINT).send(validBody);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'Unauthorized' });
  });

  // -------------------------------------------------------------------------
  // 401 – explicitly invalid / expired token (userId still null)
  // -------------------------------------------------------------------------
  it('returns 401 when the Authorization header is present but userId is null', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: null } as any);

    const res = await request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer invalid-token')
      .send(validBody);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'Unauthorized' });
  });

  // -------------------------------------------------------------------------
  // 200 – authenticated user gets a presigned URL
  // -------------------------------------------------------------------------
  it('returns 200 with uploadURL and objectPath for an authenticated user', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: 'user_abc123' } as any);

    const res = await request(app).post(ENDPOINT).send(validBody);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('uploadURL');
    expect(typeof res.body.uploadURL).toBe('string');
    expect(res.body.uploadURL.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('objectPath');
    expect(typeof res.body.objectPath).toBe('string');
    expect(res.body.objectPath.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 400 – missing required body fields
  // -------------------------------------------------------------------------
  it('returns 400 when body is missing all fields', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: 'user_abc123' } as any);

    const res = await request(app).post(ENDPOINT).send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it('returns 400 when name is missing', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: 'user_abc123' } as any);

    const res = await request(app)
      .post(ENDPOINT)
      .send({ size: 1024, contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it('returns 400 when size is missing', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: 'user_abc123' } as any);

    const res = await request(app)
      .post(ENDPOINT)
      .send({ name: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it('returns 400 when contentType is missing', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: 'user_abc123' } as any);

    const res = await request(app)
      .post(ENDPOINT)
      .send({ name: 'photo.jpg', size: 1024 });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it('returns 400 when body is empty', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: 'user_abc123' } as any);

    const res = await request(app)
      .post(ENDPOINT)
      .set('Content-Type', 'application/json')
      .send('');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });
});

const DOWNLOAD_ENDPOINT = '/api/storage/objects/test-uuid';

describe('GET /api/storage/objects/:path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore defaults after each test
    mockGetObjectEntityFile.mockResolvedValue({ name: 'objects/test-uuid' });
    mockCanAccessObjectEntity.mockResolvedValue(true);
    mockDownloadObject.mockResolvedValue({
      status: 200,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      body: null,
    });
  });

  // -------------------------------------------------------------------------
  // 401 – unauthenticated request
  // -------------------------------------------------------------------------
  it('returns 401 when no session is present', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: null } as any);

    const res = await request(app).get(DOWNLOAD_ENDPOINT);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'Unauthorized' });
  });

  // -------------------------------------------------------------------------
  // 403 – authenticated but ACL denies access
  // -------------------------------------------------------------------------
  it('returns 403 when the user does not own the file', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: 'user_other' } as any);
    mockCanAccessObjectEntity.mockResolvedValue(false);

    const res = await request(app).get(DOWNLOAD_ENDPOINT);

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'Forbidden' });
  });

  // -------------------------------------------------------------------------
  // 200 – authenticated owner gets the file
  // -------------------------------------------------------------------------
  it('returns 200 when the authenticated user owns the file', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: 'user_abc123' } as any);
    mockCanAccessObjectEntity.mockResolvedValue(true);

    const res = await request(app).get(DOWNLOAD_ENDPOINT);

    expect(res.status).toBe(200);
  });

  // -------------------------------------------------------------------------
  // ACL check receives the correct userId
  // -------------------------------------------------------------------------
  it('passes the authenticated userId to the ACL check', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: 'user_abc123' } as any);

    await request(app).get(DOWNLOAD_ENDPOINT);

    expect(mockCanAccessObjectEntity).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user_abc123' }),
    );
  });

  // -------------------------------------------------------------------------
  // Cache policy — private objects must never be publicly cacheable
  // -------------------------------------------------------------------------
  it('sets Cache-Control: private, no-store on a successful download', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: 'user_abc123' } as any);

    const res = await request(app).get(DOWNLOAD_ENDPOINT);

    expect(res.status).toBe(200);
    const cacheControl = res.headers['cache-control'] ?? '';
    expect(cacheControl).toMatch(/private/);
    expect(cacheControl).toMatch(/no-store/);
    expect(cacheControl).not.toMatch(/public/);
  });
});

const FINALIZE_ENDPOINT = '/api/storage/uploads/finalize';

describe('POST /api/storage/uploads/finalize', () => {
  const TEST_USER = 'user_abc123';
  const TEST_PATH = '/objects/test-uuid';

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetObjectEntityFile.mockResolvedValue({ name: 'objects/test-uuid' });
    mockCanAccessObjectEntity.mockResolvedValue(true);
    mockDownloadObject.mockResolvedValue({
      status: 200,
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      body: null,
    });
    mockTrySetObjectEntityAclPolicy.mockResolvedValue(TEST_PATH);
  });

  // -------------------------------------------------------------------------
  // 401 – unauthenticated request
  // -------------------------------------------------------------------------
  it('returns 401 when no session is present', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: null } as any);

    const res = await request(app)
      .post(FINALIZE_ENDPOINT)
      .send({ objectPath: TEST_PATH, ownershipToken: makeOwnershipToken(TEST_USER, TEST_PATH) });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'Unauthorized' });
  });

  // -------------------------------------------------------------------------
  // 400 – missing objectPath or ownershipToken
  // -------------------------------------------------------------------------
  it('returns 400 when objectPath is missing', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: TEST_USER } as any);

    const res = await request(app)
      .post(FINALIZE_ENDPOINT)
      .send({ ownershipToken: makeOwnershipToken(TEST_USER, TEST_PATH) });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it('returns 400 when ownershipToken is missing', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: TEST_USER } as any);

    const res = await request(app)
      .post(FINALIZE_ENDPOINT)
      .send({ objectPath: TEST_PATH });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  // -------------------------------------------------------------------------
  // 403 – invalid ownership token (prevents ACL takeover)
  // -------------------------------------------------------------------------
  it('returns 403 when the token was minted for a different user', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: 'user_attacker' } as any);
    // Token was minted for TEST_USER, not the attacker
    const victimToken = makeOwnershipToken(TEST_USER, TEST_PATH);

    const res = await request(app)
      .post(FINALIZE_ENDPOINT)
      .send({ objectPath: TEST_PATH, ownershipToken: victimToken });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'Invalid ownership token' });
    expect(mockTrySetObjectEntityAclPolicy).not.toHaveBeenCalled();
  });

  it('returns 403 when the token is for a different objectPath', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: TEST_USER } as any);
    // Token was minted for a different path
    const wrongPathToken = makeOwnershipToken(TEST_USER, '/objects/other-uuid');

    const res = await request(app)
      .post(FINALIZE_ENDPOINT)
      .send({ objectPath: TEST_PATH, ownershipToken: wrongPathToken });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'Invalid ownership token' });
    expect(mockTrySetObjectEntityAclPolicy).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 200 – valid token: sets private ACL with the authenticated user as owner
  // -------------------------------------------------------------------------
  it('returns 200 and sets a private owner ACL for the authenticated user', async () => {
    vi.mocked(getAuth).mockReturnValue({ userId: TEST_USER } as any);
    const token = makeOwnershipToken(TEST_USER, TEST_PATH);

    const res = await request(app)
      .post(FINALIZE_ENDPOINT)
      .send({ objectPath: TEST_PATH, ownershipToken: token });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ objectPath: TEST_PATH });
    expect(mockTrySetObjectEntityAclPolicy).toHaveBeenCalledWith(
      TEST_PATH,
      expect.objectContaining({ owner: TEST_USER, visibility: 'private' }),
    );
  });

  // -------------------------------------------------------------------------
  // ownership round-trip: uploader can download; a stranger cannot
  // -------------------------------------------------------------------------
  it('owner can download after finalize; non-owner is denied', async () => {
    const UPLOADER = 'user_uploader';

    // Step 1: finalize as the uploader (valid token)
    vi.mocked(getAuth).mockReturnValue({ userId: UPLOADER } as any);
    const finalizeRes = await request(app)
      .post(FINALIZE_ENDPOINT)
      .send({ objectPath: TEST_PATH, ownershipToken: makeOwnershipToken(UPLOADER, TEST_PATH) });
    expect(finalizeRes.status).toBe(200);

    // Step 2: owner downloads successfully
    mockCanAccessObjectEntity.mockResolvedValue(true);
    const ownerDownload = await request(app).get(DOWNLOAD_ENDPOINT);
    expect(ownerDownload.status).toBe(200);

    // Step 3: a different user is denied by ACL
    vi.mocked(getAuth).mockReturnValue({ userId: 'user_stranger' } as any);
    mockCanAccessObjectEntity.mockResolvedValue(false);
    const strangerDownload = await request(app).get(DOWNLOAD_ENDPOINT);
    expect(strangerDownload.status).toBe(403);

    // Step 4: a stranger cannot steal ownership via finalize
    const stolenToken = makeOwnershipToken(UPLOADER, TEST_PATH); // wrong user
    mockTrySetObjectEntityAclPolicy.mockClear();
    const takeoverRes = await request(app)
      .post(FINALIZE_ENDPOINT)
      .send({ objectPath: TEST_PATH, ownershipToken: stolenToken });
    expect(takeoverRes.status).toBe(403); // token is for UPLOADER, not stranger
    expect(mockTrySetObjectEntityAclPolicy).not.toHaveBeenCalled();
  });
});
