# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project

Number Match — a React Native / Expo SDK 54 mobile puzzle game (TypeScript, strict mode, React Native 0.81, new architecture enabled). Targets iOS and Android; web is supported by Expo but not a shipping target. AdMob (`react-native-google-mobile-ads`) is wired in but lazy-required and guarded against Expo Go.

`GAME_SUMMARY.md` is the canonical product spec — read it for rules, scoring, persistence keys, and design tokens before changing gameplay. Note: `GAME_SUMMARY.md` still says "9-column grid" in places; the actual board is `COLS = 7` (see `screens/GameScreen.tsx`, changed in commit 8c5644c). Trust the code.

## Commands

```bash
npm run start          # expo start (Metro bundler + QR for Expo Go / dev client)
npm run ios            # expo run:ios (native build, needed for AdMob)
npm run android        # expo run:android
npm run web            # expo start --web
node scripts/gen-sounds.js   # regenerate assets/sounds/*.wav from scratch
```

There is no test runner, linter, or formatter configured — don't invent commands. TypeScript checking is via `tsc --noEmit` against the Expo base config (`tsconfig.json` extends `expo/tsconfig.base`, strict on).

EAS builds are configured (`eas.json`): `development` (dev client), `preview` (internal APK), `production` (autoincrement, remote app version source).

## Architecture

### Navigation & root state

`App.tsx` is the entire navigation layer — no router. It owns four pieces of cross-screen state:

- `screen: "menu" | "game"` — current view (a fade-in/out `Animated.View` cross-fades between `MainMenu` and `GameScreen`).
- `mode: GameMode` — which game mode is active (`endless | golden | timeattack | freeze | tutorial`). Exported as a type from `App.tsx` and imported by `GameScreen`.
- `crowns` — global currency, persisted as `crowns` in AsyncStorage, hydrated once on mount.
- `gardenState` — meta-progression for the "restore-the-garden" feature, persisted as `garden_state`, normalized through `gardenData.normalizeGardenState`.
- `needsTutorial` — if `onboarding_done !== "1"` on launch, `navigateTo` will force any `"game"` navigation into tutorial mode, stage 1. The user cannot skip into another mode until the tutorial is completed.

Splash gating: a one-shot `SplashScreen` is rendered until `splashDone` is set. AsyncStorage hydration runs in parallel with the splash animation.

### Game logic lives in one file

`screens/GameScreen.tsx` (~2000 lines) is the entire game: board state, match/path validation (`isValidPair`, `pathClearVisible`, `visibleRow`, `originalRow`), row-destruction, combo system, hint search, freeze/thaw mechanic, tutorial tap-blocking, golden-gem tracking, time-attack timer, AdMob rewarded ad for free Add Rows, and all animations (React Native `Animated` API + a small amount of Reanimated v4 via `react-native-gesture-handler`'s `GestureDetector`). Mode-specific behavior is gated on the `mode` prop rather than split into separate screens.

**If you change match rules** (`isValidPair`, `pathClearVisible`, etc.) you must also update the JS port in `tools/level-editor/index.html` — the editor's play-test feature is a verbatim copy and will silently desync. See `tools/level-editor/README.md` for the contract.

### Level data

All hand-authored stages live in `screens/levels.json` and are loaded at startup:

- `endless[].values` — flat board, COLS=7
- `freeze[].values` + `frozenIndices` — same plus frozen-cell positions
- `golden[]` — values, `gems` (string-keyed by index, converted to numbers in `GameScreen`), and per-gem `targets`

`tools/level-editor/` is a single-file, no-build HTML editor — open `tools/level-editor/index.html` directly in a browser. It auto-saves to `localStorage`, exports a fresh `levels.json`, and play-tests against ported match rules. There are also stale-looking siblings (`screens/levelss.json`, `screens/s.json`) that are not imported — don't touch them unless cleaning up.

Tutorial stages are not in `levels.json` — they live in `screens/tutorialStages.ts` as a separate hand-scripted onboarding flow with forced tap pairs.

### Persistence

All state is in AsyncStorage with flat string keys (no namespacing library). See `GAME_SUMMARY.md` "Persistence" table for the full key list. The dev "reset tutorial" button (`App.tsx:handleResetTutorial`) calls `AsyncStorage.clear()` and wipes everything — useful for testing onboarding.

### Sounds

`screens/sound.ts` lazily creates `expo-audio` players on first `playSound()` call. WAV files are synthesized procedurally by `scripts/gen-sounds.js` — re-run it to regenerate, don't hand-edit the WAVs.

### AdMob

Real ad unit IDs are hard-coded in `GameScreen.tsx` (iOS `ca-app-pub-4604843322018757/2967656297`, Android `ca-app-pub-4604843322018757/9772661819`); `__DEV__` uses Google's test IDs. The native module is `require()`d lazily inside a `Constants.appOwnership !== "expo"` guard so the Expo Go workflow doesn't crash. AdMob only works in dev-client or native builds — `npm run start` + Expo Go will show "Ads not available" toasts and that is expected.
