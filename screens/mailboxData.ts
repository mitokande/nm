// Mailbox: announcements + claimable rewards that survive across sessions.
// Seed messages on first launch so the empty state never appears for a new user.

import { BoosterGift } from "./boosters";

export interface MailMessage {
  id: string;
  title: string;
  body: string;
  ts: number;
  read: boolean;
  /** Claimable reward; absent or zeroed-out means announcement-only. */
  reward?: { crowns?: number; lives?: number; boosters?: BoosterGift };
  claimed: boolean;
}

export const WELCOME_MESSAGE: MailMessage = {
  id: "welcome",
  title: "Welcome, gardener",
  body: "A little something to start your garden — some crowns and a couple of boosters to learn the ropes. Tap claim below.",
  ts: 0,
  read: false,
  reward: { crowns: 10, boosters: { hint: 1, addrow: 1 } },
  claimed: false,
};

export function todaysSeed(now = Date.now()): MailMessage[] {
  return [{ ...WELCOME_MESSAGE, ts: now }];
}

export function normalizeMailbox(raw: any): MailMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && typeof m.id === "string")
    .map((m) => ({
      id: m.id,
      title: typeof m.title === "string" ? m.title : "",
      body: typeof m.body === "string" ? m.body : "",
      ts: typeof m.ts === "number" ? m.ts : 0,
      read: !!m.read,
      reward: m.reward && typeof m.reward === "object" ? {
        crowns: typeof m.reward.crowns === "number" ? m.reward.crowns : undefined,
        lives: typeof m.reward.lives === "number" ? m.reward.lives : undefined,
        boosters: m.reward.boosters && typeof m.reward.boosters === "object" ? {
          hint: typeof m.reward.boosters.hint === "number" ? m.reward.boosters.hint : undefined,
          addrow: typeof m.reward.boosters.addrow === "number" ? m.reward.boosters.addrow : undefined,
        } : undefined,
      } : undefined,
      claimed: !!m.claimed,
    }));
}

/** A message still has something to claim (non-zero, unclaimed reward). */
export function hasUnclaimedReward(m: MailMessage): boolean {
  const r = m.reward;
  if (!r || m.claimed) return false;
  return (r.crowns ?? 0) > 0 || (r.lives ?? 0) > 0
    || (r.boosters?.hint ?? 0) > 0 || (r.boosters?.addrow ?? 0) > 0;
}

// Badge count = messages that are either unread, or still have a reward to claim.
// (Marking read on open clears the "new" state; claimable rewards keep counting.)
export function unreadCount(messages: MailMessage[]): number {
  return messages.reduce((n, m) => n + (!m.read || hasUnclaimedReward(m) ? 1 : 0), 0);
}

const MAILBOX_MAX = 30;
const MAILBOX_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Trim the mailbox: drop messages that are fully done (claimed + read) and older
 * than 7 days, then cap to the newest 30. Pure. Messages are newest-first.
 */
export function pruneMailbox(messages: MailMessage[], now = Date.now()): MailMessage[] {
  return messages
    .filter((m) => !(m.claimed && m.read && now - m.ts > MAILBOX_TTL_MS))
    .slice(0, MAILBOX_MAX);
}

export function pushMessage(messages: MailMessage[], msg: Omit<MailMessage, "ts" | "read" | "claimed"> & Partial<Pick<MailMessage, "ts" | "read" | "claimed">>): MailMessage[] {
  const next: MailMessage = {
    ts: Date.now(),
    read: false,
    claimed: false,
    ...msg,
  };
  // Newest first so the badge always points at fresh content.
  return [next, ...messages.filter((m) => m.id !== msg.id)];
}
