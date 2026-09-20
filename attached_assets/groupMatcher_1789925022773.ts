import type { Group } from "./calendarEngine";

export type TreeInput = {
  species?: string | null;
  climate?: string | null;
  foliage?: string | null;
};

export type MatchResult = {
  group_id: string | null;
  source: "species" | "climate_foliage" | "none";
  reason?: "not_enough_info" | "succulent_unsupported" | "conifer_type_unknown";
};

function normalize(s: string): string {
  return " " + s.toLowerCase().replace(/[^a-z]+/g, " ").trim() + " ";
}

/** Longest whole-word keyword match wins, so "pinus thunbergii" beats plain "pinus". */
function matchSpecies(species: string, groups: Group[]): string | null {
  const text = normalize(species);
  let best: { len: number; id: string } | null = null;
  for (const g of groups) {
    for (const k of g.match.keywords) {
      if (text.includes(` ${k.toLowerCase()} `) && (!best || k.length > best.len)) {
        best = { len: k.length, id: g.group_id };
      }
    }
  }
  return best ? best.id : null;
}

/**
 * Species first (botanical or common name), then the tree's Climate and Foliage dropdowns as a
 * backup. Old rows may hold pre-rename values like "Temperate" or "Evergreen", so the backup is
 * deliberately cautious and never guesses between pines and junipers.
 */
export function matchTreeToGroup(tree: TreeInput, groups: Group[]): MatchResult {
  const species = (tree.species ?? "").trim();
  if (species) {
    const id = matchSpecies(species, groups);
    if (id) return { group_id: id, source: "species" };
  }

  const climate = (tree.climate ?? "").toLowerCase();
  const foliage = (tree.foliage ?? "").toLowerCase();

  if (foliage.includes("succulent")) {
    return { group_id: null, source: "none", reason: "succulent_unsupported" };
  }
  if (climate.includes("tropical")) {
    return { group_id: "tropical", source: "climate_foliage" };
  }
  if (foliage === "deciduous" || foliage === "deciduous conifer") {
    return { group_id: "hardy_deciduous", source: "climate_foliage" };
  }
  if (foliage === "conifer" || foliage === "evergreen" || foliage === "broadleaf evergreen") {
    return { group_id: null, source: "none", reason: "conifer_type_unknown" };
  }
  return { group_id: null, source: "none", reason: "not_enough_info" };
}
