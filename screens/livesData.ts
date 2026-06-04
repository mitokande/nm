// Lives / energy system. Hybrid-casual standard: capped meter, time-based regen,
// blocks new runs at zero so the player has a reason to come back later.

export const MAX_LIVES = 5;
export const REGEN_MS = 15 * 60 * 1000;

export interface LivesState {
  count: number;
  lastRegenTs: number;
}

export const defaultLivesState = (): LivesState => ({
  count: MAX_LIVES,
  lastRegenTs: Date.now(),
});

export function normalizeLivesState(raw: any): LivesState {
  const s = defaultLivesState();
  if (!raw || typeof raw !== "object") return s;
  if (typeof raw.count === "number") s.count = clampLives(raw.count);
  if (typeof raw.lastRegenTs === "number") s.lastRegenTs = raw.lastRegenTs;
  return s;
}

function clampLives(n: number) {
  return Math.max(0, Math.min(MAX_LIVES, Math.floor(n)));
}

// Apply wall-clock regen and roll the timestamp forward by the consumed quanta.
// Pure — call from a tick or on focus. If already full, the timestamp is reset.
export function tickRegen(state: LivesState, now = Date.now()): LivesState {
  if (state.count >= MAX_LIVES) return { count: MAX_LIVES, lastRegenTs: now };
  const elapsed = now - state.lastRegenTs;
  if (elapsed < REGEN_MS) return state;
  const earned = Math.floor(elapsed / REGEN_MS);
  const nextCount = clampLives(state.count + earned);
  const consumed = nextCount - state.count;
  const nextTs = nextCount >= MAX_LIVES ? now : state.lastRegenTs + consumed * REGEN_MS;
  return { count: nextCount, lastRegenTs: nextTs };
}

// Time until the next heart refills, in ms. 0 if already full.
export function msUntilNextLife(state: LivesState, now = Date.now()): number {
  if (state.count >= MAX_LIVES) return 0;
  const remaining = REGEN_MS - (now - state.lastRegenTs);
  return Math.max(0, remaining);
}

export function spendLife(state: LivesState, now = Date.now()): LivesState {
  if (state.count <= 0) return state;
  // If we were at max, start the regen clock now that we've dropped below.
  const lastRegenTs = state.count === MAX_LIVES ? now : state.lastRegenTs;
  return { count: state.count - 1, lastRegenTs };
}

export function grantLives(state: LivesState, n: number, now = Date.now()): LivesState {
  const nextCount = clampLives(state.count + n);
  if (nextCount === state.count) return state;
  const lastRegenTs = nextCount >= MAX_LIVES ? now : state.lastRegenTs;
  return { count: nextCount, lastRegenTs };
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
