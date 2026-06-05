// Stable, anonymous, PII-free install identifier for analytics/crash cohorts.
// A generated UUID persisted to AsyncStorage is more reliable than vendor IDs
// (which can be null, reset on reinstall, or require extra entitlements) and is
// App Store / Play Store compliant since it contains no device or user data.

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "install_id";

function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Get the persisted install id, creating one on first launch. */
export async function getInstallId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(KEY);
    if (existing) return existing;
    const id = uuidv4();
    await AsyncStorage.setItem(KEY, id);
    return id;
  } catch {
    // Storage unavailable — return an ephemeral id so the session still groups.
    return uuidv4();
  }
}
