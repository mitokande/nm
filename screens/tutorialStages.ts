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

export const TUTORIAL_STAGES: TutorialStage[] = [
  {
    id: 1,
    title: "Same numbers match",
    // Row 0: 3 3 4 4 2 2 3 3 2  |  Row 1 partial: 2
    values: [3, 3, 4, 4, 2, 2, 3, 3, 2, 2],
    steps: [
      { action: "match", pair: [0, 1], tip: "Drag one number onto a cell with the same number", matchType: "identical" },
      { action: "match", pair: [2, 3], tip: "Same numbers — drag them together!", matchType: "identical" },
      { action: "match", pair: [4, 5], tip: "Keep going — find the pairs", matchType: "identical" },
      { action: "match", pair: [6, 7], tip: "Nice! Same number, same rule", matchType: "identical" },
      { action: "match", pair: [8, 9], tip: "Numbers can match across row ends too!", matchType: "identical" },
    ],
  },
  {
    id: 2,
    title: "Pairs that sum to 10 also match",
    // Row 0: 5 5 3 7 4 6 2 8 1  |  Row 1 partial: 9
    values: [5, 5, 3, 7, 4, 6, 2, 8, 1, 9],
    steps: [
      { action: "match", pair: [0, 1], tip: "You know this one — same numbers match", matchType: "identical" },
      { action: "match", pair: [2, 3], tip: "3 + 7 = 10 — different numbers can match too!", matchType: "sum10" },
      { action: "match", pair: [4, 5], tip: "4 + 6 = 10", matchType: "sum10" },
      { action: "match", pair: [6, 7], tip: "2 + 8 = 10", matchType: "sum10" },
      { action: "match", pair: [8, 9], tip: "1 + 9 = 10 — across the row end!", matchType: "sum10" },
    ],
  },
  {
    id: 3,
    title: "Path connections",
    // Row 0 (0-8): 3 7 5 3 5 5 3 4 6
    // Row 1 partial (9-11): 7 3 5
    values: [3, 7, 5, 3, 5, 5, 3, 4, 6, 7, 3, 5],
    steps: [
      { action: "match", pair: [0, 10], tip: "Numbers match diagonally too!", matchType: "path" },
      { action: "match", pair: [1, 9],  tip: "Diagonals work in both directions", matchType: "path" },
      { action: "match", pair: [2, 11], tip: "Same column, different row — valid!", matchType: "path" },
      { action: "match", pair: [4, 5],  tip: "Match these to open up a hidden connection...", matchType: "identical" },
      { action: "match", pair: [3, 6],  tip: "Gap cleared! Same row, path now open!", matchType: "path" },
      { action: "match", pair: [7, 8],  tip: "Last pair — 4 + 6 = 10. You're ready!", matchType: "sum10" },
    ],
  },
  {
    id: 4,
    title: "Power-ups",
    // 9 cells. Indices for the post-action match steps depend on findHint scan order
    // (index-ascending) and performAddRow append order (cells.length onward).
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
