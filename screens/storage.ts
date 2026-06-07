// Persistence schema version + migration anchor. A single key read on hydrate.
// Without this, any future change to a stored value's shape would be read by
// older parsing code and silently corrupt or drop player progress. Bumping
// SCHEMA_VERSION and adding a migration step lets us transform old saves instead.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { captureError } from "./telemetry";

export const SCHEMA_VERSION = 1;
const KEY = "schema_version";

// Ordered migrations. Each entry migrates FROM the version equal to its index
// (0 → 1 lives at index 0). v1 is the first versioned schema, so there are none
// yet — add `async () => { ... }` steps here as the shape evolves. Each step
// MUST be idempotent (it may re-run after a crash mid-migration).
const MIGRATIONS: Array<() => Promise<void>> = [];

/**
 * Read the stored schema version, run any pending migrations in order, then
 * stamp the new version after EACH successful step (so a crash mid-chain resumes
 * from the last good version instead of re-applying completed migrations). Call
 * once at the very start of hydrate, before any other persisted state is read,
 * so migrations see the old shape and the rest of the app reads the new one.
 * Never throws — a failure here must not block boot, but is reported to Sentry.
 */
export async function ensureSchemaVersion(): Promise<void> {
  let from: number;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    from = raw !== null ? parseInt(raw, 10) || 0 : 0;
  } catch (e) {
    captureError(e, { kind: "schema_version_read" });
    return;
  }
  if (from >= SCHEMA_VERSION) return;

  for (let v = from; v < SCHEMA_VERSION; v++) {
    try {
      const step = MIGRATIONS[v];
      if (step) await step();
      await AsyncStorage.setItem(KEY, String(v + 1));
    } catch (e) {
      // Leave the version stamped at the last successful step (or unstamped if
      // the very first failed) so the next boot resumes here. Surface to Sentry
      // instead of silently swallowing — a stuck migration would otherwise be
      // invisible.
      captureError(e, { kind: "schema_migration", from: v, to: v + 1 });
      return;
    }
  }
}
