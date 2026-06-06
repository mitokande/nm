// 7-day login calendar. Streak advances on consecutive daily claims and resets
// on a missed day. After day 7 the cycle restarts at day 1 — the player has to
// keep coming back to receive the mega reward repeatedly.

import { todayKey } from "./dailyChallenge";
import { BoosterGift } from "./boosters";

export interface DailyReward {
  day: number;          // 1..7
  crowns?: number;
  lives?: number;
  boosters?: BoosterGift;
  mega?: boolean;       // styling hint
}

export const DAILY_REWARDS: DailyReward[] = [
  { day: 1, crowns: 10 },
  { day: 2, crowns: 20 },
  { day: 3, lives: 1 },
  { day: 4, crowns: 30 },
  { day: 5, lives: 2, boosters: { hint: 1 } },
  { day: 6, crowns: 40 },
  { day: 7, crowns: 100, lives: 5, boosters: { hint: 1, addrow: 1 }, mega: true },
];

export interface DailyLoginState {
  // 0 means "no streak yet — next claim is day 1". After a successful claim it
  // points at the most-recently-claimed day (1..7).
  streak: number;
  lastClaimDate: string; // YYYY-MM-DD, "" if never claimed
}

export const defaultDailyLogin = (): DailyLoginState => ({
  streak: 0,
  lastClaimDate: "",
});

export function normalizeDailyLogin(raw: any): DailyLoginState {
  const s = defaultDailyLogin();
  if (!raw || typeof raw !== "object") return s;
  if (typeof raw.streak === "number" && raw.streak >= 0 && raw.streak <= 7) s.streak = Math.floor(raw.streak);
  if (typeof raw.lastClaimDate === "string") s.lastClaimDate = raw.lastClaimDate;
  return s;
}

function yesterdayKey(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(y, m - 1, d - 1);
  const yy = dt.getFullYear();
  const mm = (dt.getMonth() + 1).toString().padStart(2, "0");
  const dd = dt.getDate().toString().padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// What day will the *next* claim be? Pure, used by the modal for highlighting.
export function nextClaimDay(state: DailyLoginState, now = Date.now()): number {
  const today = todayKey(now);
  if (state.lastClaimDate === today) return state.streak; // already claimed today
  if (state.lastClaimDate === yesterdayKey(today) && state.streak < 7) return state.streak + 1;
  // Either first ever claim, a missed day, or completed the 7-day cycle.
  return 1;
}

export function canClaimToday(state: DailyLoginState, now = Date.now()): boolean {
  return state.lastClaimDate !== todayKey(now);
}

export function claim(state: DailyLoginState, now = Date.now()): { next: DailyLoginState; reward: DailyReward | null } {
  if (!canClaimToday(state, now)) return { next: state, reward: null };
  const day = nextClaimDay(state, now);
  const reward = DAILY_REWARDS.find((r) => r.day === day) ?? null;
  return {
    next: { streak: day, lastClaimDate: todayKey(now) },
    reward,
  };
}
