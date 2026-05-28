// ─── Garden meta system ─────────────────────────────────────────────────────
// A persistent "grow a garden" meta layer. Crowns (earned 1-per-level) are the
// currency. Players plant seeds into plots, water them through growth stages
// (seed -> sprout -> bloom), and new plant types unlock as total blooms grow.

export const PLOT_COUNT = 6;

export type GrowthStage = 0 | 1 | 2; // 0 = seed, 1 = sprout, 2 = bloom

export interface PlantType {
  id: string;
  name: string;
  /** Emoji per growth stage: [seed, sprout, bloom]. */
  stages: [string, string, string];
  /** Crowns to plant a seed. */
  cost: number;
  /** Crowns to advance one growth stage. */
  waterCost: number;
  /** Total blooms required before this plant is available in the shop. */
  unlockAtBlooms: number;
}

export const PLANTS: PlantType[] = [
  { id: "daisy",     name: "Daisy",     stages: ["🌱", "🌿", "🌼"], cost: 2,  waterCost: 1, unlockAtBlooms: 0 },
  { id: "tulip",     name: "Tulip",     stages: ["🌱", "🌿", "🌷"], cost: 3,  waterCost: 1, unlockAtBlooms: 2 },
  { id: "sunflower", name: "Sunflower", stages: ["🌱", "🌿", "🌻"], cost: 4,  waterCost: 2, unlockAtBlooms: 4 },
  { id: "rose",      name: "Rose",      stages: ["🌱", "🌿", "🌹"], cost: 6,  waterCost: 2, unlockAtBlooms: 7 },
  { id: "lotus",     name: "Lotus",     stages: ["🌱", "🌿", "🪷"], cost: 8,  waterCost: 3, unlockAtBlooms: 11 },
  { id: "cherry",    name: "Cherry",    stages: ["🌱", "🌿", "🌸"], cost: 10, waterCost: 3, unlockAtBlooms: 16 },
];

export const PLANT_BY_ID: Record<string, PlantType> = PLANTS.reduce(
  (acc, p) => { acc[p.id] = p; return acc; },
  {} as Record<string, PlantType>
);

export interface Plot {
  plantId: string | null;
  stage: GrowthStage;
}

export interface GardenState {
  plots: Plot[];
  totalBlooms: number;
}

export function defaultGardenState(): GardenState {
  return {
    plots: Array.from({ length: PLOT_COUNT }, () => ({ plantId: null, stage: 0 as GrowthStage })),
    totalBlooms: 0,
  };
}

/** Tolerant loader: backfills missing fields so older/partial saves don't crash. */
export function normalizeGardenState(raw: any): GardenState {
  const base = defaultGardenState();
  if (!raw || typeof raw !== "object") return base;
  const plots: Plot[] = base.plots.map((fallback, i) => {
    const p = Array.isArray(raw.plots) ? raw.plots[i] : undefined;
    if (!p || typeof p !== "object") return fallback;
    const plantId = typeof p.plantId === "string" && PLANT_BY_ID[p.plantId] ? p.plantId : null;
    const stageNum = typeof p.stage === "number" ? p.stage : 0;
    const stage = (plantId ? Math.max(0, Math.min(2, stageNum)) : 0) as GrowthStage;
    return { plantId, stage };
  });
  const totalBlooms = typeof raw.totalBlooms === "number" && raw.totalBlooms >= 0 ? raw.totalBlooms : 0;
  return { plots, totalBlooms };
}

export function unlockedPlants(totalBlooms: number): PlantType[] {
  return PLANTS.filter((p) => totalBlooms >= p.unlockAtBlooms);
}

/** The next plant type still locked, if any (used to tease progression). */
export function nextLockedPlant(totalBlooms: number): PlantType | null {
  return PLANTS.find((p) => totalBlooms < p.unlockAtBlooms) ?? null;
}

export function isPlotEmpty(plot: Plot): boolean {
  return plot.plantId === null;
}

export function isBloomed(plot: Plot): boolean {
  return plot.plantId !== null && plot.stage >= 2;
}

/**
 * Plant a seed into an empty plot. Pure: returns the next state, or null if the
 * action is invalid (plot occupied, unknown plant). Cost handling is the
 * caller's responsibility.
 */
export function plantSeed(state: GardenState, plotIndex: number, plantId: string): GardenState | null {
  const plot = state.plots[plotIndex];
  if (!plot || !isPlotEmpty(plot) || !PLANT_BY_ID[plantId]) return null;
  const plots = state.plots.slice();
  plots[plotIndex] = { plantId, stage: 0 };
  return { ...state, plots };
}

/**
 * Water a plot, advancing it one growth stage. Pure: returns the next state, or
 * null if invalid (empty plot or already bloomed). Increments totalBlooms when
 * a plant reaches bloom.
 */
export function waterPlot(state: GardenState, plotIndex: number): GardenState | null {
  const plot = state.plots[plotIndex];
  if (!plot || isPlotEmpty(plot) || plot.stage >= 2) return null;
  const nextStage = (plot.stage + 1) as GrowthStage;
  const plots = state.plots.slice();
  plots[plotIndex] = { plantId: plot.plantId, stage: nextStage };
  const justBloomed = nextStage >= 2;
  return {
    ...state,
    plots,
    totalBlooms: state.totalBlooms + (justBloomed ? 1 : 0),
  };
}

/** Clear a bloomed plot back to soil so it can be replanted. */
export function clearPlot(state: GardenState, plotIndex: number): GardenState | null {
  const plot = state.plots[plotIndex];
  if (!plot || isPlotEmpty(plot)) return null;
  const plots = state.plots.slice();
  plots[plotIndex] = { plantId: null, stage: 0 };
  return { ...state, plots };
}
