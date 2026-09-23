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

function normalize(value: string): string {
  return ` ${value.toLowerCase().replace(/[^a-z]+/g, " ").trim()} `;
}

function phrasesFor(entry: SpeciesReferenceEntry): string[] {
  return [entry.commonName, ...entry.aliases, entry.scientificName];
}

function longestMatchingPhrase(text: string, entry: SpeciesReferenceEntry): number {
  const normalizedText = normalize(text);
  let longest = 0;

  for (const phrase of phrasesFor(entry)) {
    const normalizedPhrase = normalize(phrase).trim();
    if (normalizedPhrase && normalizedText.includes(` ${normalizedPhrase} `)) {
      longest = Math.max(longest, normalizedPhrase.length);
    }
  }

  return longest;
}

function findBestMatch(text: string): SpeciesReferenceEntry | undefined {
  let best: { entry: SpeciesReferenceEntry; phraseLength: number } | undefined;

  for (const entry of speciesReference) {
    const phraseLength = longestMatchingPhrase(text, entry);
    if (phraseLength > 0 && (!best || phraseLength > best.phraseLength)) {
      best = { entry, phraseLength };
    }
  }

  return best?.entry;
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
      phrasesFor(entry).some((phrase) => phrase.toLowerCase().includes(normalizedQuery)),
    )
    .slice(0, limit);
}

/**
 * Find unique reference entries mentioned in existing trees' name or species text.
 * Results are suitable for autocomplete lists and name-blur matching.
 */
export function getSpeciesSuggestionsFromTrees(
  trees: SpeciesTreeInput[],
  limit = DEFAULT_SUGGESTION_LIMIT,
): SpeciesReferenceEntry[] {
  if (limit <= 0) return [];

  const matches = new Map<string, SpeciesReferenceEntry>();

  for (const tree of trees) {
    let curatedMatch: SpeciesReferenceEntry | undefined;

    for (const text of [tree.species, tree.name]) {
      if (!text) continue;
      const match = findBestMatch(text);
      if (match) {
        curatedMatch = match;
        matches.set(match.scientificName, match);
      }
    }

    if (!curatedMatch && tree.species?.trim()) {
      const fallback: SpeciesReferenceEntry = {
        commonName: tree.name ?? "",
        aliases: [],
        scientificName: tree.species,
      };
      matches.set(fallback.scientificName, fallback);
    }
  }

  return [...matches.values()].slice(0, limit);
}