# Store privacy disclosures — Number Match

Reference for filling out **Google Play Data Safety** and the **Apple App Store privacy
("nutrition") labels**. Keep this in sync with `screens/telemetry.ts`, `screens/consent.ts`,
and the hosted policy at https://mithatck.com/numbermatch/privacy.html.

Publisher: **Mithat Can Turan** · Contact: **privacy@mithatck.com** · Jurisdiction: **Türkiye**
(KVKK) + GDPR for EU users.

SDKs that collect or process data:
- **PostHog** (product analytics, EU/Frankfurt) — anonymous events + device info.
- **Sentry** (crash reporting, EU/Germany) — crash diagnostics + device info.
- **Google AdMob** (`react-native-google-mobile-ads`) — advertising; uses the Android Advertising
  ID (`com.google.android.gms.permission.AD_ID`) and, on iOS, the IDFA gated behind ATT + UMP.

There are **no user accounts** — we never collect name, email, phone, or precise location.

---

## Google Play — Data Safety form

### Does your app collect or share user data? → **Yes**
### Is all data encrypted in transit? → **Yes** (HTTPS)
### Do you provide a way to request data deletion? → **Yes**
- In-app: **Settings → Delete all data** (wipes all on-device data).
- By email: privacy@mithatck.com.

### Data types to declare

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| **Device or other IDs** (advertising ID, anonymous install ID) | Yes | Yes (AdMob) | Advertising/marketing, Analytics | Required* |
| **App activity** (in-app actions, screens, gameplay events) | Yes | No | Analytics, App functionality | Required* |
| **App info & performance** (crash logs, diagnostics) | Yes | No | Analytics (crash), App functionality | Required* |
| **Approximate location** (region from IP, not stored as profile) | Yes** | Yes (AdMob) | Advertising, Analytics | Required* |

\* "Required" in Play's sense = collected automatically as part of using the app. Personalized-ad
processing is **consent-gated** (UMP/ATT), so where you want to be precise, mark advertising-ID use
as users-can-choose in regions where the consent prompt applies.

\** Approximate location is inferred by providers from IP; we don't request the location permission.

**Not collected:** name, email, phone, precise location, contacts, photos, messages, financial info,
health, audio, files. (The mic/record permission is disabled in the audio plugin.)

### Android permissions of note
- `com.google.android.gms.permission.AD_ID` — added by the AdMob plugin; **declare advertising-ID
  use** in Data Safety (done above).
- `POST_NOTIFICATIONS` — local reminders (hearts full / daily reward).
- `INTERNET` — network.
- `MODIFY_AUDIO_SETTINGS` — added by `expo-audio` (benign, normal-level).
- ⚠️ `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` currently appear in the merged manifest
  (pulled in by a dependency). They are unused by our code and can trigger Play warnings. Before the
  production build, consider stripping them via `android.blockedPermissions` in `app.json` once the
  source dependency is confirmed:
  ```json
  "android": { "blockedPermissions": [
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.WRITE_EXTERNAL_STORAGE"
  ] }
  ```

---

## Apple App Store — Privacy labels

Map the same collection to Apple's categories. None of this is "Data Used to Track You" **unless the
user grants ATT**; the IDFA is only used for tracking with explicit ATT consent.

### Data Used to Track You (only when ATT granted)
- **Identifiers** — Device ID (IDFA)
- **Usage Data** — Product Interaction, Advertising Data
- **Coarse Location** — Coarse Location

### Data Linked to You
- *(none — no account; the install ID is not linked to identity)*

### Data Not Linked to You
- **Identifiers** — Device ID (advertising), anonymous install ID → Analytics, Third-Party Advertising
- **Usage Data** — Product Interaction → Analytics, Third-Party Advertising
- **Diagnostics** — Crash Data, Performance Data → App Functionality / Analytics
- **Coarse Location** → Third-Party Advertising, Analytics

### Info.plist (handled by config plugins — verify after prebuild)
- `NSUserTrackingUsageDescription` — ATT prompt copy (set via `expo-tracking-transparency`).
- `SKAdNetworkItems` — 50 AdMob network IDs (set via the AdMob plugin) for ad attribution.
- `GADApplicationIdentifier` — AdMob iOS app ID.
- `GADDelayAppMeasurementInit = true` — delays Google measurement until after init/consent.

---

## Consent mechanics (already implemented)

- **EEA/UK/CH + regulated US states:** Google UMP consent form shown on first ad init
  (`ensureAdConsent` in `screens/consent.ts`). Re-manageable via **Settings → Ad privacy settings**.
- **iOS:** ATT prompt requested before the first ad request; declining forces non-personalized ads.
- **Personalization:** the GMA SDK reads the stored TCF consent string automatically; we additionally
  force non-personalized ads when iOS tracking is denied. Ads are content-rated **G**, not
  child-directed.

---

## Pre-submission checklist
- [ ] Add the Privacy Policy URL to **App Store Connect**, **Play Console**, and **AdMob**.
- [ ] Privacy Policy: https://mithatck.com/numbermatch/privacy.html
- [ ] Terms of Service: https://mithatck.com/numbermatch/terms.html
- [ ] Create the `privacy@mithatck.com` mailbox (or change the address in both HTML files).
- [ ] Fill Play Data Safety per the table above; fill Apple privacy labels per the section above.
- [ ] Confirm ATT prompt + UMP form appear on a real device (TestFlight / internal track).
- [ ] Decide on blocking the storage permissions above.
