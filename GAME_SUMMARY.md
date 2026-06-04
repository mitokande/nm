# Number Match — Game Summary

## Overview

Number Match is a mobile puzzle game built with React Native and Expo. The player is presented with a 7-column grid of numbers and must eliminate all cells by **dragging** one number onto another to form a valid match. The goal of each stage is to clear the entire board.

---

## Screens

### Splash Screen (`screens/SplashScreen.tsx`)
- Plays on every app launch before the main menu appears.
- Logo springs in from tiny (scale 0.1) with a natural bounce animation.
- Title "Number Match" and uppercase tagline fade in 120 ms after the logo settles.
- 900 ms hold, then the whole screen fades out and hands control to `App.tsx`.
- Tap anywhere to skip immediately.
- Runs in parallel with AsyncStorage loading — no startup delay.

### Main Menu (`screens/MainMenu.tsx`)
- Full-screen illustrated **garden background** that crossfades to a new image whenever the player restores another garden area (see [Garden Meta](#garden-meta)). The bottom UI floats over the scene.
- Crown balance pinned to the top-right corner; in `__DEV__` builds, tapping it adds 10 crowns for debugging.
- **Endless play button** — "Stage N · earn crowns to grow"; resumes from the saved Endless stage.
- **Garden card** (`screens/Garden.tsx`) — shows the current restoration area, a progress bar, and the crown cost remaining. Tapping the card invests all available crowns; if it's not enough yet, the card shakes; if it completes the area, the bar fills to 100% and the background image advances.
- Entrance fade + slide animation on first load.
- (Golden Garden, Time Attack, and Freeze Mode are implemented in `GameScreen.tsx` and addressable via `onPlay(stage, mode)`, but at the time of writing the main menu surfaces only Endless + Garden. Tutorial mode auto-launches on first run.)

### Game Screen (`screens/GameScreen.tsx`)
- Header: back button, stage label (colour-coded per mode), pause/resume toggle.
- Stats bar: current score (animated bump on change), crown balance / timer, remaining active cells. In Freeze Mode the LEFT card also shows a `❄ N` frozen-cell sub-count.
- In Tutorial mode: tip banner replaces the combo slot — shows the current step's instruction with a color-coded left border (coral = identical, teal = sum-to-10, gold = path).
- Scrollable 7-column game board. A board-level pan gesture (`react-native-gesture-handler`) handles dragging; a floating drag tile follows the finger on the UI thread via Reanimated shared values.
- Action bar: Add Row button and Hint button, each with a remaining-count badge. Hidden in Tutorial mode except for stage 4 (the power-ups lesson).
- How-to instruction strip at the bottom. Hidden in Tutorial mode.
- Combo banner, toast notifications, floating score popups, and mega-combo overlay.

---

## Game Modes

| Mode | Key | Description |
|---|---|---|
| **Endless** | `"endless"` | Clear the board stage by stage (1–7), no time limit. Progress saved across sessions. |
| **Golden Garden** | `"golden"` | Match specific gem-bearing cells to hit per-gem collection targets (5 stages). |
| **Time Attack** | `"timeattack"` | Sprint scored under a 60 s starting timer; clearing the whole board adds **+15 s** (capped at 120 s) and re-seeds with stage 1. Valid matches may also add a small time bonus. |
| **Freeze Mode** | `"freeze"` | Board starts with frozen cells; thaw them by matching orthogonally adjacent pairs (6 stages). Progress saved. |
| **Tutorial** | `"tutorial"` | 4-stage interactive onboarding. Auto-starts on first launch. Forced-drag overlay guides each step. |

---

## Core Rules

### Match Conditions
Two cells form a valid pair if **both** of the following are true:

1. **Value rule** — the two numbers are identical **or** they sum to 10 (e.g. 3+7, 4+6, 5+5, 1+9, 2+8).
2. **Path rule** — one of the following connectivity conditions is met:
   - The second cell is the **next active cell** immediately after the first (wrapping across row ends).
   - The two cells are **adjacent** (including diagonal) with no active cell between them.
   - The two cells share the same **row, column, or diagonal** and all cells between them are inactive.

Frozen cells are **active obstacles** — they cannot be dragged or matched, but they do block paths.

### Drag Flow
The board uses a single board-level pan gesture. At touch-down, a worklet checks the `dragMapSV` shared snapshot to decide whether the finger landed on a draggable cell:

1. **Touch lands on a number** → the cell is "picked up" (spring-bounce animation), a floating tile appears under the finger, and the underlying ScrollView is locked.
2. **Drag** → as the finger moves, any cell currently under it that would form a valid pair with the source is highlighted as a hover drop target.
3. **Drop on a valid target** → an animated line draws between the two cells (scale burst from centre, then fades over ~270 ms), both cells pop and disappear (scale-up → scale-to-zero animation, floating score, haptic).
4. **Drop on an invalid cell** → the target shakes, combo resets, source is released.
5. **Drop on a frozen cell** → cell shakes, toast hint shown.
6. **Touch lands on empty space** → the gesture stays inactive so the ScrollView can scroll the board normally.

### Row Destruction
When every cell in a row has been matched and deactivated, the row flashes and is permanently removed from the board (+25 points per row). Multiple rows cleared at once give a combined bonus and toast.

### Stage Complete
When all active cells are gone the stage is complete. The player earns **+1 crown** (a single crown per Endless / Freeze / Golden stage; Time Attack awards +1 crown per board cleared during the timer). A summary modal shows score, best score, and a new-best indicator. They can proceed to the next stage or return to the main menu. Crowns can later be invested into the [Garden Meta](#garden-meta) progression on the main menu.

### Dead-End Detection
If the player runs out of Add Row uses **and** no valid pairs exist, a **No Moves Left** modal appears automatically, offering Restart or Main Menu.

---

## Scoring

| Event | Points |
|---|---|
| Match identical numbers | 5 + combo bonus |
| Match numbers summing to 10 | 10 + combo bonus |
| Row cleared | 25 per row |
| Cell thawed (Freeze Mode) | 5 per cell |
| Stage complete | 0 (crowns awarded separately) |

**Combo bonus** — each consecutive match within 2.5 seconds adds `combo × 2` points to the next match. A missed match resets the combo to 0.

---

## Power-Ups

| Button | Count per stage | Effect |
|---|---|---|
| **＋ Add Row** | 5 (7 in Freeze, 0 in Time Attack, 1 in Tutorial stage 4) | Appends a copy of all currently active cells as new rows at the bottom of the board, creating fresh adjacency opportunities. When the count reaches 0, the button switches to a 📺 "AD" state — watching a rewarded AdMob ad grants one free use. |
| **💡 Hint** | 2 (1 in Tutorial stage 4, 0 in other tutorial stages) | Highlights a valid pair with a pulsing yellow glow for 2.4 seconds. Frozen cells are excluded from hint candidates. Shows a warning toast if no matches exist. |

### Add Row — Ad Reward Flow
When `adds === 0` the button shows a 📺 icon with a terracotta "AD" badge and a terracotta border. Pressing it:
- If a rewarded ad is loaded → plays the ad; on `EARNED_REWARD` callback → row is added for free.
- If the ad hasn't loaded yet → shows "Ad not ready — try again" toast and triggers a reload.
- In Expo Go (native module absent) → shows "Ads not available" toast; no crash.

Ad setup: `react-native-google-mobile-ads`. iOS App ID `ca-app-pub-4604843322018757~1702676089`, rewarded unit `ca-app-pub-4604843322018757/2967656297`. Android App ID `ca-app-pub-4604843322018757~6145619448`, rewarded unit `ca-app-pub-4604843322018757/9772661819`. Test IDs used in `__DEV__` builds. Module is lazy-required and guarded with `Constants.appOwnership !== "expo"` so Expo Go is unaffected.

---

## Combo System

| Combo count | Visual effect |
|---|---|
| ×2 – ×3 | Red banner, spring scale + wobble |
| ×4 – ×5 | Darker red "ON FIRE 🔥" banner, board shake, heavy haptic |
| ×6+ | Purple "UNSTOPPABLE!" banner + full-screen mega-combo burst overlay |

Combo resets after 2.5 seconds of inactivity or on any invalid drop.

---

## Freeze Mode

Defined in `screens/levels.json` under the `freeze` key (`{ id, values, frozenIndices }` per stage). The `FreezeStage` interface lives inline in `screens/GameScreen.tsx`.

### Frozen Cells
- Rendered with an icy blue background (`#cce8f5`), blue border (`#5aabdd`), and a prominent ❄ icon.
- The number inside is **hidden** until the cell is thawed — adding a mystery element.
- Cannot be picked up or matched; dropping onto one shakes it and shows a toast.
- Still counts as an active cell for path-blocking and the remaining-cell counter.

### Thaw Mechanic
After any valid match, every frozen cell that is **orthogonally adjacent** (up, down, left, right only — no diagonals) to either matched cell is immediately thawed:
- Its `frozen` flag is set to `false`, revealing its number.
- A spring-scale burst animation plays on the newly thawed cell(s).
- +5 points awarded per thawed cell.
- A toast confirms the thaw count.

### Win Condition
All cells — including those that started frozen — must be matched. The stage-complete modal shows 🧊 "Board Thawed!". Best scores are persisted as `hiscore_freeze_1` … `hiscore_freeze_6`. See the [Freeze stage table](#freeze-6-stages) below for per-stage cell / frozen counts.

---

## Stages

All hand-authored stages live in **`screens/levels.json`** and are loaded at startup. The repo includes a single-file browser editor at `tools/level-editor/index.html` (no build step) for authoring this JSON — see `tools/level-editor/README.md`.

### Endless (7 stages)

| Stage | Active cells | Rows (7-wide) |
|---|---|---|
| 1 | 28 | 4 |
| 2 | 36 | 6 |
| 3 | 44 | 7 |
| 4 | 36 | 6 |
| 5 | 45 | 7 |
| 6 | 54 | 8 |
| 7 | 45 | 7 |

### Freeze (6 stages)

| Stage | Cells | Frozen | ~% |
|---|---|---|---|
| 1 | 28 | 6 | 21% |
| 2 | 36 | 9 | 25% |
| 3 | 44 | 11 | 25% |
| 4 | 36 | 8 | 22% |
| 5 | 45 | 11 | 24% |
| 6 | 54 | 15 | 28% |

Frozen cells are spread 2–3 per row so every frozen cell always has a reachable non-frozen neighbor.

### Golden Garden (5 stages)

| Stage | Name | Cells | Targets |
|---|---|---|---|
| 1 | First Bloom | 27 | 💎 ruby × 3, emerald × 3 |
| 2 | Sapphire Stream | 36 | sapphire × 4, ruby × 3 |
| 3 | Topaz Trove | 36 | topaz × 4, emerald × 2, ruby × 2 |
| 4 | Amethyst Grove | 36 | amethyst × 4, sapphire × 2, ruby × 2 |
| 5 | Crown Jewels | 45 | ruby × 3, emerald × 3, sapphire × 2, topaz × 2, amethyst × 2 |


---

## Persistence

All persistent data is stored via `@react-native-async-storage/async-storage`.

| Key | Value | Description |
|---|---|---|
| `crowns` | integer | Total crown balance, shared across all modes |
| `garden_state` | JSON | `{ restored, invested }` — current Garden meta progression |
| `hiscore_1` … `hiscore_7` | integer | Best score per Endless stage |
| `hiscore_freeze_1` … `hiscore_freeze_6` | integer | Best score per Freeze stage |
| `hiscore_timeattack` | integer | Best Time Attack score |
| `golden_done_<id>` | `"1"` | Completion flag per Golden Garden level |
| `endless_stage` | integer | Last-reached Endless stage (for "Continue" resume) |
| `freeze_stage` | integer | Last-reached Freeze stage (for resume) |
| `onboarding_done` | `"1"` | Set after Tutorial is completed; skips tutorial on subsequent launches |

The `__DEV__` "reset tutorial" button calls `AsyncStorage.clear()` — it wipes the entire store, including crowns and garden state, then restarts the tutorial.

Crown data loads on app startup; best scores load each time a stage begins or is restarted.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81 |
| Build tooling | Expo SDK 54 |
| Language | TypeScript 5.9 |
| Haptics | `expo-haptics` |
| Storage | `@react-native-async-storage/async-storage` |
| Navigation | Manual `screen` state (no navigation library) |
| Animations | React Native `Animated` API, native driver |
| Gestures | `react-native-gesture-handler` (board-level pan) + `react-native-reanimated` shared values for the floating drag tile |
| Android shadow fix | `renderToHardwareTextureAndroid` on animated views |
| Ads | `react-native-google-mobile-ads` (rewarded ad for Add Row) |

## Visual Design

**Theme:** Warm cozy — parchment/ivory backgrounds, terracotta/burnt-sienna primary, sage green for matches, amber gold for crowns, icy blue for freeze.

| Token | Value | Usage |
|---|---|---|
| `bg` | `#fdf3e7` | App background (ivory parchment) |
| `white` | `#fffaf3` | Cards, cells (warm off-white) |
| `ink` | `#3d2b1f` | Primary text (warm dark brown) |
| `primary` | `#c96a35` | Buttons, accents (terracotta) |
| `good` | `#5baa7a` | Match flash, success (sage green) |
| `crown` | `#e8a020` | Crown icon/balance (deep amber) |
| `danger` | `#d45c5c` | Errors, badges (warm muted red) |
| `freeze` | `#3a9fdf` | Freeze Mode accents (sky blue) |
| `freezeBg` | `#cce8f5` | Frozen cell background (ice blue) |
| `freezeBorder` | `#5aabdd` | Frozen cell border |

Shadows use warm amber-brown tints (`#b89070`) instead of black. Border radii are slightly increased (cards 24, buttons 18, stat cards 18) for a softer feel. Combo escalation: terracotta → deep warm red → soft purple.

---

## Garden Meta

A persistent "restore the garden" meta layer that sits behind the main menu. The Endless / Freeze / Golden / Time Attack modes are the **earning** loop (each completed board gives +1 crown) and the Garden is the **spending** loop. Defined in `screens/gardenData.ts` (pure helpers + types) and rendered by `screens/Garden.tsx` (embedded into `MainMenu`).

### Areas

There are four restoration areas, restored in order. Each has a fixed crown cost:

| Order | Area | Icon | Cost (crowns) |
|---|---|---|---|
| 1 | Plant a Rose | 🌹 | 5 |
| 2 | Add another Flower Bed | 🌸 | 8 |
| 3 | Grow the Rose | 🌱 | 12 |
| 4 | Full Bloom | 🌺 | 20 |

Persisted state is `{ restored: number, invested: number }` — how many areas are fully restored, and how many crowns are banked toward the *current* one. Loaded via the tolerant `normalizeGardenState` so older / partial saves never crash.

### Investing

Tapping the Garden card on the main menu invokes `App.tsx:handleInvestGarden` → `gardenData.investCrowns`. The helper spends only as many crowns as needed to finish the current area; any surplus is left in the player's balance. The progress bar animates to the new fill; if the area completes, the bar fills to 100%, then the next area's bar resets to 0 and the full-screen background image crossfades to the next scene.

### Scenes

The main-menu background advances through six images keyed off `stageImageIndex(gardenState)`:

| Index | File | Meaning |
|---|---|---|
| 0 | `assets/garden/main.jpg` | Barren (nothing restored) |
| 1 | `assets/garden/stage0.png` | Rose planted |
| 2 | `assets/garden/stage1.png` | Second flower bed added |
| 3 | `assets/garden/stage2.png` | Rose growing |
| 4 | `assets/garden/stage3.png` | Rose growing more |
| 5 | `assets/garden/stage4.png` | Fully restored |

## Tutorial Mode

Defined in `screens/tutorialStages.ts` (`TutorialStage` + `TutorialStep` interfaces, `TUTORIAL_STAGES` array).

### How It Works
- **Auto-starts on first launch** — if `onboarding_done` is not set, `App.tsx` routes directly to Tutorial stage 1 instead of the main menu. Until the tutorial is completed, `App.tsx:navigateTo` intercepts any other game-mode navigation and forces it back into the tutorial.
- The tutorial board is pre-filled with a fixed `values` array per stage (no random generation). Layouts are authored for the 7-wide board.
- Each step has an `action`: `"match"` (a forced drag pair), `"hint"`, or `"add"`. For `"match"` steps, dragging any other cell shakes it and shows a toast; the correct cells pulse with the hint-pair animation.
- Power-ups (Add Row, Hint) are disabled and hidden except in stage 4, where the script issues a single Add Row and a single Hint.
- No crowns are awarded and no scores are saved for tutorial stages.

### Tutorial Stages

| Stage | Title | Steps | Teaches |
|---|---|---|---|
| 1 | Same numbers match | 5 | Identical pairs; consecutive wrap across row end |
| 2 | Pairs that sum to 10 also match | 5 | Sum-to-10 pairs; wrapping demonstrated again |
| 3 | Path connections | 6 | Diagonal, vertical, long-distance (gap-clearing) matches |
| 4 | Power-ups | 5 (3 matches + 1 hint + 1 add) | Using 💡 Hint when stuck and ＋ Add Row when out of moves |

### Completion
- Stage 4 complete modal shows "You're all set! →" → calls `onTutorialComplete` in `App.tsx` → sets `onboarding_done = "1"`, clears `needsTutorial` state, navigates to main menu.
- Dev button in `__DEV__` mode clears storage and restarts tutorial.

---

## Animations

| Element | Animation |
|---|---|
| App launch logo | Spring in (scale 0.1 → 1) + fade; text fades in after 120 ms; whole screen fades out |
| Cell selection | Spring bounce (scale 0.82 → 1) |
| Invalid drop | Horizontal shake on the target cell (translateX, 5 frames) |
| Frozen cell drop | Same horizontal shake as invalid drop |
| Matched pair | Scale pop 1 → 1.3 → 0, sage-green background flash |
| Match line | Rotated pill between matched cells; scaleX 0 → 1 (80 ms) then opacity fade (120 ms) |
| Cell thaw | Spring scale burst 1 → 1.3 → 1 |
| Hint / tutorial cells | Looping scale pulse 1 → 1.12 → 1 |
| Floating score | Float upward + scale burst + fade out (900 ms) |
| Row clearing | Opacity flash before removal |
| Board shake | translateX shake triggered at combo ≥ 4 |
| Combo banner | Spring scale + rotation wobble on every increment |
| Mega combo | Scale burst + fade overlay at combo ≥ 5 |
| Score counter | Spring bump (scale 1.4 → 1) on each point gain |
| Toast | Slide up + fade in |
| Main menu | Fade + slide entrance on mount |
| Screen transitions | Fade out (180 ms) → swap → fade in (280 ms) |

---

## App Config (`app.json`)

| Field | Value |
|---|---|
| Android package | `com.anonymous.numbermatchrn` |
| iOS bundle ID | `com.mithatcanturan.numbermatch` |
| iOS encryption | `ITSAppUsesNonExemptEncryption: false` |
| EAS project ID | `a211c348-5ff9-4efc-98d8-8f5d4a89f67b` |
| Plugins | `expo-audio`, `react-native-google-mobile-ads` |
| Splash background | `#f5efe6` |
| Adaptive icon background | `#f5efe6` |

---

## File Structure

```
App.tsx                   — Root: splash gate, screen router, crown + garden state, tutorial gate, AsyncStorage bootstrap
screens/
  SplashScreen.tsx        — Opening logo animation (spring in, title fade, hold, fade out)
  MainMenu.tsx            — Full-screen garden background; Endless play button; Garden card; dev controls
  Garden.tsx              — Garden investment card (progress bar, area icon, press-to-invest)
  gardenData.ts           — Pure helpers: GARDEN_AREAS, normalizeGardenState, investCrowns
  GameScreen.tsx          — All game logic, drag gesture, board rendering, modals, animations, tutorial drag-blocking, AdMob rewarded ad
  tutorialStages.ts       — Tutorial stage definitions (values, forced-drag steps, tips)
  goldenStages.ts         — Type definitions (GemType, GoldenStage, GEM_EMOJI, GEM_NAME)
  levels.json             — Hand-authored stage data for endless / freeze / golden
  sound.ts                — Sound playback helpers
tools/level-editor/
  index.html              — Single-file browser editor for levels.json (no build step)
  README.md               — Editor docs; explains play-test rule sync invariant
assets/
  garden/                 — Six full-screen scene images (main.jpg + stage0..stage4.png)
  sounds/                 — Procedurally generated WAVs (see scripts/gen-sounds.js)
  logo.png                — Master logo (source for all icon variants)
  icon.png                — App icon 1024×1024, logo on #f5efe6 background
  adaptive-icon.png       — Android adaptive icon 1024×1024, transparent background
  splash-icon.png         — Expo splash image 1242×2436, large logo centred
scripts/
  gen-sounds.js           — Procedural WAV generator for assets/sounds/*.wav
```

> Note: when editing match rules in `GameScreen.tsx` (`isValidPair`, `pathClearVisible`, `visibleRow`, `originalRow`), the JS port in `tools/level-editor/index.html` must be kept in sync — the editor's play-test is a verbatim copy of those functions.
