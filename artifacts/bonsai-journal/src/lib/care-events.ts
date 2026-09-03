export const CARE_EVENT_TYPES = [
  "Watering",
  "Pruning",
  "Repotting",
  "Fertilizing",
  "Wiring",
  "Winter Prep",
  "Other",
] as const;

export type CareEventType = (typeof CARE_EVENT_TYPES)[number];