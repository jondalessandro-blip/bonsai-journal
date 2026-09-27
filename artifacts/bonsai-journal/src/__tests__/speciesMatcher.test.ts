import { describe, expect, it } from "vitest";
import {
  getSpeciesSuggestions,
  getSpeciesSuggestionsFromTrees,
} from "../lib/speciesMatcher";

describe("species suggestions", () => {
  it("matches reference names only at the start of a word", () => {
    const falsePositives = getSpeciesSuggestions("ONE", 200).map(
      (entry) => entry.commonName,
    );
    expect(falsePositives).not.toContain("Cotoneaster");
    expect(falsePositives).not.toContain("Box Honeysuckle");
    expect(falsePositives).not.toContain("Bonsai Money Tree");
    expect(falsePositives).not.toContain("Bristlecone Pine");

    expect(getSpeciesSuggestions("pine", 200).map((entry) => entry.commonName))
      .toContain("Bristlecone Pine");
  });

  it("matches collection names at word starts, not inside words", () => {
    const trees = [
      { name: "Scotch Bonnet", species: "Capsicum annuum" },
      { name: "Bristlecone Pine", species: "Pinus longaeva" },
      { name: "Cotoneaster", species: "Cotoneaster horizontalis" },
      { name: "Box Honeysuckle", species: "Lonicera nitida" },
      { name: "Bonsai Money Tree", species: "Pachira aquatica" },
    ];

    expect(getSpeciesSuggestionsFromTrees(trees, "scotch")[0]?.commonName)
      .toBe("Scotch Bonnet");
    expect(getSpeciesSuggestionsFromTrees(trees, "pine")[0]?.commonName)
      .toBe("Bristlecone Pine");
    expect(getSpeciesSuggestionsFromTrees(trees, "one")).toEqual([]);
  });

  it("keeps accented letters inside words and matches them case-insensitively", () => {
    const trees = [{ name: "Épineux", species: "Acer campestre" }];

    expect(getSpeciesSuggestionsFromTrees(trees, "pine")).toEqual([]);
    expect(getSpeciesSuggestionsFromTrees(trees, "ÉPI")[0]?.commonName)
      .toBe("Épineux");
  });

  it("matches a tree's name before grouping shared species", () => {
    const trees = [
      { name: "Japanese maple", species: "Acer palmatum" },
      { name: "Cascade", species: "Acer palmatum" },
    ];

    const matches = getSpeciesSuggestionsFromTrees(trees, "japanese");
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      commonName: "Acer palmatum",
      scientificName: "Acer palmatum",
    });
  });

  it("keeps an individual tree's name for a unique species", () => {
    const trees = [{ name: "Desert Olive", species: "Olea europaea" }];

    expect(getSpeciesSuggestionsFromTrees(trees, "desert")[0]?.commonName)
      .toBe("Desert Olive");
    expect(getSpeciesSuggestionsFromTrees(trees, "europaea")[0]?.commonName)
      .toBe("Desert Olive");
  });
});