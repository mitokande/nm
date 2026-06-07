// Shared design tokens — the single source of truth for the app's palette.
// Every screen imports `C` from here so future tweaks land in one place. Values
// were canonicalised from the per-file `const C` blocks; drift fixed:
//   - inkSoft: 0.48/0.52/0.55 → 0.55 (most usage)
//   - coralSoft: hex/rgba → hex (#fbe1d6)
//   - tealSoft: hex/rgba → hex (#d6ebe5)
//
// Garden.tsx intentionally uses a warmer brown ink palette tuned for the
// photograph backdrop; it owns its own small `C` for those overrides.

export const C = {
  // Surfaces
  bg: "#f5efe6",
  white: "#fbfaf6",
  paper: "#fdfbf6",

  // Text
  ink: "#1a1d2e",
  inkSoft: "rgba(26,29,46,0.55)",
  hairline: "rgba(26,29,46,0.08)",
  grid: "rgba(26,29,46,0.10)",
  scrim: "rgba(10,12,22,0.45)",

  // Neutrals
  ghost: "#cdc4b3",
  ghostDisc: "#e7e1d2",
  ghostInk: "rgba(26,29,46,0.45)",

  // Primary (coral)
  coral: "#ec7458",
  coralSoft: "#fbe1d6",
  primary: "#ec7458",
  primary2: "#d45c3a",
  primaryShadow: "#8f2c10",

  // Teal
  teal: "#3e9d8f",
  tealSoft: "#d6ebe5",

  // Status
  danger: "#d45c5c",
  good: "#5baa7a",

  // Accents
  crown: "#d9a648",
  crownSoft: "#f9eedb",
  golden: "#d9a648",
  heart: "#e35d6a",
  heartSoft: "rgba(227,93,106,0.14)",
  freeze: "#3a9fdf",
  freezeBg: "#cce8f5",
  freezeBorder: "#5aabdd",

  // Gameplay
  select: "#f4c64a",
  selectShadow: "#d4960e",
  hint: "#fde5a8",

  // Mailbox
  unreadDot: "#ec7458",
} as const;
