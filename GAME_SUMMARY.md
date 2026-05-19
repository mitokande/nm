# Number Match — Game Summary

## Overview

Number Match is a mobile puzzle game built with React Native and Expo. The player is presented with a 9-column grid of numbers and must eliminate all cells by matching valid pairs. The goal of each stage is to clear the entire board.

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
- Displays the player's current crown balance in the top-right corner.
- **Endless Mode card** — shows "Continue · Endless · Stage N of 6" if progress exists, otherwise "Play". Resumes at the saved stage.
- **Golden Garden card** — gem-collection mode; tracks progress across levels.
- **Time Attack card** — 60-second sprint; shows personal best score.
- **Freeze Mode card** — icy blue theme; shows current stage in subtitle if progress exists, resumes from saved stage.
- **Daily card** — locked, coming soon.
- Entrance fade + slide animation on first load.

### Game Screen (`screens/GameScreen.tsx`)
- Header: back button, stage label (colour-coded per mode), pause/resume toggle.
- Stats bar: current score (animated bump on change), crown balance / timer, remaining active cells. In Freeze Mode the LEFT card also shows a `❄ N` frozen-cell sub-count.
- In Tutorial mode: tip banner replaces the combo slot — shows the current step's instruction with a color-coded left border (coral = identical, teal = sum-to-10, gold = path).
- Scrollable 9-column game board.
- Action bar: Add Row button and Hint button, each with a remaining-count badge. Hidden in Tutorial mode.
- How-to instruction strip at the bottom. Hidden in Tutorial mode.
- Combo banner, toast notifications, floating score popups, and mega-combo overlay.

---

## Game Modes

| Mode | Key | Description |
|---|---|---|
| **Endless** | `"endless"` | Clear the board stage by stage (1–6), no time limit. Progress saved across sessions. |
| **Golden Garden** | `"golden"` | Match specific gem-bearing cells to hit collection targets. |
| **Time Attack** | `"timeattack"` | Score as high as possible in 60 s; each match adds 1–2 s. |
| **Freeze Mode** | `"freeze"` | Board starts with frozen cells; thaw them by matching orthogonally adjacent pairs. Progress saved. |
| **Tutorial** | `"tutorial"` | 3-stage interactive onboarding. Auto-starts on first launch. Forced-tap overlay guides each step. |

---

## Core Rules

### Match Conditions
Two cells form a valid pair if **both** of the following are true:

1. **Value rule** — the two numbers are identical **or** they sum to 10 (e.g. 3+7, 4+6, 5+5, 1+9, 2+8).
2. **Path rule** — one of the following connectivity conditions is met:
   - The second cell is the **next active cell** immediately after the first (wrapping across row ends).
   - The two cells are **adjacent** (including diagonal) with no active cell between them.
   - The two cells share the same **row, column, or diagonal** and all cells between them are inactive.

Frozen cells are **active obstacles** — they cannot be selected or matched, but they do block paths.

### Tap Flow
1. Tap a cell to select it (spring-bounce animation, amber highlight).
2. Tap a second cell:
   - **Valid pair** → an animated line draws between the two cells (scale burst from centre, then fades over ~270 ms), both cells pop and disappear (scale-up → scale-to-zero animation, floating score, haptic).
   - **Invalid pair** → the second cell shakes, combo resets, selection moves to the new cell.
   - **Frozen cell tapped** → cell shakes, toast hint shown, selection unchanged.
   - **Same cell tapped again** → deselects.

### Row Destruction
When every cell in a row has been matched and deactivated, the row flashes and is permanently removed from the board (+25 points per row). Multiple rows cleared at once give a combined bonus and toast.

### Stage Complete
When all active cells are gone the stage is complete. The player earns **+100 crowns** and sees a summary modal with score, best score, and a new-best indicator. They can proceed to the next stage or return to the main menu.

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
| **＋ Add Row** | 5 (7 in Freeze Mode) | Appends a copy of all currently active cells as new rows at the bottom of the board, creating fresh adjacency opportunities. When the count reaches 0, the button switches to a 📺 "AD" state — watching a rewarded AdMob ad grants one free use. |
| **💡 Hint** | 2 | Highlights a valid pair with a pulsing yellow glow for 2.4 seconds. Frozen cells are excluded from hint candidates. Shows a warning toast if no matches exist. |

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

Combo resets after 2.5 seconds of inactivity or on any invalid tap.

---

## Freeze Mode

Defined in `screens/freezeStages.ts` (`FreezeStage` interface + `FREEZE_STAGES` array).

### Frozen Cells
- Rendered with an icy blue background (`#cce8f5`), blue border (`#5aabdd`), and a prominent ❄ icon.
- The number inside is **hidden** until the cell is thawed — adding a mystery element.
- Cannot be selected or matched; tapping one shakes it and shows a toast.
- Still counts as an active cell for path-blocking and the remaining-cell counter.

### Thaw Mechanic
After any valid match, every frozen cell that is **orthogonally adjacent** (up, down, left, right only — no diagonals) to either matched cell is immediately thawed:
- Its `frozen` flag is set to `false`, revealing its number.
- A spring-scale burst animation plays on the newly thawed cell(s).
- +5 points awarded per thawed cell.
- A toast confirms the thaw count.

### Freeze Stages

| Stage | Cells | Frozen | ~% |
|---|---|---|---|
| 1 | 28 | 6 | 21% |
| 2 | 36 | 9 | 25% |
| 3 | 44 | 11 | 25% |
| 4 | 36 | 8 | 22% |
| 5 | 45 | 11 | 24% |
| 6 | 54 | 15 | 28% |

Frozen cells are spread 2–3 per row so every frozen cell always has a reachable non-frozen neighbor.

### Win Condition
All cells — including those that started frozen — must be matched. The stage-complete modal shows 🧊 "Board Thawed!". Best scores are persisted as `hiscore_freeze_1` … `hiscore_freeze_6`.

---

## Stages (Endless / Freeze)

| Stage | Cells | Rows | Notes |
|---|---|---|---|
| 1 | 28 | 3 + 1 partial | Tutorial-friendly, heavy use of 5+5 pairs |
| 2 | 36 | 4 | Introduces longer sequences |
| 3 | 44 | 4 + 8 partial | More partial rows, complex diagonals |
| 4 | 36 | 4 | Different layout from stage 2, trickier adjacency |
| 5 | 45 | 5 | First 5-row stage |
| 6 | 54 | 6 | Largest board, fully unique layout |


---

## Persistence

All persistent data is stored via `@react-native-async-storage/async-storage`.

| Key | Value | Description |
|---|---|---|
| `crowns` | integer | Total crown balance, shared across all modes |
| `hiscore_1` … `hiscore_6` | integer | Best score per Endless stage |
| `hiscore_freeze_1` … `hiscore_freeze_6` | integer | Best score per Freeze stage |
| `hiscore_timeattack` | integer | Best Time Attack score |
| `golden_done_<id>` | `"1"` | Completion flag per Golden Garden level |
| `endless_stage` | integer | Last-reached Endless stage (for "Continue" resume) |
| `freeze_stage` | integer | Last-reached Freeze stage (for resume) |
| `onboarding_done` | `"1"` | Set after Tutorial is completed; skips tutorial on subsequent launches |

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

## Tutorial Mode

Defined in `screens/tutorialStages.ts` (`TutorialStage` + `TutorialStep` interfaces, `TUTORIAL_STAGES` array).

### How It Works
- **Auto-starts on first launch** — if `onboarding_done` is not set, `App.tsx` routes directly to Tutorial stage 1 instead of the main menu.
- The tutorial board is pre-filled with a fixed `values` array per stage (no random generation).
- Each step specifies a `pair` of cell indices the player must tap. Tapping any other cell shakes it and shows a toast: "Tap the glowing cells!". The correct cells pulse with the existing hint-pair animation.
- After each valid match the step advances and the next pair is highlighted.
- Power-ups (Add Row, Hint) are disabled and hidden throughout the tutorial.
- No crowns are awarded and no scores are saved for tutorial stages.

### Tutorial Stages

| Stage | Title | Steps | Teaches |
|---|---|---|---|
| 1 | Same numbers match | 5 | Identical pairs; consecutive wrap across row end |
| 2 | Pairs that sum to 10 also match | 5 | Sum-to-10 pairs; wrapping demonstrated again |
| 3 | Path connections | 6 | Diagonal, vertical, long-distance (gap-clearing) matches |

### Completion
- Stage 3 complete modal shows "You're all set! →" → calls `onTutorialComplete` in `App.tsx` → sets `onboarding_done = "1"`, clears `needsTutorial` state, navigates to main menu.
- Dev button in `__DEV__` mode clears `onboarding_done` and restarts tutorial.

---

## Animations

| Element | Animation |
|---|---|
| App launch logo | Spring in (scale 0.1 → 1) + fade; text fades in after 120 ms; whole screen fades out |
| Cell selection | Spring bounce (scale 0.82 → 1) |
| Invalid tap | Horizontal shake (translateX, 5 frames) |
| Frozen cell tap | Same horizontal shake as invalid tap |
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
App.tsx                   — Root: splash gate, screen router, crown state, tutorial state, AsyncStorage bootstrap
screens/
  SplashScreen.tsx        — Opening logo animation (spring in, title fade, hold, fade out)
  MainMenu.tsx            — Mode cards; shows stage progress / "Continue" for Endless & Freeze
  GameScreen.tsx          — All game logic, board rendering, modals, animations, tutorial tap-blocking, AdMob rewarded ad
  tutorialStages.ts       — Tutorial stage definitions (values, forced-tap steps, tips)
  goldenStages.ts         — Golden Garden stage definitions (values, gem positions, targets)
  freezeStages.ts         — Freeze Mode stage definitions (values, frozenIndices)
  sound.ts                — Sound playback helpers
assets/
  logo.png                — Master logo (source for all icon variants)
  icon.png                — App icon 1024×1024, logo on #f5efe6 background
  adaptive-icon.png       — Android adaptive icon 1024×1024, transparent background
  splash-icon.png         — Expo splash image 1242×2436, large logo centred
```
