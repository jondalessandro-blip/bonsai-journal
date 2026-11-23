import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dbExecute: vi.fn(),
  loggerInfo: vi.fn(),
  capturedSql: [] as string[],
}));

vi.mock("@workspace/db", () => ({
  db: {
    execute: (query: any) => {
      const text: string = Array.isArray(query?.queryChunks)
        ? query.queryChunks
            .map((chunk: any) =>
              typeof chunk === "string" ? chunk : (chunk?.value ?? ""),
            )
            .join("")
        : String(query);
      mocks.capturedSql.push(text);
      return mocks.dbExecute(query);
    },
  },
}));

vi.mock("../logger", () => ({
  logger: { info: mocks.loggerInfo },
}));

import { migrateDormantHealthStatus } from "../migrate-dormant-status";

describe("migrateDormantHealthStatus", () => {
  beforeEach(() => {
    mocks.capturedSql.length = 0;
    mocks.dbExecute.mockReset();
    mocks.loggerInfo.mockReset();
  });

  it("converts only exact Dormant statuses and records the original date", async () => {
    mocks.dbExecute.mockResolvedValue({
      rows: [{ migrated_count: 3 }],
      rowCount: 1,
    });

    await expect(migrateDormantHealthStatus()).resolves.toBe(3);

    const migrationSql = mocks.capturedSql.join("\n");
    expect(migrationSql).toContain("WHERE status = 'Dormant'");
    expect(migrationSql).toContain("status = NULL");
    expect(migrationSql).toContain("is_dormant = TRUE");
    expect(migrationSql).toContain("dormant_since = updated_at::date::timestamptz");
    expect(migrationSql).toContain("'Began dormancy'");
    expect(migrationSql).toContain("updated_at::date::text");
    expect(migrationSql).not.toMatch(/SET[\s\S]*updated_at\s*=/i);
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      { migrated: 3 },
      "Legacy Dormant health statuses converted to seasonal dormancy",
    );
  });

  it("logs a zero-change summary on an idempotent rerun", async () => {
    mocks.dbExecute.mockResolvedValue({ rows: [{ migrated_count: 0 }], rowCount: 1 });

    await expect(migrateDormantHealthStatus()).resolves.toBe(0);

    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      { migrated: 0 },
      "Legacy Dormant health statuses converted to seasonal dormancy",
    );
  });
});
