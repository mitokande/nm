// ─── Garden meta system ─────────────────────────────────────────────────────
// A persistent "restore the garden" meta layer. Crowns (earned 1-per-level) are
// invested to restore overgrown garden areas one at a time. Each restored area
// advances the illustrated scene to its next, more beautiful stage.

export interface GardenArea {
  id: string;
  name: string;
  /** Crowns required to fully restore this area. */
  cost: number;
  /** Emoji used as the area's icon in the progress card. */
  icon: string;
}

// Order matters: areas are restored top-to-bottom. The number of areas equals
// the number of "restoration steps"; there is one scene image per step plus the
// initial barren scene (so total scene images = GARDEN_AREAS.length + 1).
export const GARDEN_AREAS: GardenArea[] = [
  { id: "roses",  name: "Rose Garden", cost: 5,  icon: "🌹" },
  { id: "beds",   name: "Flower Beds", cost: 8,  icon: "🌸" },
  { id: "pond",   name: "Lily Pond",   cost: 12, icon: "🪷" },
];

export const TOTAL_AREAS = GARDEN_AREAS.length;

export interface GardenState {
  /** Number of areas fully restored (0..TOTAL_AREAS). */
  restored: number;
  /** Crowns invested toward the current (not-yet-restored) area. */
  invested: number;
}

export function defaultGardenState(): GardenState {
  return { restored: 0, invested: 0 };
}

/** Tolerant loader so older/partial saves never crash. */
export function normalizeGardenState(raw: any): GardenState {
  if (!raw || typeof raw !== "object") return defaultGardenState();
  let restored = typeof raw.restored === "number" ? Math.floor(raw.restored) : 0;
  restored = Math.max(0, Math.min(TOTAL_AREAS, restored));
  let invested = typeof raw.invested === "number" ? Math.floor(raw.invested) : 0;
  if (invested < 0) invested = 0;
  const currentCost = GARDEN_AREAS[restored]?.cost ?? 0;
  if (restored >= TOTAL_AREAS) invested = 0;
  else if (invested >= currentCost) invested = Math.max(0, currentCost - 1);
  return { restored, invested };
}

export function isFullyRestored(state: GardenState): boolean {
  return state.restored >= TOTAL_AREAS;
}

/** The area currently being restored, or null when the garden is complete. */
export function currentArea(state: GardenState): GardenArea | null {
  return GARDEN_AREAS[state.restored] ?? null;
}

/** Which scene image to show (0 = barren, TOTAL_AREAS = fully restored). */
export function stageImageIndex(state: GardenState): number {
  return Math.min(state.restored, TOTAL_AREAS);
}

export interface InvestResult {
  next: GardenState;
  spent: number;
  justRestored: boolean;
}

/**
 * Invest up to `available` crowns into the current area. Pure. Spends only what
 * is needed to (at most) finish the current area; leftover crowns are left in
 * the player's balance. Returns the new state, crowns spent, and whether an
 * area was just fully restored.
 */
export function investCrowns(state: GardenState, available: number): InvestResult {
  const area = currentArea(state);
  if (!area || available <= 0) return { next: state, spent: 0, justRestored: false };
  const need = area.cost - state.invested;
  const spend = Math.min(need, Math.floor(available));
  if (spend <= 0) return { next: state, spent: 0, justRestored: false };
  const investedAfter = state.invested + spend;
  if (investedAfter >= area.cost) {
    return { next: { restored: state.restored + 1, invested: 0 }, spent: spend, justRestored: true };
  }
  return { next: { restored: state.restored, invested: investedAfter }, spent: spend, justRestored: false };
}
