// Persistent booster inventory. Boosters are consumed at the start of a real
// run — they're added on top of the per-stage base allowance in GameScreen and
// then zeroed in App.tsx so they don't double-apply.

export interface Boosters {
  hint: number;
  addrow: number;
}

export const defaultBoosters = (): Boosters => ({ hint: 0, addrow: 0 });

export function normalizeBoosters(raw: any): Boosters {
  const b = defaultBoosters();
  if (!raw || typeof raw !== "object") return b;
  if (typeof raw.hint === "number" && raw.hint >= 0) b.hint = Math.floor(raw.hint);
  if (typeof raw.addrow === "number" && raw.addrow >= 0) b.addrow = Math.floor(raw.addrow);
  return b;
}

export const BOOSTER_COST = {
  hint: 20,
  addrow: 30,
} as const;

export const MAX_BOOSTERS = 9; // keeps the pill from overflowing into "10+"

/** A booster reward attached to mailbox / daily-login rewards. */
export interface BoosterGift {
  hint?: number;
  addrow?: number;
}

/** Add gifted boosters to the inventory, clamped to MAX_BOOSTERS. Pure. */
export function grantBoosters(state: Boosters, gift?: BoosterGift): Boosters {
  if (!gift) return state;
  const hint = Math.min(MAX_BOOSTERS, state.hint + Math.max(0, Math.floor(gift.hint ?? 0)));
  const addrow = Math.min(MAX_BOOSTERS, state.addrow + Math.max(0, Math.floor(gift.addrow ?? 0)));
  if (hint === state.hint && addrow === state.addrow) return state;
  return { hint, addrow };
}
