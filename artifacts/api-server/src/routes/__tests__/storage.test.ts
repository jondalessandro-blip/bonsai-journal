import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Mock @clerk/express BEFORE importing the app so the module is replaced
// for every module that imports it (including clerkMiddleware and requireAuth).
// ---------------------------------------------------------------------------
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: vi.fn(),
}));

// Mock the ObjectStorageService so no real GCS calls are made.
// Constants must be inlined because vi.mock factories are hoisted before
// variable declarations and would otherwise trigger a TDZ error.
vi.mock('../../lib/objectStorage', () => {
  class ObjectStorageService {
    getObjectEntityUploadURL = vi
      .fn()
      .mockResolvedValue(
        'https://storage.googleapis.com/fake-bucket/objects/test-uuid?X-Goog-Signature=abc',
      );
    normalizeObjectEntityPath = vi.fn().mockReturnValue('/objects/test-uuid');
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
