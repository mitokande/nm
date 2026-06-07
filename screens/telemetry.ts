// Observability façade — one wrapper over Sentry (errors) + PostHog (product
// analytics). Every call is guarded so the app never crashes because telemetry
// is misconfigured or offline. Keys live in app.json `extra` (PostHog API key and
// Sentry DSN are public client-side keys, safe to ship).
//
// Event names are snake_case and STABLE — renaming one silently breaks any
// dashboard/funnel built on it. Add new names to AnalyticsEvent; don't rename.

import Constants from "expo-constants";
import * as Sentry from "@sentry/react-native";
import PostHog from "posthog-react-native";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  sentryDsn?: string;
  posthogApiKey?: string;
  posthogHost?: string;
};

const ENVIRONMENT = __DEV__ ? "development" : "production";

export type AnalyticsEvent =
  | "app_open"
  | "session_start"
  | "screen_view"
  | "run_started"
  | "run_ended"
  | "stage_complete"
  | "tutorial_step"
  | "tutorial_complete"
  | "ad_requested"
  | "ad_loaded"
  | "ad_shown"
  | "ad_closed"
  | "ad_reward_earned"
  | "ad_impression"
  | "ad_failed"
  | "daily_login_claimed"
  | "daily_challenge_complete"
  | "garden_invested"
  | "booster_purchased"
  | "booster_used"
  | "hint_used"
  | "lives_depleted"
  | "mailbox_claimed"
  | "settings_toggled"
  | "notification_opened";

type Props = Record<string, any>;

let posthog: PostHog | null = null;
let started = false;

/**
 * Initialize Sentry + PostHog. Safe to call more than once (no-ops after the
 * first). Call as early as possible — App.tsx invokes this at module load.
 */
export function initTelemetry(): void {
  if (started) return;
  started = true;

  if (extra.sentryDsn) {
    try {
      Sentry.init({
        dsn: extra.sentryDsn,
        environment: ENVIRONMENT,
        // Flip to `enabled: !__DEV__` once you've confirmed events arrive — for
        // now dev errors are tagged `development` so they're easy to filter out.
        enabled: true,
        sendDefaultPii: false, // GDPR: no IP/PII attached automatically
        tracesSampleRate: __DEV__ ? 1.0 : 0.2,
      });
    } catch {
      // Sentry unavailable (e.g. Expo Go without native module) — keep going.
    }
  }

  if (extra.posthogApiKey) {
    try {
      posthog = new PostHog(extra.posthogApiKey, {
        host: extra.posthogHost ?? "https://eu.i.posthog.com",
        // Free lifecycle events: Application Opened / Backgrounded / Installed.
        captureAppLifecycleEvents: true,
      });
    } catch {
      posthog = null;
    }
  }
}

/** Fire a product-analytics event and drop a Sentry breadcrumb for crash context. */
export function track(event: AnalyticsEvent, props?: Props): void {
  try {
    posthog?.capture(event, { ...props, environment: ENVIRONMENT });
  } catch {}
  try {
    Sentry.addBreadcrumb({ category: "event", message: event, data: props, level: "info" });
  } catch {}
}

/** Convenience screen-view event. `name` is the screen key, e.g. "menu" | "game". */
export function screenView(name: string, props?: Props): void {
  try {
    posthog?.screen(name, props);
  } catch {}
  track("screen_view", { screen: name, ...props });
}

/** Bind the anonymous install id to both Sentry and PostHog so cohorts line up. */
export function identify(distinctId: string, props?: Props): void {
  try {
    posthog?.identify(distinctId, props);
  } catch {}
  try {
    Sentry.setUser({ id: distinctId });
  } catch {}
}

/** Report a handled error to Sentry with optional context. */
export function captureError(error: unknown, context?: Props): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {}
}

/** Low-level breadcrumb for state transitions worth seeing in a crash trail. */
export function breadcrumb(message: string, data?: Props): void {
  try {
    Sentry.addBreadcrumb({ message, data, level: "info" });
  } catch {}
}

/**
 * A `.catch` handler for AsyncStorage writes — replaces bare `.catch(() => {})`
 * so silent persistence failures become visible. Usage:
 *   AsyncStorage.setItem(k, v).catch(onStorageError("crowns"));
 */
export const onStorageError = (key: string) => (error: unknown): void => {
  captureError(error, { kind: "asyncstorage_write", key });
};

/** Flush queued PostHog events — call when the app goes to background. */
export function flushTelemetry(): void {
  try {
    posthog?.flush();
  } catch {}
}

/**
 * Consent toggle for Phase 2 (ATT / UMP). Until wired, analytics defaults to on.
 * Call with `false` to stop sending until the user consents.
 */
export function setAnalyticsConsent(enabled: boolean): void {
  try {
    if (enabled) posthog?.optIn();
    else posthog?.optOut();
  } catch {}
}

/** Re-export Sentry's HOC so App can wrap its root component for native crash capture. */
export const withSentry = Sentry.wrap;
