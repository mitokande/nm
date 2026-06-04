import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { GameMode } from "../App";

const C = {
  white: "#fbfaf6",
  ink: "#1a1d2e",
  inkSoft: "rgba(26,29,46,0.55)",
  hairline: "rgba(26,29,46,0.08)",
  ghost: "#cdc4b3",
  golden: "#d9a648",
  goldenSoft: "rgba(217,166,72,0.18)",
  time: "#ec7458",
  timeSoft: "rgba(236,116,88,0.16)",
  freeze: "#3a9fdf",
  freezeSoft: "rgba(58,159,223,0.16)",
};

interface ModeMeta {
  mode: Exclude<GameMode, "endless" | "tutorial">;
  label: string;
  icon: string;
  caption: string;
  tint: string;
  tintSoft: string;
}

const MODES: ModeMeta[] = [
  { mode: "golden",     label: "Golden",  icon: "💎", caption: "Collect gems",   tint: C.golden, tintSoft: C.goldenSoft },
  { mode: "timeattack", label: "Time",    icon: "⚡", caption: "Beat the clock", tint: C.time,   tintSoft: C.timeSoft },
  { mode: "freeze",     label: "Freeze",  icon: "🧊", caption: "Thaw the board", tint: C.freeze, tintSoft: C.freezeSoft },
];

interface Props {
  goldenStage: number;
  freezeStage: number;
  disabled: boolean;
  onPlay: (stage: number, mode: GameMode) => void;
}

export default function ModeTiles({ goldenStage, freezeStage, disabled, onPlay }: Props) {
  function stageFor(mode: ModeMeta["mode"]): number {
    if (mode === "golden") return goldenStage;
    if (mode === "freeze") return freezeStage;
    return 1; // timeattack has no stage progression
  }

  function captionFor(mode: ModeMeta["mode"]): string {
    if (mode === "golden") return `Stage ${goldenStage}`;
    if (mode === "freeze") return `Stage ${freezeStage}`;
    return "60s rush";
  }

  return (
    <View style={s.row}>
      {MODES.map((m) => (
        <TouchableOpacity
          key={m.mode}
          style={[s.tile, disabled && s.tileDisabled]}
          activeOpacity={disabled ? 1 : 0.82}
          onPress={() => { if (!disabled) onPlay(stageFor(m.mode), m.mode); }}
        >
          <View style={[s.iconWrap, { backgroundColor: disabled ? "rgba(26,29,46,0.06)" : m.tintSoft }]}>
            <Text style={s.icon}>{m.icon}</Text>
          </View>
          <Text style={[s.label, disabled && s.labelDisabled]}>{m.label}</Text>
          <Text style={s.caption}>{captionFor(m.mode)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
  },
  tile: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.hairline,
    shadowColor: "rgba(26,29,46,1)",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  tileDisabled: {
    opacity: 0.55,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },
  icon: { fontSize: 18 },
  label: { fontSize: 13, fontWeight: "900", color: C.ink, letterSpacing: 0.2 },
  labelDisabled: { color: C.inkSoft },
  caption: { fontSize: 10, color: C.inkSoft, marginTop: 1, fontWeight: "600" },
});
