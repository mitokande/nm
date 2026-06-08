// Number Sort — prototype branch (Reframe A from the sort-puzzle reframe set).
// Self-contained: tubes hold stacks of 1-9 numbers; tap to pick up a tube, tap
// another to pour its top. Pours land on empty tubes (move) or pair with the
// target top when both are equal OR sum to 10 (pair-and-vanish). Stage clears
// when every tube is empty.

import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { C } from "./tokens";
import { playSound } from "./sound";
import { NS_LEVELS, NSLevel } from "./numberSortLevels";

type MatchColor = "purple" | "green" | "yellow";

const VALUE_COLOR: Record<number, MatchColor> = {
  1: "purple", 2: "green", 3: "yellow", 4: "green", 5: "purple",
  6: "green", 7: "yellow", 8: "green", 9: "purple",
};
const COLOR_BG: Record<MatchColor, string> = {
  purple: "#a76be8", green: "#8ed42e", yellow: "#ffc51c",
};
const COLOR_BORDER: Record<MatchColor, string> = {
  purple: "#7d3cc9", green: "#5ea41f", yellow: "#f29a00",
};

interface Props {
  onBack: () => void;
}

export default function NumberSortScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [levelIdx, setLevelIdx] = useState(0);
  const level = NS_LEVELS[levelIdx];

  const [tubes, setTubes] = useState<number[][]>(() => level.tubes.map((t) => [...t]));
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [flashTube, setFlashTube] = useState<{ idx: number; kind: "ok" | "bad" } | null>(null);

  const won = tubes.every((t) => t.length === 0);

  useEffect(() => {
    setTubes(level.tubes.map((t) => [...t]));
    setSelected(null);
    setMoves(0);
    setFlashTube(null);
  }, [levelIdx]);

  useEffect(() => {
    if (!won) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playSound("stage_win", 0.8);
  }, [won]);

  function reset() {
    setTubes(level.tubes.map((t) => [...t]));
    setSelected(null);
    setMoves(0);
  }

  function nextLevel() {
    if (levelIdx + 1 < NS_LEVELS.length) setLevelIdx(levelIdx + 1);
    else onBack();
  }

  function flash(idx: number, kind: "ok" | "bad") {
    setFlashTube({ idx, kind });
    setTimeout(() => setFlashTube(null), 220);
  }

  function tap(idx: number) {
    if (won) return;
    if (selected === null) {
      if (tubes[idx].length === 0) return;
      setSelected(idx);
      Haptics.selectionAsync();
      return;
    }
    if (selected === idx) {
      setSelected(null);
      return;
    }
    const src = tubes[selected];
    const dst = tubes[idx];
    if (src.length === 0) { setSelected(null); return; }
    const top = src[src.length - 1];

    if (dst.length === 0) {
      // Move to empty.
      if (dst.length >= level.capacity) { flash(idx, "bad"); return; }
      const next = tubes.map((t, i) => {
        if (i === selected) return t.slice(0, -1);
        if (i === idx) return [...t, top];
        return t;
      });
      setTubes(next);
      setMoves((m) => m + 1);
      setSelected(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      playSound("match", 0.4);
      return;
    }

    const dstTop = dst[dst.length - 1];
    const isMatch = top === dstTop || top + dstTop === 10;
    if (isMatch) {
      const next = tubes.map((t, i) => {
        if (i === selected || i === idx) return t.slice(0, -1);
        return t;
      });
      setTubes(next);
      setMoves((m) => m + 1);
      setSelected(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      playSound("match", 0.75);
      flash(idx, "ok");
      return;
    }

    // Invalid.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    playSound("error", 0.5);
    flash(idx, "bad");
    setSelected(null);
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.iconBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to menu">
          <Text style={s.iconText}>‹</Text>
        </TouchableOpacity>
        <View style={s.titleBlock}>
          <Text style={s.titleSmall}>SORT LAB · PROTOTYPE</Text>
          <Text style={s.title}>L{level.id} · {level.name}</Text>
        </View>
        <TouchableOpacity onPress={reset} style={s.iconBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel="Reset level">
          <Text style={s.iconText}>↻</Text>
        </TouchableOpacity>
      </View>

      <View style={s.statsRow}>
        <View style={s.stat}><Text style={s.statLabel}>MOVES</Text><Text style={s.statValue}>{moves}</Text></View>
        <View style={s.stat}><Text style={s.statLabel}>LEVEL</Text><Text style={s.statValue}>{levelIdx + 1}/{NS_LEVELS.length}</Text></View>
        <View style={s.stat}><Text style={s.statLabel}>LEFT</Text><Text style={s.statValue}>{tubes.reduce((a, t) => a + t.length, 0)}</Text></View>
      </View>

      <View style={s.boardArea}>
        <View style={s.tubeRow}>
          {tubes.map((tube, idx) => (
            <Tube
              key={idx}
              tube={tube}
              capacity={level.capacity}
              selected={selected === idx}
              flash={flashTube?.idx === idx ? flashTube.kind : null}
              onPress={() => tap(idx)}
            />
          ))}
        </View>
      </View>

      <View style={s.howto}>
        <Text style={s.howtoText}>
          Tap a tube to pick it up. Tap another to pour its top.{"\n"}
          Numbers vanish when they <Text style={s.em}>match</Text> or <Text style={s.em}>sum to 10</Text>.
        </Text>
      </View>

      {won && (
        <View style={s.winOverlay} pointerEvents="auto">
          <View style={s.winCard}>
            <Text style={s.winEmoji}>★</Text>
            <Text style={s.winTitle}>Solved in {moves}</Text>
            <Text style={s.winSub}>Level {level.id} — {level.name}</Text>
            <View style={s.winRow}>
              <TouchableOpacity style={s.secondaryBtn} onPress={reset} activeOpacity={0.85}>
                <Text style={s.secondaryBtnText}>Replay</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.primaryBtn} onPress={nextLevel} activeOpacity={0.85}>
                <Text style={s.primaryBtnText}>{levelIdx + 1 < NS_LEVELS.length ? "Next →" : "Done"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function Tube({ tube, capacity, selected, flash, onPress }: {
  tube: number[];
  capacity: number;
  selected: boolean;
  flash: "ok" | "bad" | null;
  onPress: () => void;
}) {
  const emptyCount = capacity - tube.length;
  const liftAnim = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(liftAnim, { toValue: selected ? -12 : 0, friction: 6, tension: 200, useNativeDriver: true }).start();
  }, [selected]);

  useEffect(() => {
    if (!flash) return;
    flashAnim.setValue(1);
    Animated.timing(flashAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
  }, [flash]);

  const flashBg = flash === "ok" ? "#e6f7ee" : flash === "bad" ? "#fde6e6" : C.white;
  const cellH = 38;
  const cellGap = 2;
  const tubeH = capacity * cellH + (capacity - 1) * cellGap + 12;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <Animated.View
        style={[
          s.tube,
          selected && s.tubeSelected,
          { height: tubeH, backgroundColor: flashAnim.interpolate({ inputRange: [0, 1], outputRange: [C.white, flashBg] }), transform: [{ translateY: liftAnim }] },
        ]}
      >
        {Array.from({ length: capacity }).map((_, visualRow) => {
          if (visualRow < emptyCount) {
            return <View key={visualRow} style={[s.cell, { height: cellH, marginBottom: visualRow === capacity - 1 ? 0 : cellGap }]} />;
          }
          const value = tube[capacity - 1 - visualRow];
          const color = VALUE_COLOR[value];
          const isTop = visualRow === emptyCount;
          return (
            <View
              key={visualRow}
              style={[
                s.cell,
                {
                  height: cellH,
                  marginBottom: visualRow === capacity - 1 ? 0 : cellGap,
                  backgroundColor: COLOR_BG[color],
                  borderColor: COLOR_BORDER[color],
                },
                isTop && s.cellTop,
              ]}
            >
              <Text style={s.cellText}>{value}</Text>
            </View>
          );
        })}
      </Animated.View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 18 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleBlock: { alignItems: "center" },
  titleSmall: { color: C.inkSoft, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: C.ink, fontWeight: "900", fontSize: 16, letterSpacing: 0.3 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: C.paper, borderWidth: 1, borderColor: C.hairline },
  iconText: { color: C.ink, fontWeight: "900", fontSize: 18 },

  statsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  stat: { flex: 1, backgroundColor: C.paper, borderRadius: 12, padding: 8, borderWidth: 1, borderColor: C.hairline, alignItems: "center" },
  statLabel: { fontSize: 10, fontWeight: "800", color: C.inkSoft, letterSpacing: 0.8 },
  statValue: { fontSize: 18, fontWeight: "900", color: C.ink },

  boardArea: { flex: 1, justifyContent: "center" },
  tubeRow: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", gap: 8 },
  tube: {
    width: 50,
    borderWidth: 1.5,
    borderColor: C.hairline,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 4,
    flexDirection: "column",
    justifyContent: "flex-start",
  },
  tubeSelected: { borderColor: C.primary, borderWidth: 2.5 },

  cell: { borderRadius: 6, borderWidth: 1.2, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  cellTop: { shadowColor: "rgba(26,29,46,0.55)", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 4, elevation: 3 },
  cellText: { color: "#fff", fontWeight: "900", fontSize: 16, textShadowColor: "rgba(0,0,0,0.28)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },

  howto: { padding: 12, backgroundColor: C.paper, borderRadius: 12, borderWidth: 1, borderColor: C.hairline },
  howtoText: { color: C.inkSoft, fontSize: 12, textAlign: "center", lineHeight: 18 },
  em: { color: C.coral, fontWeight: "800" },

  winOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.scrim, alignItems: "center", justifyContent: "center", padding: 24 },
  winCard: { backgroundColor: C.paper, padding: 26, borderRadius: 18, alignItems: "center", minWidth: 260, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 },
  winEmoji: { fontSize: 44, color: C.crown },
  winTitle: { color: C.ink, fontWeight: "900", fontSize: 22, marginTop: 6 },
  winSub: { color: C.inkSoft, fontSize: 13, marginTop: 4 },
  winRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  primaryBtn: { backgroundColor: C.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, minWidth: 100, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "900" },
  secondaryBtn: { backgroundColor: C.ghostDisc, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, minWidth: 100, alignItems: "center" },
  secondaryBtnText: { color: C.ink, fontWeight: "900" },
});
