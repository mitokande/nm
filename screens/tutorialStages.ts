export type TutMatchType = "identical" | "sum10" | "path";
export type TutAction = "match" | "hint" | "add";

export type TutorialStep =
  | { action: "match"; pair: [number, number]; tip: string; matchType: TutMatchType }
  | { action: "hint"; tip: string }
  | { action: "add"; tip: string };

export interface TutorialStage {
  id: number;
  title: string;
  values: number[];
  steps: TutorialStep[];
}

// NOTE: these layouts are authored for a 7-wide board (COLS = 7). The geometry
// lessons (row-end wrap, diagonals, same-column, path-after-clear) depend on
// that width, so keep them in sync with COLS in GameScreen.tsx if it changes.
export const TUTORIAL_STAGES: TutorialStage[] = [
  {
    id: 1,
    title: "Same numbers match",
    // Row 0 (0-6): 3 3 4 4 2 2 5  |  Row 1 (7-9): 5 6 6
    values: [3, 3, 4, 4, 2, 2, 5, 5, 6, 6],
    steps: [
      { action: "match", pair: [0, 1], tip: "Drag one number onto a cell with the same number", matchType: "identical" },
      { action: "match", pair: [2, 3], tip: "Same numbers — drag them together!", matchType: "identical" },
      { action: "match", pair: [4, 5], tip: "Keep going — find the pairs", matchType: "identical" },
      { action: "match", pair: [6, 7], tip: "Numbers can match across row ends too!", matchType: "identical" },
      { action: "match", pair: [8, 9], tip: "Last one — same number, same rule", matchType: "identical" },
    ],
  },
  {
    id: 2,
    title: "Pairs that sum to 10 also match",
    // Row 0 (0-6): 5 5 3 7 4 6 1  |  Row 1 (7-9): 9 2 8
    values: [5, 5, 3, 7, 4, 6, 1, 9, 2, 8],
    steps: [
      { action: "match", pair: [0, 1], tip: "You know this one — same numbers match", matchType: "identical" },
      { action: "match", pair: [2, 3], tip: "3 + 7 = 10 — different numbers can match too!", matchType: "sum10" },
      { action: "match", pair: [4, 5], tip: "4 + 6 = 10", matchType: "sum10" },
      { action: "match", pair: [6, 7], tip: "1 + 9 = 10 — across the row end!", matchType: "sum10" },
      { action: "match", pair: [8, 9], tip: "2 + 8 = 10 — you've got it!", matchType: "sum10" },
    ],
  },
  {
    id: 3,
    title: "Path connections",
    // Row 0 (0-6):  3 7 5 6 8 8 6
    // Row 1 (7-11): 7 3 5 4 6
    values: [3, 7, 5, 6, 8, 8, 6, 7, 3, 5, 4, 6],
    steps: [
      { action: "match", pair: [0, 8], tip: "Numbers match diagonally too!", matchType: "path" },
      { action: "match", pair: [1, 7], tip: "Diagonals work in both directions", matchType: "path" },
      { action: "match", pair: [2, 9], tip: "Same column, different row — valid!", matchType: "path" },
      { action: "match", pair: [4, 5], tip: "Match these to open up a hidden connection...", matchType: "identical" },
      { action: "match", pair: [3, 6], tip: "Gap cleared! Same row, path now open!", matchType: "path" },
      { action: "match", pair: [10, 11], tip: "Last pair — 4 + 6 = 10. You're ready!", matchType: "sum10" },
    ],
  },
  {
    id: 4,
    title: "Power-ups",
    // Row 0 (0-6): 5 5 3 7 2 8 1  |  Row 1 (7-8): 9 4
    // The post-action match steps depend on findHint scan order (index-ascending)
    // and performAddRow append order (it re-adds the remaining active values from
    // cells.length onward), so [9, 10] are the first two appended cells: 2 and 8.
    values: [5, 5, 3, 7, 2, 8, 1, 9, 4],
    steps: [
      { action: "match", pair: [0, 1], tip: "Quick warm-up — same numbers match", matchType: "identical" },
      { action: "hint",  tip: "Stuck? Tap 💡 to reveal a valid pair" },
      { action: "match", pair: [2, 3], tip: "There it is — drag the glowing pair together", matchType: "sum10" },
      { action: "add",   tip: "Out of moves? Tap ＋ to add a row" },
      { action: "match", pair: [9, 10], tip: "Fresh cells! 2 + 8 = 10. You're ready!", matchType: "sum10" },
    ],
  },
];
