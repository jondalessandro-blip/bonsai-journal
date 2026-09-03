export interface CoverPosition {
  x: number;
  y: number;
  zoom: number;
}

export const DEFAULT_COVER_POSITION: CoverPosition = {
  x: 50,
  y: 50,
  zoom: 1,
};

export function coverPositionStorageKey(treeId: string) {
  return `bonsai-cover-${treeId}`;
}