import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, StatusBar, Platform, Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GameMode } from "../App";
import { GOLDEN_STAGES } from "./goldenStages";

const { width: SW } = Dimensions.get("window");
const PCELL = Math.floor((SW - 44) / 9);

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: "#f5efe6",
  white: "#fbfaf6",
  ink: "#1a1d2e",
  inkSoft: "rgba(26,29,46,0.48)",
  ghost: "#cdc4b3",
  coral: "#ec7458",
  coralSoft: "#fbe1d6",
  teal: "#3e9d8f",
  tealSoft: "#d6ebe5",
  danger: "#d45c5c",
  crown: "#d9a648",
  freeze: "#3a9fdf",
};

// ─── Preview board data ───────────────────────────────────────────────────────

const PREVIEW_GRID = [
  [3, 7, 3, 2, 1, 5, 4, 8, 9],
  [5, 2, 8, 9, 1, 6, 4, 3, 7],
  [1, 9, 1, 6, 4, 3, 7, 2, 5],
  [4, 5, 5, 7, 3, 2, 8, 1, 9],
];

// Each pair is valid: same number or sum = 10, adjacent cells
const PREVIEW_PAIRS: Array<{ cells: [number, number][]; type: "coral" | "teal" }> = [
  { cells: [[0, 1], [0, 2]], type: "teal" },   // 7+3=10
  { cells: [[3, 1], [3, 2]], type: "coral" },  // 5+5 same
  { cells: [[1, 3], [1, 4]], type: "teal" },   // 9+1=10
  { cells: [[0, 4], [1, 4]], type: "coral" },  // 1+1 same (vertical)
  { cells: [[2, 1], [2, 2]], type: "teal" },   // 9+1=10
];

// ─── PreviewBoard ─────────────────────────────────────────────────────────────

function PreviewBoard() {
  const [pairIdx, setPairIdx] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const lineScaleX = useRef(new Animated.Value(0)).current;
  const lineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let idx = 0;
    const step = () => {
      // Spring-pop the highlighted pair
      pulseAnim.setValue(1.10);
      Animated.spring(pulseAnim, { toValue: 1, friction: 3.5, tension: 280, useNativeDriver: true }).start();

      // Draw match line, then fade it
      lineScaleX.setValue(0);
      lineOpacity.setValue(0);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(lineScaleX, { toValue: 1, duration: 90, useNativeDriver: true }),
          Animated.timing(lineOpacity, { toValue: 1, duration: 90, useNativeDriver: true }),
        ]),
        Animated.delay(800),
        Animated.timing(lineOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    };

    step(); // run on first mount
    const timer = setInterval(() => {
      idx = (idx + 1) % PREVIEW_PAIRS.length;
      setPairIdx(idx);
      step();
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  const pair = PREVIEW_PAIRS[pairIdx];
  const hlSet = new Set(pair.cells.map(([r, c]) => `${r}-${c}`));
  const hlColor = pair.type === "coral" ? C.coral : C.teal;
  const hlBg = pair.type === "coral" ? C.coralSoft : C.tealSoft;

  // Line geometry between the two highlighted cells
  const [r1, c1] = pair.cells[0];
  const [r2, c2] = pair.cells[1];
  const x1 = c1 * PCELL + PCELL / 2;
  const y1 = r1 * PCELL + PCELL / 2;
  const x2 = c2 * PCELL + PCELL / 2;
  const y2 = r2 * PCELL + PCELL / 2;
  const dx = x2 - x1; const dy = y2 - y1;
  const lineLen = Math.sqrt(dx * dx + dy * dy);
  const lineAngle = Math.atan2(dy, dx);

  return (
    <View style={pb.board}>
      {PREVIEW_GRID.map((row, ri) => (
        <View key={ri} style={pb.row}>
          {row.map((n, ci) => {
            const isHl = hlSet.has(`${ri}-${ci}`);
            return (
              <Animated.View
                key={ci}
                style={[
                  pb.cell,
                  isHl && { backgroundColor: hlBg, borderColor: hlColor },
                  isHl && { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <Text style={[pb.num, isHl && { color: hlColor, fontWeight: "800" }]}>
                  {n}
                </Text>
              </Animated.View>
            );
          })}
        </View>
      ))}
      {/* Match line */}
      <Animated.View
        pointerEvents="none"
        style={[
          pb.line,
          {
            backgroundColor: hlColor,
            shadowColor: hlColor,
            left: (x1 + x2) / 2 - lineLen / 2,
            top: (y1 + y2) / 2 - 2,
            width: lineLen,
            transform: [{ rotate: `${lineAngle}rad` }, { scaleX: lineScaleX }],
            opacity: lineOpacity,
          },
        ]}
      />
    </View>
  );
}

const pb = StyleSheet.create({
  board: {
    position: "relative",
    alignSelf: "center",
    backgroundColor: C.white,
    borderRadius: 18,
    padding: PCELL * 0.15,
    borderWidth: 1,
    borderColor: "rgba(26,29,46,0.08)",
    shadowColor: "rgba(26,29,46,1)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 5,
  },
  row: { flexDirection: "row" },
  cell: {
    width: PCELL,
    height: PCELL,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(26,29,46,0.07)",
    borderRadius: 5,
  },
  num: {
    fontSize: PCELL > 34 ? 16 : 13,
    fontWeight: "600",
    color: C.ink,
  },
  line: {
    position: "absolute",
    height: 3,
    borderRadius: 2,
    zIndex: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 5,
    elevation: 5,
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  crowns: number;
  onPlay: (stage: number, mode: GameMode) => void;
  onResetTutorial?: () => void;
}

export default function MainMenu({ crowns, onPlay, onResetTutorial }: Props) {
  const [goldenDone, setGoldenDone] = useState<Record<number, boolean>>({});
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [taBest, setTaBest] = useState<number | null>(null);
  const [endlessStage, setEndlessStage] = useState(1);
  const [freezeStage, setFreezeStage] = useState(1);
  const crownBump = useRef(new Animated.Value(1)).current;
  const isFirstCrownRef = useRef(true);

  useEffect(() => {
    Promise.all([
      Promise.all(
        GOLDEN_STAGES.map((s) =>
          AsyncStorage.getItem(`golden_done_${s.id}`).then((v) => [s.id, v === "1"] as const)
        )
      ),
      AsyncStorage.getItem("hiscore_timeattack"),
      AsyncStorage.getItem("endless_stage"),
      AsyncStorage.getItem("freeze_stage"),
    ]).then(([goldenEntries, taVal, endlessVal, freezeVal]) => {
      const map: Record<number, boolean> = {};
      for (const [id, done] of goldenEntries) map[id] = done;
      setGoldenDone(map);
      setTaBest(taVal !== null ? parseInt(taVal, 10) : 0);
      if (endlessVal) setEndlessStage(parseInt(endlessVal, 10));
      if (freezeVal) setFreezeStage(parseInt(freezeVal, 10));
      setProgressLoaded(true);
    }).catch(() => setProgressLoaded(true));
  }, []);

  const { goldenTargetId, goldenAllDone } = useMemo(() => {
    const firstIncomplete = GOLDEN_STAGES.find((s) => !goldenDone[s.id]);
    return {
      goldenTargetId: firstIncomplete?.id ?? GOLDEN_STAGES[0]?.id ?? 1,
      goldenAllDone: GOLDEN_STAGES.length > 0 && !firstIncomplete,
    };
  }, [goldenDone]);

  const goldenCompletedCount = useMemo(
    () => GOLDEN_STAGES.filter((s) => goldenDone[s.id]).length,
    [goldenDone]
  );

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 11, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (isFirstCrownRef.current) { isFirstCrownRef.current = false; return; }
    crownBump.setValue(1.7);
    Animated.spring(crownBump, { toValue: 1, friction: 3, tension: 350, useNativeDriver: true }).start();
  }, [crowns]);

  function devResetFirstLaunch() {
    onResetTutorial?.();
  }

  const goldenSub = !progressLoaded
    ? "Loading…"
    : goldenAllDone
    ? "All levels cleared"
    : goldenCompletedCount > 0
    ? `Level ${goldenTargetId} of ${GOLDEN_STAGES.length}  ·  ${goldenCompletedCount} cleared`
    : `${GOLDEN_STAGES.length} levels to explore`;

  return (
    <View style={ms.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Crown badge — fixed top right */}
      <View style={ms.topBar}>
        <Text style={ms.crownEmoji}>♛</Text>
        <Animated.Text style={[ms.crownCount, { transform: [{ scale: crownBump }] }]}>{crowns}</Animated.Text>
      </View>

      {/* DEV — reset first-launch onboarding (dev builds only) */}
      {__DEV__ && (
        <TouchableOpacity style={ms.devBtn} onPress={devResetFirstLaunch} activeOpacity={0.7}>
          <Text style={ms.devBtnText}>↺ onboard</Text>
        </TouchableOpacity>
      )}

      <Animated.View
        style={[ms.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        {/* Live game preview */}
        <PreviewBoard />

        {/* Title */}
        <View style={ms.titleBlock}>
          <Text style={ms.title}>
            Number Match<Text style={ms.titleDot}>.</Text>
          </Text>
          <Text style={ms.titleSub}>match identical numbers or pairs that sum to 10</Text>
        </View>

        {/* Primary CTA */}
        <TouchableOpacity
          style={ms.playBtn}
          onPress={() => onPlay(endlessStage, "endless")}
          activeOpacity={0.82}
        >
          <View style={{ alignItems: "flex-start" }}>
            <Text style={ms.playBtnText}>{endlessStage > 1 ? "Continue" : "Play"}</Text>
            {endlessStage > 1 && (
              <Text style={ms.playBtnSub}>Endless · Stage {endlessStage} of 6</Text>
            )}
          </View>
          <Text style={ms.playBtnArrow}>→</Text>
        </TouchableOpacity>

        {/* Mode chips */}
        <View style={ms.chips}>
          <ModeChip
            emoji="⏱"
            label="Time Attack"
            accent={C.danger}
            sub={taBest && taBest > 0 ? `Best: ${taBest} pts` : "60 sec"}
            onPress={() => onPlay(1, "timeattack")}
          />
          <ModeChip
            emoji="💎"
            label="Golden Garden"
            accent={C.crown}
            sub={goldenSub}
            onPress={() => onPlay(goldenTargetId, "golden")}
            disabled={!progressLoaded}
          />
          <ModeChip
            emoji="❄️"
            label="Freeze"
            accent={C.freeze}
            sub={freezeStage > 1 ? `Stage ${freezeStage} of 6` : "Thaw to win"}
            onPress={() => onPlay(freezeStage, "freeze")}
          />
        </View>

        {/* Daily locked */}
        <View style={ms.dailyRow}>
          <Text style={ms.dailyEmoji}>📅</Text>
          <Text style={ms.dailyLabel}>Daily Challenge</Text>
          <Text style={ms.dailyComingSoon}>coming soon  🔒</Text>
        </View>
      </Animated.View>

    </View>
  );
}

// ─── ModeChip ─────────────────────────────────────────────────────────────────

function ModeChip({
  emoji, label, accent, sub, onPress, disabled,
}: {
  emoji: string;
  label: string;
  accent: string;
  sub: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={ms.chip}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <View style={[ms.chipAccentBar, { backgroundColor: accent }]} />
      <Text style={ms.chipEmoji}>{emoji}</Text>
      <Text style={ms.chipLabel}>{label}</Text>
      <Text style={ms.chipSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ms = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  topBar: {
    position: "absolute",
    top: Platform.OS === "android" ? 36 : 52,
    right: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    zIndex: 10,
  },
  crownEmoji: { fontSize: 13, color: C.crown },
  crownCount: { fontSize: 14, fontWeight: "700", color: C.ink },

  content: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? 80 : 96,
    paddingHorizontal: 22,
    paddingBottom: 36,
    gap: 20,
  },

  titleBlock: { alignItems: "flex-start", gap: 5 },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: C.ink,
    letterSpacing: -1,
    lineHeight: 38,
  },
  titleDot: { color: C.coral },
  titleSub: {
    fontSize: 13,
    color: C.inkSoft,
    fontWeight: "500",
    lineHeight: 18,
  },

  playBtn: {
    backgroundColor: C.coral,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: C.coral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.40,
    shadowRadius: 16,
    elevation: 8,
  },
  playBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 20,
    letterSpacing: 0.5,
  },
  playBtnArrow: {
    color: "rgba(255,255,255,0.75)",
    fontWeight: "400",
    fontSize: 22,
  },
  playBtnSub: {
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
    fontSize: 12,
    marginTop: 2,
  },

  chips: { flexDirection: "row", gap: 10 },
  chip: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 16,
    paddingTop: 0,
    paddingBottom: 14,
    paddingHorizontal: 12,
    alignItems: "flex-start",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(26,29,46,0.08)",
    shadowColor: "rgba(26,29,46,1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    gap: 4,
  },
  chipAccentBar: {
    alignSelf: "stretch",
    height: 3,
    borderRadius: 0,
    marginBottom: 10,
  },
  chipEmoji: { fontSize: 22 },
  chipLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.2,
  },
  chipSub: {
    fontSize: 10,
    color: C.inkSoft,
    lineHeight: 14,
  },

  dailyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    opacity: 0.40,
    paddingHorizontal: 4,
  },
  dailyEmoji: { fontSize: 16 },
  dailyLabel: { fontSize: 14, fontWeight: "700", color: C.ink, flex: 1 },
  dailyComingSoon: { fontSize: 12, color: C.inkSoft },

  devBtn: {
    position: "absolute",
    top: Platform.OS === "android" ? 36 : 52,
    left: 16,
    backgroundColor: "rgba(26,29,46,0.08)",
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 9,
    zIndex: 10,
  },
  devBtnText: { fontSize: 11, fontWeight: "600", color: C.inkSoft },

});
