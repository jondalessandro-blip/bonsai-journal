import speciesReferenceData from "../data/speciesReference.json";

export type SpeciesReferenceEntry = {
  commonName: string;
  aliases: string[];
  scientificName: string;
  group_id?: string;
};

export type SpeciesTreeInput = {
  name?: string | null;
  species?: string | null;
};

const speciesReference = speciesReferenceData as SpeciesReferenceEntry[];
const DEFAULT_SUGGESTION_LIMIT = 8;

function matchesAtWordStart(phrase: string, normalizedQuery: string): boolean {
  const lowerPhrase = phrase.toLowerCase();
  let index = lowerPhrase.indexOf(normalizedQuery);

  while (index !== -1) {
    if (index === 0 || !/[\p{L}\p{N}\p{M}]/u.test(lowerPhrase[index - 1])) {
      return true;
    }
    index = lowerPhrase.indexOf(normalizedQuery, index + 1);
  }

  return false;
}

function phrasesFor(entry: SpeciesReferenceEntry): string[] {
  return [entry.commonName, ...entry.aliases, entry.scientificName];
}

/** Filter the reference list for Species-field autocomplete suggestions. */
export function getSpeciesSuggestions(
  query: string,
  limit = DEFAULT_SUGGESTION_LIMIT,
): SpeciesReferenceEntry[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery || limit <= 0) return [];

  return speciesReference
    .filter((entry) =>
      phrasesFor(entry).some((phrase) => matchesAtWordStart(phrase, normalizedQuery)),
    )
    .slice(0, limit);
}

/**
 * Match each tree's name and species before grouping the results by species.
 */
export function getSpeciesSuggestionsFromTrees(
  trees: SpeciesTreeInput[],
  query: string,
  limit = DEFAULT_SUGGESTION_LIMIT,
): SpeciesReferenceEntry[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery || limit <= 0) return [];

  const speciesCounts = new Map<string, number>();

  for (const tree of trees) {
    const normalizedSpecies = tree.species?.trim().toLowerCase();
    if (!normalizedSpecies) continue;

    speciesCounts.set(
      normalizedSpecies,
      (speciesCounts.get(normalizedSpecies) ?? 0) + 1,
    );
  }

  const matches = new Map<string, SpeciesReferenceEntry>();

  for (const tree of trees) {
    const species = tree.species;
    const normalizedSpecies = species?.trim().toLowerCase();
    if (!species || !normalizedSpecies || matches.has(normalizedSpecies)) continue;
    const treeMatchesQuery = [tree.name, species].some(
      (value) => value && matchesAtWordStart(value, normalizedQuery),
    );
    if (!treeMatchesQuery) continue;

    matches.set(normalizedSpecies, {
      commonName:
        (speciesCounts.get(normalizedSpecies) ?? 0) > 1
          ? species
          : tree.name?.trim()
            ? tree.name
            : species,
      aliases: [],
      scientificName: species,
    });
  }

  return [...matches.values()].slice(0, limit);
}