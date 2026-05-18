export type TutMatchType = "identical" | "sum10" | "path";

export interface TutorialStep {
  pair: [number, number];
  tip: string;
  matchType: TutMatchType;
}

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
      { pair: [0, 1], tip: "Tap two cells with the same number", matchType: "identical" },
      { pair: [2, 3], tip: "Same numbers — tap them to match!", matchType: "identical" },
      { pair: [4, 5], tip: "Keep going — find the pairs", matchType: "identical" },
      { pair: [6, 7], tip: "Nice! Same number, same rule", matchType: "identical" },
      { pair: [8, 9], tip: "Numbers can match across row ends too!", matchType: "identical" },
    ],
  },
  {
    id: 2,
    title: "Pairs that sum to 10 also match",
    // Row 0: 5 5 3 7 4 6 2 8 1  |  Row 1 partial: 9
    values: [5, 5, 3, 7, 4, 6, 2, 8, 1, 9],
    steps: [
      { pair: [0, 1], tip: "You know this one — same numbers match", matchType: "identical" },
      { pair: [2, 3], tip: "3 + 7 = 10 — different numbers can match too!", matchType: "sum10" },
      { pair: [4, 5], tip: "4 + 6 = 10", matchType: "sum10" },
      { pair: [6, 7], tip: "2 + 8 = 10", matchType: "sum10" },
      { pair: [8, 9], tip: "1 + 9 = 10 — across the row end!", matchType: "sum10" },
    ],
  },
  {
    id: 3,
    title: "Path connections",
    // Row 0 (0-8): 3 7 5 3 5 5 3 4 6
    // Row 1 partial (9-11): 7 3 5
    // Steps 1-3: diagonal/vertical pairs using rows 0+1
    // Step 4: (4,5) clears cols 4,5 to open path
    // Step 5: (3,6) long-distance same-row match (cols 4,5 now clear)
    // Step 6: (7,8) final adjacent sum-to-10
    values: [3, 7, 5, 3, 5, 5, 3, 4, 6, 7, 3, 5],
    steps: [
      { pair: [0, 10], tip: "Numbers match diagonally too!", matchType: "path" },
      { pair: [1, 9],  tip: "Diagonals work in both directions", matchType: "path" },
      { pair: [2, 11], tip: "Same column, different row — valid!", matchType: "path" },
      { pair: [4, 5],  tip: "Match these to open up a hidden connection...", matchType: "identical" },
      { pair: [3, 6],  tip: "Gap cleared! Same row, path now open!", matchType: "path" },
      { pair: [7, 8],  tip: "Last pair — 4 + 6 = 10. You're ready!", matchType: "sum10" },
    ],
  },
];
