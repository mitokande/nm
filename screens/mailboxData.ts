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

export function unreadCount(messages: MailMessage[]): number {
  return messages.reduce((n, m) => n + (m.read && m.claimed ? 0 : 1), 0);
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
