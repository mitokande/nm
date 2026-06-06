// Ad consent + privacy orchestration. Two regulatory surfaces meet here:
//   1. Google UMP (User Messaging Platform) — GDPR/EEA + US-state consent, via
//      `AdsConsent` from react-native-google-mobile-ads.
//   2. iOS App Tracking Transparency (ATT) — the system "Allow tracking?" prompt.
//
// Both native modules are lazily required and guarded so Expo Go / web never
// crash (same pattern as the AdMob init in GameScreen). Consent must be gathered
// BEFORE `mobileAds().initialize()` and before the first ad request, so the SDK
// has the consent signal when it picks personalized vs. non-personalized fill.

import { Platform } from "react-native";
import Constants from "expo-constants";
import { captureError } from "./telemetry";

export interface AdConsentResult {
  /** Whether the Mobile Ads SDK is allowed to request ads at all. */
  canRequestAds: boolean;
  /** Pass into `createForAdRequest` — true forces non-personalized ads. */
  nonPersonalizedOnly: boolean;
}

// Cached for the session — UMP/ATT only need to run once per launch. Cleared by
// manageAdConsent() so a consent change re-evaluates on the next ad init.
let resolved: AdConsentResult | null = null;

function loadAdmob(): any | null {
  if (Constants.appOwnership === "expo") return null;
  try {
    const admob = require("react-native-google-mobile-ads");
    if (!admob || typeof admob.default !== "function") return null;
    return admob;
  } catch {
    return null;
  }
}

/**
 * Request iOS ATT permission once. Returns true when tracking is allowed
 * (granted), or when the prompt doesn't apply (non-iOS / module unavailable).
 */
async function requestAtt(): Promise<boolean> {
  if (Platform.OS !== "ios") return true;
  try {
    const att = require("expo-tracking-transparency");
    const current = await att.getTrackingPermissionsAsync();
    let status: string = current.status;
    if (status === "undetermined" && current.canAskAgain) {
      status = (await att.requestTrackingPermissionsAsync()).status;
    }
    return status === "granted";
  } catch {
    // Module not in this binary (e.g. Expo Go) — don't block ad serving.
    return true;
  }
}

/**
 * Gather UMP consent + iOS ATT, once per session, before AdMob init. The
 * GMA SDK reads the stored TCF consent string automatically to decide
 * personalization, so we don't second-guess it here — we only force
 * non-personalized ads when iOS tracking is explicitly denied. On any failure
 * the safe default is: still serve ads, but non-personalized.
 */
export async function ensureAdConsent(): Promise<AdConsentResult> {
  if (resolved) return resolved;

  const admob = loadAdmob();
  if (!admob) {
    resolved = { canRequestAds: true, nonPersonalizedOnly: true };
    return resolved;
  }

  let canRequestAds = true;
  let nonPersonalizedOnly = false;

  try {
    // ATT first — its result feeds the personalization signal on iOS.
    const trackingAllowed = await requestAtt();
    if (!trackingAllowed) nonPersonalizedOnly = true;

    // gatherConsent = requestInfoUpdate + loadAndShowConsentFormIfRequired.
    // debugGeography forces the EEA form on test devices during development.
    const info = await admob.AdsConsent.gatherConsent(
      __DEV__
        ? {
            debugGeography: admob.AdsConsentDebugGeography.EEA,
            testDeviceIdentifiers: ["EMULATOR"],
          }
        : undefined,
    );
    canRequestAds = info?.canRequestAds !== false;
  } catch (e) {
    captureError(e, { kind: "ad_consent" });
    nonPersonalizedOnly = true; // privacy-safe fallback
  }

  resolved = { canRequestAds, nonPersonalizedOnly };
  return resolved;
}

/**
 * Open the ongoing privacy-options form so users (required for EEA/UK/CH and
 * regulated US states) can change their ad-consent choices later. Wired to the
 * "Ad privacy settings" row in Settings. Returns true if a form was presented.
 */
export async function manageAdConsent(): Promise<boolean> {
  const admob = loadAdmob();
  if (!admob) return false;
  try {
    const info = await admob.AdsConsent.getConsentInfo();
    resolved = null; // re-evaluate personalization on the next ad init
    if (info?.privacyOptionsRequirementStatus === "REQUIRED") {
      await admob.AdsConsent.showPrivacyOptionsForm();
      return true;
    }
    // No ongoing privacy options in this region — reset so the consent form
    // can be re-shown on the next launch.
    admob.AdsConsent.reset();
    return false;
  } catch (e) {
    captureError(e, { kind: "ad_consent_manage" });
    return false;
  }
}
