// Central ad orchestration. One module owns the rewarded + interstitial ad
// instances, the frequency-cap policy, and all ad telemetry — so the rules live
// in one place instead of being scattered through GameScreen.
//
// The native module is lazily required and the whole thing no-ops in Expo Go /
// web. Consent (iOS ATT + Google UMP) is gathered via ensureAdConsent BEFORE the
// Mobile Ads SDK initializes. Frequency-cap state is module-scoped, so it
// survives screen unmounts and is reset only on a fresh app launch (= a session).

import { Platform } from "react-native";
import Constants from "expo-constants";
import { track, captureError } from "./telemetry";
import { ensureAdConsent } from "./consent";

// ── Ad unit IDs ───────────────────────────────────────────────────────────────
// Rewarded reuses the existing live units. Interstitial needs a NEW AdMob unit;
// until real IDs are supplied below, production interstitials are skipped. In
// __DEV__ we always use Google's test IDs so the full flow is testable in a
// dev/preview build without serving (or risking) live ads.
const REWARDED_PROD =
  Platform.OS === "android"
    ? "ca-app-pub-4604843322018757/9772661819"
    : "ca-app-pub-4604843322018757/2967656297";

// Live interstitial ad units (one per platform). __DEV__ uses Google test IDs.
const INTERSTITIAL_PROD =
  Platform.OS === "android"
    ? "ca-app-pub-4604843322018757/2149275908"
    : "ca-app-pub-4604843322018757/9882775788";

// ── Frequency caps (interstitials) ──────────────────────────────────────────
const MIN_INTERSTITIAL_GAP_MS = 60_000; // at least 60s between interstitials
const REWARDED_SUPPRESS_MS = 30_000;    // no interstitial within 30s of a rewarded show
const FREE_OPPORTUNITIES = 2;           // skip the first N interstitial opportunities each session
const RELOAD_BACKOFF_MS = 30_000;       // retry a failed ad load after this delay

type Admob = any;

let admob: Admob | null = null;
let initStarted = false;
let sdkInitialized = false; // setRequestConfiguration + initialize() done
let adsBuilt = false;       // rewarded + interstitial created (only when consent allows)
let nonPersonalized = false;

let rewarded: any = null;
let rewardedReady = false;
let rewardedShowing = false; // an ad is currently presented — gates re-entry
let rewardedUnsubs: Array<() => void> = [];
let currentRewardedPlacement = "";

let interstitial: any = null;
let interstitialReady = false;
let interstitialShowing = false;
let interstitialUnsubs: Array<() => void> = [];
let currentInterstitialPlacement = "";

// Frequency-cap bookkeeping.
let lastInterstitialAt = 0;
let lastRewardedAt = 0;
let interstitialOpportunities = 0;

function loadModule(): Admob | null {
  if (admob) return admob;
  if (Constants.appOwnership === "expo") return null;
  try {
    const m = require("react-native-google-mobile-ads");
    if (!m || typeof m.default !== "function") return null;
    admob = m;
    return m;
  } catch {
    return null;
  }
}

function rewardedUnitId(m: Admob): string {
  return __DEV__ ? m.TestIds.REWARDED : REWARDED_PROD;
}

function interstitialUnitId(m: Admob): string {
  return __DEV__ ? m.TestIds.INTERSTITIAL : INTERSTITIAL_PROD;
}

// ── Rewarded ───────────────────────────────────────────────────────────────

function buildRewarded(m: Admob) {
  rewardedUnsubs.forEach((u) => u());
  rewardedUnsubs = [];
  rewardedReady = false;

  const ad = m.RewardedAd.createForAdRequest(rewardedUnitId(m), {
    requestNonPersonalizedAdsOnly: nonPersonalized,
  });

  rewardedUnsubs.push(
    ad.addAdEventListener(m.RewardedAdEventType.LOADED, () => {
      rewardedReady = true;
    }),
  );
  rewardedUnsubs.push(
    ad.addAdEventListener(m.AdEventType.ERROR, (e: any) => {
      // Errors during a show() are handled by the per-show listener in
      // showRewarded(); only treat this as a LOAD failure when not showing.
      if (rewardedShowing) return;
      rewardedReady = false;
      track("ad_failed", { reason: "load_error", code: e?.code, message: e?.message, ad_format: "rewarded" });
      scheduleReload(() => buildRewarded(m), () => !rewardedShowing && !rewardedReady);
    }),
  );
  rewardedUnsubs.push(
    ad.addAdEventListener(m.AdEventType.PAID, (p: any) => {
      // Impression-level ad revenue — the core ad ARPDAU signal.
      track("ad_impression", {
        value: p?.value,
        currency: p?.currency,
        precision: p?.precision,
        ad_format: "rewarded",
        placement: currentRewardedPlacement,
      });
    }),
  );

  rewarded = ad;
  track("ad_requested", { placement: "preload", ad_format: "rewarded" });
  ad.load();
}

/** Whether a rewarded ad is loaded and ready to show right now. */
export function isRewardedReady(): boolean {
  return rewardedReady && !rewardedShowing;
}

/**
 * Show a rewarded ad for `placement`. Resolves `{ shown, earned }`:
 *  - shown=false  → nothing displayed (not ready / already showing / unavailable);
 *                   caller should inform the user; a fresh load is kicked off.
 *  - shown=true, earned=false → user closed before earning — stay silent.
 *  - earned=true  → grant the reward.
 */
export async function showRewarded(
  placement: string,
  ctx?: Record<string, any>,
): Promise<{ shown: boolean; earned: boolean }> {
  const m = loadModule();
  if (!m || !rewarded) return { shown: false, earned: false };
  if (rewardedShowing) return { shown: false, earned: false }; // in-flight guard (double-tap)
  if (!rewardedReady) {
    track("ad_requested", { placement: "retry", ad_format: "rewarded" });
    try { rewarded.load(); } catch {}
    return { shown: false, earned: false };
  }

  // Close the readiness gate synchronously so a second tap in the same tick can't
  // also pass the checks above and present the same ad twice.
  rewardedShowing = true;
  rewardedReady = false;
  currentRewardedPlacement = placement;
  track("ad_shown", { placement, ad_format: "rewarded", ...ctx });
  const ad = rewarded;

  return await new Promise((resolve) => {
    let earned = false;
    let settled = false;
    const subs: Array<() => void> = [];
    const cleanup = () => subs.forEach((u) => u());
    const finish = (shown: boolean) => {
      if (settled) return;
      settled = true;
      rewardedShowing = false;
      cleanup();
      buildRewarded(m); // preload the next rewarded
      resolve({ shown, earned });
    };

    subs.push(
      ad.addAdEventListener(m.RewardedAdEventType.EARNED_REWARD, (r: any) => {
        earned = true;
        track("ad_reward_earned", { placement, reward_type: r?.type, reward_amount: r?.amount });
      }),
    );
    subs.push(
      ad.addAdEventListener(m.AdEventType.CLOSED, () => {
        lastRewardedAt = Date.now();
        track("ad_closed", { placement, ad_format: "rewarded", earned });
        finish(true);
      }),
    );
    subs.push(
      ad.addAdEventListener(m.AdEventType.ERROR, (e: any) => {
        track("ad_failed", { reason: "show_error", code: e?.code, message: e?.message, placement });
        finish(false);
      }),
    );

    try {
      ad.show();
    } catch (e) {
      captureError(e, { kind: "ad_show", placement });
      finish(false);
    }
  });
}

// ── Interstitial ─────────────────────────────────────────────────────────────

function buildInterstitial(m: Admob) {
  const unit = interstitialUnitId(m);
  if (!unit) return; // no unit configured (prod) → interstitials disabled

  interstitialUnsubs.forEach((u) => u());
  interstitialUnsubs = [];
  interstitialReady = false;

  const ad = m.InterstitialAd.createForAdRequest(unit, {
    requestNonPersonalizedAdsOnly: nonPersonalized,
  });

  interstitialUnsubs.push(
    ad.addAdEventListener(m.AdEventType.LOADED, () => {
      interstitialReady = true;
    }),
  );
  interstitialUnsubs.push(
    ad.addAdEventListener(m.AdEventType.ERROR, (e: any) => {
      if (interstitialShowing) return; // show errors handled per-show
      interstitialReady = false;
      track("ad_failed", { reason: "load_error", code: e?.code, message: e?.message, ad_format: "interstitial" });
      scheduleReload(() => buildInterstitial(m), () => !interstitialShowing && !interstitialReady);
    }),
  );
  interstitialUnsubs.push(
    ad.addAdEventListener(m.AdEventType.PAID, (p: any) => {
      track("ad_impression", {
        value: p?.value,
        currency: p?.currency,
        precision: p?.precision,
        ad_format: "interstitial",
        placement: currentInterstitialPlacement,
      });
    }),
  );

  interstitial = ad;
  track("ad_requested", { placement: "preload", ad_format: "interstitial" });
  ad.load();
}

/**
 * Show an interstitial for `placement` IF the frequency caps allow it. Always
 * resolves (true if an ad was shown, false if skipped) so callers can `await`
 * it and then proceed regardless. Caps: skip the first N opportunities of the
 * session, ≥60s between interstitials, and never within 30s of a rewarded ad.
 */
export async function maybeShowInterstitial(
  placement: string,
  ctx?: Record<string, any>,
): Promise<boolean> {
  const m = loadModule();
  if (!m || !interstitial) return false;
  if (interstitialShowing) return false; // in-flight guard

  interstitialOpportunities += 1;
  const now = Date.now();
  if (interstitialOpportunities <= FREE_OPPORTUNITIES) return false;
  if (now - lastInterstitialAt < MIN_INTERSTITIAL_GAP_MS) return false;
  if (now - lastRewardedAt < REWARDED_SUPPRESS_MS) return false;
  if (!interstitialReady) return false;

  interstitialShowing = true;
  interstitialReady = false;
  currentInterstitialPlacement = placement;
  track("ad_shown", { placement, ad_format: "interstitial", ...ctx });
  const ad = interstitial;

  return await new Promise((resolve) => {
    let settled = false;
    const subs: Array<() => void> = [];
    const cleanup = () => subs.forEach((u) => u());
    const finish = (shown: boolean) => {
      if (settled) return;
      settled = true;
      interstitialShowing = false;
      lastInterstitialAt = Date.now();
      cleanup();
      buildInterstitial(m); // preload the next interstitial
      resolve(shown);
    };

    subs.push(
      ad.addAdEventListener(m.AdEventType.CLOSED, () => {
        track("ad_closed", { placement, ad_format: "interstitial" });
        finish(true);
      }),
    );
    subs.push(
      ad.addAdEventListener(m.AdEventType.ERROR, (e: any) => {
        track("ad_failed", { reason: "show_error", code: e?.code, message: e?.message, placement });
        finish(false);
      }),
    );

    try {
      ad.show();
    } catch (e) {
      captureError(e, { kind: "ad_show", placement });
      finish(false);
    }
  });
}

// Schedule a one-shot reload after a fixed backoff, re-checking the guard at fire
// time so we don't rebuild an ad that has since loaded or is being shown.
function scheduleReload(rebuild: () => void, stillNeeded: () => boolean) {
  setTimeout(() => {
    if (stillNeeded()) rebuild();
  }, RELOAD_BACKOFF_MS);
}

// ── Init ──────────────────────────────────────────────────────────────────────

/**
 * Gather consent, initialize the Mobile Ads SDK, and preload the first rewarded
 * + interstitial. Idempotent and safe to call on every real-run mount; the work
 * runs once per session. Call from a "warm" moment (first real game), not at
 * cold launch, so the ATT/UMP prompts land after the user has engaged.
 *
 * If consent is withheld (canRequestAds=false) the SDK is still initialized but
 * no ads are built; `adsBuilt` stays false so a later call (e.g. after the user
 * changes consent in Settings) retries the consent + build path.
 */
export async function ensureInitialized(): Promise<void> {
  if (adsBuilt || initStarted) return;
  initStarted = true;

  const m = loadModule();
  if (!m) { initStarted = false; return; }

  try {
    const consent = await ensureAdConsent();
    nonPersonalized = consent.nonPersonalizedOnly;

    if (!sdkInitialized) {
      await m
        .default()
        .setRequestConfiguration({
          maxAdContentRating: m.MaxAdContentRating.G,
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
          testDeviceIdentifiers: ["EMULATOR"],
        })
        .catch((e: any) => console.log("[ads] setRequestConfiguration failed", e));
      await m.default().initialize();
      sdkInitialized = true;
    }

    if (consent.canRequestAds) {
      buildRewarded(m);
      buildInterstitial(m);
      adsBuilt = true;
    }
  } catch (e) {
    captureError(e, { kind: "admob_init" });
  } finally {
    initStarted = false; // allow a retry on a later entry if ads weren't built
  }
}
