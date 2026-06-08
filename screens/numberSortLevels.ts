// Number Sort prototype — hand-authored puzzles. Tubes are bottom-to-top;
// `tube[tube.length - 1]` is the visible top that gets poured first.
//
// Solvability rule: every level must have a sequence of pours that empties
// every tube. Pours are either "move to empty" or "pair-and-vanish on same
// number / sum to 10".

export interface NSLevel {
  id: number;
  name: string;
  capacity: number;
  tubes: number[][];
}

export const NS_LEVELS: NSLevel[] = [
  {
    id: 1,
    name: "Twin Fives",
    capacity: 3,
    tubes: [[5, 5], [], []],
  },
  {
    id: 2,
    name: "Sum to Ten",
    capacity: 3,
    tubes: [[3, 7], [], []],
  },
  {
    id: 3,
    name: "Three Pairs",
    capacity: 4,
    tubes: [[3, 5, 7], [5, 4, 6], [], []],
  },
  {
    id: 4,
    name: "Sorting House",
    capacity: 5,
    tubes: [[1, 9, 2, 8], [4, 6, 3, 7], [5, 5], [], []],
  },
  {
    id: 5,
    name: "Tangle",
    capacity: 5,
    tubes: [[2, 7, 5, 3], [8, 5, 7, 6], [1, 4, 9, 3], [], []],
  },
];
