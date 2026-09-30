import { describe, expect, it } from "vitest";
import monthlyGuideData from "../data/monthlyGuide.json";
import {
  getMonthlyGuide,
  type MonthlyGuideEntry,
} from "../lib/monthlyGuide";

const entries = monthlyGuideData as MonthlyGuideEntry[];

describe("monthly guide data", () => {
  it("has unique months between 1 and 12", () => {
    const months = entries.map((entry) => entry.month);

    expect(new Set(months).size).toBe(months.length);
    for (const month of months) {
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
    }
  });

  it("has complete, non-empty content for every entry", () => {
    for (const entry of entries) {
      expect(entry.title.trim()).not.toBe("");
      expect(entry.intro.trim()).not.toBe("");
      expect(entry.focus.trim()).not.toBe("");
      expect(entry.sections.length).toBeGreaterThan(0);

      for (const section of entry.sections) {
        expect(section.heading.trim()).not.toBe("");
        expect(section.items.length).toBeGreaterThan(0);
        expect(section.items.every((item) => item.trim().length > 0)).toBe(true);
      }
    }
  });
});

describe("getMonthlyGuide", () => {
  it("returns the January entry", () => {
    expect(getMonthlyGuide(1)).toEqual(entries.find((entry) => entry.month === 1));
    expect(getMonthlyGuide(1)?.title).toBe("January Bonsai Checklist");
  });

  it("returns the February entry", () => {
    expect(getMonthlyGuide(2)).toEqual(entries.find((entry) => entry.month === 2));
    expect(getMonthlyGuide(2)?.title).toBe("February Bonsai Checklist");
  });

  it("returns undefined for a month that has not been written", () => {
    expect(getMonthlyGuide(12)).toBeUndefined();
  });
});