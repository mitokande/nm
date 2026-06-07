// Daily challenge bookkeeping. The challenge ROTATES daily among a few goal
// types; progress is folded from each stage-clear (App.tsx hooks onStageCleared)
// and the bonus is delivered through the mailbox on completion so the player gets
// a clear acknowledgement on their next menu visit.

export const DAILY_BONUS_CROWNS = 30;
export const DAILY_BONUS_LIVES = 1;

export type ChallengeKind = "rows" | "score" | "speed";

export interface DailyChallengeDef {
  kind: ChallengeKind;
  target: number; // rows: total rows; score: points in one stage; speed: seconds
  label: string;  // full description for UI
  short: string;  // compact badge text
}

const CHALLENGES: DailyChallengeDef[] = [
  { kind: "rows",  target: 12,  label: "Clear 12 rows today",         short: "12 rows" },
  { kind: "score", target: 200, label: "Score 200 in a single stage", short: "Score 200" },
  { kind: "speed", target: 90,  label: "Clear a stage under 90s",     short: "Beat 90s" },
];

// Deterministic pick from the date string: stable through the day and across
// reloads, and rotates day to day.
export function todaysChallenge(dateKey: string = todayKey()): DailyChallengeDef {
  let h = 0;
  for (let i = 0; i < dateKey.length; i++) h = (h * 31 + dateKey.charCodeAt(i)) >>> 0;
  return CHALLENGES[h % CHALLENGES.length];
}

export interface DailyChallengeProgress {
  date: string;     // day this progress belongs to ("" = none yet)
  progress: number; // accumulated metric for the day's challenge
  done: boolean;
}

export function defaultChallengeProgress(): DailyChallengeProgress {
  return { date: "", progress: 0, done: false };
}

export function normalizeChallengeProgress(raw: any): DailyChallengeProgress {
  const s = defaultChallengeProgress();
  if (!raw || typeof raw !== "object") return s;
  if (typeof raw.date === "string") s.date = raw.date;
  if (typeof raw.progress === "number" && raw.progress >= 0) s.progress = Math.floor(raw.progress);
  s.done = !!raw.done;
  return s;
}

/** Per-stage-clear stats the game reports up to App. */
export interface StageStat { score: number; rows: number; ms: number; }

export interface ChallengeUpdate { next: DailyChallengeProgress; justCompleted: boolean; }

// The numeric goal for a challenge (speed is a boolean modelled as reach-1).
export function challengeTarget(def: DailyChallengeDef): number {
  return def.kind === "speed" ? 1 : def.target;
}

/**
 * Fold a stage-clear into today's challenge progress, resetting when the day
 * rolls over. Returns the new progress and whether THIS clear completed it.
 */
export function applyStageStat(
  prog: DailyChallengeProgress,
  stat: StageStat,
  now = Date.now(),
): ChallengeUpdate {
  const dateKey = todayKey(now);
  const def = todaysChallenge(dateKey);
  const base = prog.date === dateKey ? prog : { date: dateKey, progress: 0, done: false };
  if (base.done) return { next: base, justCompleted: false };

  let progress = base.progress;
  if (def.kind === "rows") progress = base.progress + Math.max(0, Math.floor(stat.rows));
  else if (def.kind === "score") progress = Math.max(base.progress, Math.floor(stat.score));
  else if (def.kind === "speed") progress = base.progress || (stat.ms > 0 && stat.ms <= def.target * 1000 ? 1 : 0);

  const done = progress >= challengeTarget(def);
  return { next: { date: dateKey, progress, done }, justCompleted: done };
}

export function todayKey(now = Date.now()): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function msUntilTomorrow(now = Date.now()): number {
  const d = new Date(now);
  const tomorrow = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return tomorrow.getTime() - now;
}

export function formatHMS(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
