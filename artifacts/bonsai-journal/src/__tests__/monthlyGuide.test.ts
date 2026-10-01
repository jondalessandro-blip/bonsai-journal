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

  it("has no doubled asterisks in guide text", () => {
    const text = entries.flatMap((entry) => [
      entry.title,
      entry.intro,
      entry.focus,
      ...entry.sections.flatMap((section) => [section.heading, ...section.items]),
    ]);

    expect(text.every((value) => !value.includes("**"))).toBe(true);
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

  it("returns the March entry with eight sections", () => {
    const march = getMonthlyGuide(3);

    expect(march?.title).toBe("March Bonsai Checklist");
    expect(march?.sections).toHaveLength(8);
  });

  it("returns the April entry with seven sections", () => {
    const april = getMonthlyGuide(4);

    expect(april?.title).toBe("April Bonsai Checklist");
    expect(april?.sections).toHaveLength(7);
  });

  it("returns the May entry with seven sections", () => {
    const may = getMonthlyGuide(5);

    expect(may?.title).toBe("May Bonsai Checklist");
    expect(may?.sections).toHaveLength(7);
  });

  it("returns the June entry with eight sections", () => {
    const june = getMonthlyGuide(6);

    expect(june?.title).toBe("June Bonsai Checklist");
    expect(june?.sections).toHaveLength(8);
  });

  it("returns the July entry with eight sections", () => {
    const july = getMonthlyGuide(7);

    expect(july?.title).toBe("July Bonsai Checklist");
    expect(july?.sections).toHaveLength(8);
  });

  it("returns the August entry with eight sections", () => {
    const august = getMonthlyGuide(8);

    expect(august?.title).toBe("August Bonsai Checklist");
    expect(august?.sections).toHaveLength(8);
  });

  it("returns the October entry with seven sections", () => {
    const october = getMonthlyGuide(10);

    expect(october?.title).toBe("October Bonsai Checklist");
    expect(october?.sections).toHaveLength(7);
  });

  it("returns undefined for a month that has not been written", () => {
    expect(getMonthlyGuide(12)).toBeUndefined();
  });
});