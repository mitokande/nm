// Daily challenge bookkeeping. The "challenge" is: play any stage today.
// Completion is detected by the first crown earned of the day (App.tsx hooks
// onCrownsEarned). The bonus is delivered through the mailbox so the player
// gets a clear acknowledgement on their next menu visit.

export const DAILY_BONUS_CROWNS = 30;
export const DAILY_BONUS_LIVES = 1;

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
