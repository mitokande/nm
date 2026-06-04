// Local notifications for re-engagement. The native module is lazy-required so
// the app keeps working in Expo Go (or if expo-notifications hasn't been added
// yet). When the module is missing every call below is a silent no-op.

import { Platform } from "react-native";
import { MAX_LIVES, REGEN_MS, LivesState } from "./livesData";

// Identifiers — kept stable so we can cancel-and-reschedule without dupes.
const LIVES_FULL_ID = "lives-full";
const DAILY_CHALLENGE_ID = "daily-challenge";
const DAILY_LOGIN_ID = "daily-login";

let cachedModule: any = undefined; // undefined = unattempted, null = failed
function getModule(): any | null {
  if (cachedModule !== undefined) return cachedModule;
  try {
    const m = require("expo-notifications");
    if (!m || typeof m.scheduleNotificationAsync !== "function") {
      cachedModule = null;
      return null;
    }
    // Foreground-presentation handler so notifications aren't silently swallowed
    // when the app is open. Safe to call repeatedly.
    try {
      m.setNotificationHandler?.({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    } catch {}
    cachedModule = m;
    return m;
  } catch {
    cachedModule = null;
    return null;
  }
}

export async function requestPermission(): Promise<boolean> {
  const m = getModule();
  if (!m) return false;
  try {
    const existing = await m.getPermissionsAsync();
    if (existing.granted) return true;
    if (existing.status === "denied" && !existing.canAskAgain) return false;
    const next = await m.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    return !!next.granted;
  } catch {
    return false;
  }
}

export async function hasPermission(): Promise<boolean> {
  const m = getModule();
  if (!m) return false;
  try {
    const p = await m.getPermissionsAsync();
    return !!p.granted;
  } catch {
    return false;
  }
}

async function cancel(id: string) {
  const m = getModule();
  if (!m) return;
  try { await m.cancelScheduledNotificationAsync(id); } catch {}
}

async function schedule(id: string, body: { title: string; body: string }, atMs: number) {
  const m = getModule();
  if (!m) return;
  const delaySeconds = Math.max(1, Math.ceil((atMs - Date.now()) / 1000));
  try {
    await m.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: body.title,
        body: body.body,
        sound: Platform.OS === "ios" ? "default" : undefined,
      },
      trigger: { seconds: delaySeconds, repeats: false },
    });
  } catch {}
}

// Schedule "hearts full" for the moment the meter would actually refill. If
// already full or below permission, just clears any stale notification.
export async function scheduleLivesFull(lives: LivesState, enabled: boolean) {
  await cancel(LIVES_FULL_ID);
  if (!enabled) return;
  if (lives.count >= MAX_LIVES) return;
  const remaining = (MAX_LIVES - lives.count) * REGEN_MS - (Date.now() - lives.lastRegenTs);
  if (remaining <= 0) return;
  await schedule(
    LIVES_FULL_ID,
    {
      title: "Your hearts are full",
      body: "Come back and play — your garden is waiting.",
    },
    Date.now() + remaining,
  );
}

// Schedule the daily challenge nudge at the next 7pm local. If the challenge is
// already done today, target tomorrow's 7pm instead.
export async function scheduleDailyChallenge(completedToday: boolean, enabled: boolean) {
  await cancel(DAILY_CHALLENGE_ID);
  if (!enabled) return;
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0, 0);
  if (completedToday || target.getTime() <= Date.now()) {
    target.setDate(target.getDate() + 1);
  }
  await schedule(
    DAILY_CHALLENGE_ID,
    {
      title: "Daily Challenge waiting",
      body: "Play one stage today to earn bonus crowns and a heart.",
    },
    target.getTime(),
  );
}

// Daily login reminder — fires at 9am local the next day, so the player has a
// fresh reward to collect when they wake up.
export async function scheduleDailyLogin(enabled: boolean) {
  await cancel(DAILY_LOGIN_ID);
  if (!enabled) return;
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0);
  await schedule(
    DAILY_LOGIN_ID,
    {
      title: "Your daily reward is ready",
      body: "Open Number Match to claim today's gift.",
    },
    target.getTime(),
  );
}

export async function cancelAll() {
  const m = getModule();
  if (!m) return;
  try { await m.cancelAllScheduledNotificationsAsync(); } catch {}
}
