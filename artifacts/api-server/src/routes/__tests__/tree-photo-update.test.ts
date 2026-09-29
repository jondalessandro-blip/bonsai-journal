import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: any, _res: any, next: any) => next(),
  getAuth: vi.fn(),
}));

const {
  selectResultHolder,
  updateResultHolder,
  capturedUpdateSet,
  mockSelect,
  mockUpdate,
} = vi.hoisted(() => {
  const selectResultHolder: { rows: any[] } = { rows: [] };
  const updateResultHolder: { rows: any[] } = { rows: [] };
  const capturedUpdateSet: { current: Record<string, unknown> | null } = {
    current: null,
  };

  const mockSelect = vi.fn(() => {
    const chain: any = {
      from: () => chain,
      where: () => chain,
      then: (resolve: any, reject?: any) =>
        Promise.resolve(selectResultHolder.rows).then(resolve, reject),
    };
    return chain;
  });

  const mockUpdate = vi.fn(() => {
    const chain: any = {
      set: (values: Record<string, unknown>) => {
        capturedUpdateSet.current = values;
        updateResultHolder.rows = updateResultHolder.rows.map((row) => ({
          ...row,
          ...values,
        }));
        return chain;
      },
      where: () => chain,
      returning: () => Promise.resolve(updateResultHolder.rows),
    };
    return chain;
  });

  return {
    selectResultHolder,
    updateResultHolder,
    capturedUpdateSet,
    mockSelect,
    mockUpdate,
  };
});

vi.mock("@workspace/db", () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
  },
  treesTable: { id: "id", userId: "userId" },
  treePhotosTable: {
    id: "id",
    treeId: "treeId",
    takenAt: "takenAt",
    note: "note",
    createdAt: "createdAt",
    insertionSeq: "insertionSeq",
  },
  careLogsTable: {},
  careRemindersTable: {},
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const real = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...real,
    and: (...args: any[]) => ({ _tag: "and", args }),
    eq: (a: any, b: any) => ({ _tag: "eq", a, b }),
  };
});

import app from "../../app";
import { getAuth } from "@clerk/express";

const USER_ID = "user_photo_update";
const TREE_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const PHOTO_ID = "bbbbbbbb-0000-0000-0000-000000000001";
const ENDPOINT = `/api/trees/${TREE_ID}/photos/${PHOTO_ID}`;

const fakeTree = { id: TREE_ID, userId: USER_ID };
const originalPhoto = {
  id: PHOTO_ID,
  treeId: TREE_ID,
  photoUrl: "https://cdn.example.com/progression.jpg",
  photoThumb: null,
  takenAt: "2025-01-02",
  note: "Existing note",
  createdAt: new Date("2025-01-02T10:00:00Z"),
  insertionSeq: 1,
};

describe("PATCH /api/trees/:id/photos/:photoId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResultHolder.rows = [fakeTree];
    updateResultHolder.rows = [{ ...originalPhoto }];
    capturedUpdateSet.current = null;
    vi.mocked(getAuth).mockReturnValue({ userId: USER_ID } as any);
  });

  it("changes only takenAt when only the date is sent", async () => {
    const res = await request(app).patch(ENDPOINT).send({ takenAt: "2025-02-03" });

    expect(res.status).toBe(200);
    expect(capturedUpdateSet.current).toEqual({ takenAt: "2025-02-03" });
    expect(res.body).toMatchObject({
      takenAt: "2025-02-03",
      note: "Existing note",
    });
  });

  it("changes only note and trims its whitespace", async () => {
    const res = await request(app)
      .patch(ENDPOINT)
      .send({ note: "  New note  " });

    expect(res.status).toBe(200);
    expect(capturedUpdateSet.current).toEqual({ note: "New note" });
    expect(res.body).toMatchObject({
      takenAt: "2025-01-02",
      note: "New note",
    });
  });

  it("clears a note when the submitted value is blank", async () => {
    const res = await request(app).patch(ENDPOINT).send({ note: "   " });

    expect(res.status).toBe(200);
    expect(capturedUpdateSet.current).toEqual({ note: null });
    expect(res.body.note).toBeNull();
  });

  it("changes both fields when both are sent", async () => {
    const res = await request(app)
      .patch(ENDPOINT)
      .send({ takenAt: "2025-02-03", note: "  Repotted  " });

    expect(res.status).toBe(200);
    expect(capturedUpdateSet.current).toEqual({
      takenAt: "2025-02-03",
      note: "Repotted",
    });
    expect(res.body).toMatchObject({
      takenAt: "2025-02-03",
      note: "Repotted",
    });
  });

  it("rejects an empty update", async () => {
    const res = await request(app).patch(ENDPOINT).send({});

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects notes longer than 500 characters", async () => {
    const res = await request(app)
      .patch(ENDPOINT)
      .send({ note: "a".repeat(501) });

    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});