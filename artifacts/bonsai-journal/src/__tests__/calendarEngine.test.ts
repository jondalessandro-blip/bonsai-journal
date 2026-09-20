import { describe, it, expect } from "vitest";
import zonesJson from "../data/careCalendar/zones.json";
import groupsJson from "../data/careCalendar/groups.json";
import { generateCalendar, resolveTaskDay, type Zone, type Group } from "../lib/calendarEngine";
import { matchTreeToGroup } from "../lib/groupMatcher";

const zones = zonesJson as Zone[];
const groups = groupsJson as Group[];
const zone = (id: string) => zones.find((z) => z.id === id)!;
const group = (id: string) => groups.find((g) => g.group_id === id)!;

function monthOf(zoneId: string, groupId: string, taskId: string, includeOptional = true): number | null {
  const cal = generateCalendar(zone(zoneId), [group(groupId)], { includeOptional });
  for (const m of cal.months) if (m.tasks.some((t) => t.id === taskId)) return m.month;
  return null;
}

describe("data files", () => {
  it("has the expected shape", () => {
    expect(zones).toHaveLength(16);
    expect(groups).toHaveLength(5);
    expect(groups.reduce((n, g) => n + g.tasks.length, 0)).toBe(34);
  });
});

describe("calendar engine", () => {
  it("5b: tropicals go out in June and come indoors in September (not August)", () => {
    expect(monthOf("5b", "tropical", "t_out")).toBe(6);
    expect(monthOf("5b", "tropical", "t_in")).toBe(9);
  });
  it("5b: hardy deciduous repot early April, winter storage in November", () => {
    expect(monthOf("5b", "hardy_deciduous", "hd_repot")).toBe(4);
    expect(monthOf("5b", "hardy_deciduous", "hd_winter")).toBe(11);
  });
  it("colder zone shifts spring work later", () => {
    expect(monthOf("3a", "hardy_deciduous", "hd_repot")).toBe(5);
  });
  it("colder zone shifts autumn work earlier", () => {
    const cold = resolveTaskDay(group("pine_two_flush").tasks.find((t) => t.id === "p2_needle")!, zone("3a"))!;
    const base = resolveTaskDay(group("pine_two_flush").tasks.find((t) => t.id === "p2_needle")!, zone("5b"))!;
    expect(cold).toBeLessThan(base);
  });
  it("frost-free zone 10b skips frost-based and winter tasks", () => {
    expect(monthOf("10b", "tropical", "t_out")).toBeNull();
    expect(monthOf("10b", "tropical", "t_in")).toBeNull();
    expect(monthOf("10b", "hardy_deciduous", "hd_winter")).toBeNull();
  });
  it("zone 3a skips candle cutting and defoliation", () => {
    expect(monthOf("3a", "pine_two_flush", "p2_candle")).toBeNull();
    expect(monthOf("3a", "hardy_deciduous", "hd_defoliate")).toBeNull();
  });
  it("optional tasks only show when asked for", () => {
    expect(monthOf("5b", "hardy_deciduous", "hd_defoliate", false)).toBeNull();
    expect(monthOf("5b", "hardy_deciduous", "hd_defoliate", true)).toBe(6);
  });
  it("shows the too-warm note for hardy deciduous in 9a", () => {
    const cal = generateCalendar(zone("9a"), [group("hardy_deciduous")]);
    expect(cal.zoneNotes[0].notes.join(" ")).toMatch(/too warm/i);
  });
  it("every task lands on a real month in every zone", () => {
    for (const z of zones) {
      const cal = generateCalendar(z, groups, { includeOptional: true });
      expect(cal.months).toHaveLength(12);
      for (const m of cal.months) for (const t of m.tasks) {
        expect(t.month).toBeGreaterThanOrEqual(1);
        expect(t.month).toBeLessThanOrEqual(12);
        expect(Number.isFinite(t.dayOfYear)).toBe(true);
      }
    }
  });
});

describe("species matching", () => {
  const id = (species: string | null, climate: string | null = null, foliage: string | null = null) =>
    matchTreeToGroup({ species, climate, foliage }, groups).group_id;
  it("matches the three sample trees", () => {
    expect(id("Acer palmatum")).toBe("hardy_deciduous");
    expect(id("Juniperus chinensis")).toBe("juniper");
    expect(id("Juniperus virginiana")).toBe("juniper");
  });
  it("matches other real entries and ignores capitals", () => {
    expect(id("Picea Glauca")).toBe("pine_one_flush");
    expect(id("Portulacaria afra")).toBe("tropical");
    expect(id("Pinus thunbergii")).toBe("pine_two_flush");
    expect(id("Japanese Black Pine (Kuromatsu)")).toBe("pine_two_flush");
    expect(id("Pinus strobus")).toBe("pine_one_flush");
    expect(id("Pinus resinosa")).toBe("pine_one_flush");
    expect(id("Pinus densiflora")).toBe("pine_two_flush");
  });
  it("falls back to climate and foliage, but never guesses conifers", () => {
    expect(id(null, "Tropical & Subtropical", "Broadleaf Evergreen")).toBe("tropical");
    expect(id("", "Hardy / Outdoor", "Deciduous")).toBe("hardy_deciduous");
    expect(id(null, "Temperate", "Evergreen")).toBeNull();
    expect(id(null, "Hardy / Outdoor", "Conifer")).toBeNull();
    expect(id(null, "Hybrid/Other", "Succulent / Desert")).toBeNull();
    expect(id(null, null, null)).toBeNull();
  });
});
