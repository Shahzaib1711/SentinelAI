/** Labels from sanatladkat/floor-plan-object-detection (YOLOv8). */
export const FLOOR_PLAN_LABELS = [
  "Column",
  "Curtain Wall",
  "Dimension",
  "Door",
  "Railing",
  "Sliding Door",
  "Stair Case",
  "Wall",
  "Window",
] as const;

export type FloorPlanLabel = (typeof FLOOR_PLAN_LABELS)[number];

export const DEFAULT_FLOOR_PLAN_LABELS: FloorPlanLabel[] = [...FLOOR_PLAN_LABELS];

export interface LayoutOverlayToggles {
  walls: boolean;
  doors: boolean;
  windows: boolean;
  columns: boolean;
  railings: boolean;
  dimensions: boolean;
}
