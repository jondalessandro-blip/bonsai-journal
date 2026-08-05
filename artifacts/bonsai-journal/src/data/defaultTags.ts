export const DEFAULT_TAGS = [
  "acid lover",
  "heavy feeder",
  "shade tolerant",
  "wind sensitive",
  "frost tender",
  "fast grower",
] as const;

export type DefaultTag = typeof DEFAULT_TAGS[number];
