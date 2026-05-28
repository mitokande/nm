# Number Match — Level Editor

A single-file, no-build, browser-based editor for authoring `screens/levels.json`.

## Launch

Open `tools/level-editor/index.html` directly in any modern browser. No server, no install, no build step. State auto-saves to `localStorage` between sessions.

## Workflow

1. **Pick a mode tab** — Endless, Freeze, or Golden.
2. **Pick or create a stage** in the left sidebar.
3. **Click cells** in the grid to set values:
   - Left-click cycles the cell `empty → 1 → 2 → … → 9 → empty`.
   - Right-click opens a number picker (faster than cycling).
   - **Freeze mode:** shift-click toggles the ❄ frozen flag on a cell (must have a number first).
   - **Golden mode:** shift-click opens the gem picker (set a number first).
4. **Use Add Row / Remove Last Row** to resize the board (9 cells per row).
5. **Right sidebar** holds per-stage metadata — Golden has the stage name and per-gem target counts.
6. **Play-test** (bottom) — enable, then click two active cells to verify they form a valid pair under the real game rules. Valid pairs become inactive so you can step through a full solve and spot dead-ends.
7. **Export** when you're done — downloads `levels.json`.
8. **Move the file** to `screens/levels.json` in the repo. The game will load it on the next reload.

## Round-trip

- **Load JSON…** in the toolbar imports any compatible JSON (e.g. the current `screens/levels.json`) — useful if you want to keep editing the deployed levels rather than the localStorage copy.
- **Reset to seed** restores the levels the editor was shipped with (a snapshot of the original 6/6/5 stages).

## JSON shape

```jsonc
{
  "endless": [ { "id": 1, "values": [3,1,2, ...] } ],
  "freeze":  [ { "id": 1, "values": [...], "frozenIndices": [2,5,10] } ],
  "golden":  [ { "id": 1, "name": "First Bloom", "values": [...],
                 "gems": { "0": "ruby", "4": "ruby" },
                 "targets": { "ruby": 3, "emerald": 3 } } ]
}
```

- IDs are renumbered from 1 in order — don't worry about keeping them in sync manually.
- `gems` uses stringified indices because JSON requires string keys; the game converts them back to numbers at load time.
- Empty cells (value 0) act as inactive slots in the board — the game's `buildCells` only creates a `Cell` for indices with values > 0 in its standard data, so the editor lets you leave gaps if you want partial rows.

## Keeping match rules in sync

The play-test feature is a verbatim port of `isValidPair`, `pathClearVisible`, `visibleRow`, and `originalRow` from `screens/GameScreen.tsx`. If you change the match rules in the game, update the JS ports in `index.html` (look for the "Match validation" comment block) so play-test stays accurate.

## Not in scope

- Tutorial mode (it's a guided onboarding script, not a hand-authored level — stays in `screens/tutorialStages.ts`).
- Procedural level generation.
- Difficulty / metadata fields beyond what the game already reads.
