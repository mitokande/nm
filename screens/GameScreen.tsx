import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Easing, Dimensions, StatusBar, Modal, Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { playSound } from "./sound";
import { GEM_EMOJI, GEM_NAME, GemType, GoldenStage } from "./goldenStages";
import { TUTORIAL_STAGES } from "./tutorialStages";
import type { GameMode } from "../App";
import Constants from "expo-constants";
import levelsJson from "./levels.json";

// ─── Constants ────────────────────────────────────────────────────────────────

const COLS = 9;

interface FreezeStage { id: number; values: number[]; frozenIndices: number[]; }

const STAGES: Record<number, number[]> = Object.fromEntries(
  levelsJson.endless.map((s) => [s.id, s.values])
);

const FREEZE_STAGES: FreezeStage[] = levelsJson.freeze;

const GOLDEN_STAGES: GoldenStage[] = levelsJson.golden.map((g) => ({
  id: g.id,
  name: g.name,
  values: g.values,
  gems: Object.fromEntries(Object.entries(g.gems).map(([k, v]) => [Number(k), v as GemType])),
  targets: g.targets as Partial<Record<GemType, number>>,
}));

// ─── Types ────────────────────────────────────────────────────────────────────

interface Cell {
  id: number;
  value: number;
  active: boolean;
  gem?: GemType;
  frozen?: boolean;
}

interface FloatItem {
  id: number;
  idx: number;
  value: number;
  color: string;
  sx: number; // start screen X
  sy: number; // start screen Y
}

interface Props {
  initialStage: number;
  mode: GameMode;
  crowns: number;
  onCrownsEarned: (amount: number) => void;
  onBack: () => void;
  onTutorialComplete?: () => void;
}

// ─── Pure Logic ───────────────────────────────────────────────────────────────

function visibleRow(rOrig: number, destroyedRows: number[]): number {
  if (destroyedRows.includes(rOrig)) return -1;
  let visible = 0;
  for (let r = 0; r < rOrig; r++) {
    if (!destroyedRows.includes(r)) visible++;
  }
  return visible;
}

function originalRow(rVis: number, destroyedRows: number[], totalRows: number): number {
  let visible = 0;
  for (let r = 0; r < totalRows; r++) {
    if (destroyedRows.includes(r)) continue;
    if (visible === rVis) return r;
    visible++;
  }
  return -1;
}

function pathClearVisible(
  cells: Cell[], r1Vis: number, c1: number, r2Vis: number, c2: number, destroyedRows: number[]
): boolean {
  const totalRows = Math.ceil(cells.length / COLS);
  const dr = Math.sign(r2Vis - r1Vis);
  const dc = Math.sign(c2 - c1);
  let rVis = r1Vis + dr;
  let c = c1 + dc;
  while (!(rVis === r2Vis && c === c2)) {
    const rOrig = originalRow(rVis, destroyedRows, totalRows);
    if (rOrig === -1) return false;
    const idx = rOrig * COLS + c;
    if (cells[idx]?.active) return false;
    rVis += dr;
    c += dc;
  }
  return true;
}

function isValidPair(cells: Cell[], i: number, j: number, destroyedRows: number[] = []): boolean {
  if (i === j) return false;
  const a = cells[i];
  const b = cells[j];
  if (!a?.active || !b?.active) return false;
  if (a.frozen || b.frozen) return false;
  if (a.value !== b.value && a.value + b.value !== 10) return false;

  const [lo, hi] = i < j ? [i, j] : [j, i];

  let cursor = lo + 1;
  while (cursor < cells.length && !cells[cursor].active) cursor++;
  if (cursor === hi) return true;

  const r1 = visibleRow(Math.floor(lo / COLS), destroyedRows);
  const r2 = visibleRow(Math.floor(hi / COLS), destroyedRows);
  if (r1 === -1 || r2 === -1) return false;
  const c1 = lo % COLS;
  const c2 = hi % COLS;

  if (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1) {
    return pathClearVisible(cells, r1, c1, r2, c2, destroyedRows);
  }
  if (r1 === r2 || c1 === c2 || Math.abs(r1 - r2) === Math.abs(c1 - c2)) {
    return pathClearVisible(cells, r1, c1, r2, c2, destroyedRows);
  }
  return false;
}

function findHint(cells: Cell[], destroyedRows: number[] = []): [number, number] | null {
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i].active) continue;
    for (let j = i + 1; j < cells.length; j++) {
      if (!cells[j].active) continue;
      if (isValidPair(cells, i, j, destroyedRows)) return [i, j];
    }
  }
  return null;
}

function buildCells(values: number[], gems?: Record<number, GemType>): Cell[] {
  return values.map((v, i) => ({ id: i, value: v, active: true, gem: gems?.[i] }));
}

function getGoldenStage(stage: number): GoldenStage | undefined {
  return GOLDEN_STAGES.find((s) => s.id === stage);
}

function buildCellsForMode(stage: number, mode: GameMode): Cell[] {
  if (mode === "golden") {
    const g = getGoldenStage(stage) ?? GOLDEN_STAGES[0];
    return buildCells(g.values, g.gems);
  }
  if (mode === "freeze") {
    const f = FREEZE_STAGES.find((s) => s.id === stage) ?? FREEZE_STAGES[0];
    return buildCells(f.values).map((c, i) =>
      f.frozenIndices.includes(i) ? { ...c, frozen: true } : c
    );
  }
  if (mode === "tutorial") {
    const t = TUTORIAL_STAGES.find((s) => s.id === stage) ?? TUTORIAL_STAGES[0];
    return buildCells(t.values);
  }
  return buildCells(STAGES[stage] ?? STAGES[1]);
}

// ─── FlyingScore ─────────────────────────────────────────────────────────────

function FlyingScore({ value, color, sx, sy, tx, ty, onDone }: {
  value: number; color: string;
  sx: number; sy: number;
  tx: number; ty: number;
  onDone: () => void;
}) {
  const translateX = useRef(new Animated.Value(sx - 15)).current;
  const translateY = useRef(new Animated.Value(sy - 10)).current;
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1.3, friction: 4, tension: 300, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(translateX, { toValue: tx - 15, duration: 550, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: ty, duration: 550, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.4, duration: 550, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(350),
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]),
      ]),
    ]).start(onDone);
  }, []);

  return (
    <Animated.Text
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: [{ translateX }, { translateY }, { scale }],
        opacity,
        color,
        fontSize: 16,
        fontWeight: "900",
        zIndex: 999,
        textShadowColor: "rgba(0,0,0,0.15)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
      }}
    >
      +{value}
    </Animated.Text>
  );
}

// ─── CountUp ──────────────────────────────────────────────────────────────────

function CountUp({ to, visible, style, duration = 950 }: {
  to: number; visible: boolean; style?: any; duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const bump = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) { setDisplay(0); return; }
    let raf: number;
    const start = Date.now();
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(to * eased));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
        bump.setValue(1.25);
        Animated.spring(bump, { toValue: 1, friction: 4, tension: 300, useNativeDriver: true }).start();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, to]);

  return <Animated.Text style={[style, { transform: [{ scale: bump }] }]}>{display}</Animated.Text>;
}

// ─── Component ────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get("window");
const BOARD_H_PAD = 8;
const CELL_SIZE = Math.floor((SCREEN_W - BOARD_H_PAD * 2 - 24) / COLS);

export default function GameScreen({ initialStage, mode, crowns, onCrownsEarned, onBack, onTutorialComplete }: Props) {
  const [stage, setStage] = useState(initialStage);
  const [cells, setCells] = useState<Cell[]>(() => buildCellsForMode(initialStage, mode));
  const initialTargets = mode === "golden" ? (getGoldenStage(initialStage)?.targets ?? {}) : {};
  const [targets, setTargets] = useState<Partial<Record<GemType, number>>>(initialTargets);
  const [collected, setCollected] = useState<Partial<Record<GemType, number>>>({});
  const wonRef = useRef(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [adds, setAdds] = useState(5);
  const [hints, setHints] = useState(2);
  const [adLoaded, setAdLoaded] = useState(false);
  const [hintPair, setHintPair] = useState<[number, number] | null>(() => {
    if (mode === "tutorial") {
      const t = TUTORIAL_STAGES.find((s) => s.id === initialStage) ?? TUTORIAL_STAGES[0];
      const s0 = t.steps[0];
      return s0.action === "match" ? s0.pair : null;
    }
    return null;
  });
  const [tutStep, setTutStep] = useState(0);
  const [combo, setCombo] = useState(0);
  const [shakingCell, setShakingCell] = useState<number | null>(null);
  const [poppingPair, setPoppingPair] = useState<[number, number] | null>(null);
  const [floatingScores, setFloatingScores] = useState<FloatItem[]>([]);
  const [toast, setToast] = useState<{ text: string; kind: "info" | "warn" | "win" } | null>(null);
  const [paused, setPaused] = useState(false);
  const [stageComplete, setStageComplete] = useState(false);
  const [destroyedRows, setDestroyedRows] = useState<number[]>([]);
  const [clearingRows, setClearingRows] = useState<number[]>([]);
  const [bestScore, setBestScore] = useState(0);
  const [noMoves, setNoMoves] = useState(false);
  const [matchLine, setMatchLine] = useState<[number, number] | null>(null);
  const [matchIsSame, setMatchIsSame] = useState(true);
  const [thawingCells, setThawingCells] = useState<number[]>([]);
  const [winNewBestReady, setWinNewBestReady] = useState(false);

  const TIMEATTACK_START = 60;
  const [timeLeft, setTimeLeft] = useState(mode === "timeattack" ? TIMEATTACK_START : 0);
  const [timeUp, setTimeUp] = useState(false);

  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const floatIdRef = useRef(0);

  // Animation values
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const selectBounce = useRef(new Animated.Value(1)).current;
  const popScale = useRef(new Animated.Value(1)).current;
  const hintPulse = useRef(new Animated.Value(1)).current;
  const hintAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const comboScaleAnim = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(16)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const scoreBump = useRef(new Animated.Value(1)).current;
  const clearFlash = useRef(new Animated.Value(1)).current;
  const boardShakeAnim = useRef(new Animated.Value(0)).current;
  const comboWobble = useRef(new Animated.Value(0)).current;
  const megaComboScale = useRef(new Animated.Value(0)).current;
  const megaComboOpacity = useRef(new Animated.Value(0)).current;
  const lineAnim = useRef(new Animated.Value(0)).current;
  const thawScale = useRef(new Animated.Value(1)).current;

  const scrollViewWrapRef = useRef<any>(null);
  const scrollViewTopRef = useRef(150);
  const scrollYRef = useRef(0);
  const scoreCardRef = useRef<View>(null);
  const scoreTargetRef = useRef({ x: SCREEN_W / 4, y: 80 });
  const rewardedAdRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    let admob: any;
    try {
      admob = require("react-native-google-mobile-ads");
    } catch (e) {
      console.log("[ads] native module not available (Expo Go?)", e);
      return;
    }

    // In Expo Go the require may silently succeed but the native binding is absent.
    // The TurboModuleRegistry Invariant Violation gets logged, then admob.default
    // is undefined. Bail out before we try to call it.
    if (!admob || typeof admob.default !== "function") {
      console.log("[ads] module loaded but native binding missing — skipping (Expo Go?)");
      return;
    }

    (async () => {
      try {
        await admob.default()
          .setRequestConfiguration({
            testDeviceIdentifiers: ["EMULATOR"],
          })
          .catch((e: any) => console.log("[ads] setRequestConfiguration failed", e));

        const initStatus = await admob.default().initialize();
        console.log("[ads] initialized", initStatus);
        if (cancelled) return;

        const adUnitId = __DEV__
          ? admob.TestIds.REWARDED
          : Platform.OS === "android"
            ? "ca-app-pub-4604843322018757/9772661819"
            : "ca-app-pub-4604843322018757/2967656297";
        console.log("[ads] creating rewarded ad", { adUnitId, platform: Platform.OS, dev: __DEV__ });

        const ad = admob.RewardedAd.createForAdRequest(adUnitId, {
          requestNonPersonalizedAdsOnly: true,
        });

        unsubs.push(ad.addAdEventListener(admob.RewardedAdEventType.LOADED, () => {
          console.log("[ads] LOADED");
          setAdLoaded(true);
        }));
        unsubs.push(ad.addAdEventListener(admob.AdEventType.ERROR, (err: any) => {
          console.log("[ads] ERROR", err?.code, err?.message, err);
          setAdLoaded(false);
        }));
        unsubs.push(ad.addAdEventListener(admob.AdEventType.OPENED, () => {
          console.log("[ads] OPENED");
        }));
        unsubs.push(ad.addAdEventListener(admob.AdEventType.CLOSED, () => {
          console.log("[ads] CLOSED → reloading");
          setAdLoaded(false);
          ad.load();
        }));
        unsubs.push(ad.addAdEventListener(
          admob.RewardedAdEventType.EARNED_REWARD,
          (reward: any) => {
            console.log("[ads] EARNED_REWARD", reward);
            performAddRow();
          },
        ));

        rewardedAdRef.current = ad;
        console.log("[ads] calling ad.load()");
        ad.load();
      } catch (e) {
        console.log("[ads] init/setup failed", e);
      }
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
      rewardedAdRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (mode !== "timeattack") return;
    if (paused || timeUp) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { setTimeUp(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [mode, paused, timeUp]);

  useEffect(() => {
    if (!timeUp) return;
    playSound("no_moves", 0.7);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (score > bestScore) {
      setBestScore(score);
      AsyncStorage.setItem("hiscore_timeattack", String(score));
    }
  }, [timeUp]);

  useEffect(() => {
    const key = mode === "timeattack" ? "hiscore_timeattack" : mode === "freeze" ? `hiscore_freeze_${stage}` : `hiscore_${stage}`;
    AsyncStorage.getItem(key).then((val) => {
      setBestScore(val !== null ? parseInt(val, 10) : 0);
    });
  }, [stage, mode]);

  useEffect(() => {
    if (!stageComplete && !timeUp) { setWinNewBestReady(false); return; }
    const t = setTimeout(() => setWinNewBestReady(true), 1050);
    return () => clearTimeout(t);
  }, [stageComplete, timeUp]);

  // Shake on invalid tap
  useEffect(() => {
    if (shakingCell !== null) {
      shakeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: -6, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
      ]).start(() => setShakingCell(null));
    }
  }, [shakingCell]);

  // Reset selectBounce when nothing is selected. The actual spring on first selection
  // is triggered inline in handleTap so it doesn't fire on cell-to-cell switches
  // (e.g. invalid-pair transitions), which would leave the new cell mid-oscillation
  // when its node mounts after the shake.
  useEffect(() => {
    if (selected === null) {
      selectBounce.stopAnimation();
      selectBounce.setValue(1);
    }
  }, [selected]);

  // Scale pop → shrink on match
  useEffect(() => {
    if (poppingPair !== null) {
      popScale.setValue(1);
      Animated.sequence([
        Animated.timing(popScale, { toValue: 1.3, duration: 70, useNativeDriver: true }),
        Animated.timing(popScale, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    } else {
      popScale.setValue(1);
    }
  }, [poppingPair]);

  // Pulsing scale loop on hint cells
  useEffect(() => {
    if (hintPair) {
      hintPulse.setValue(1);
      hintAnimRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(hintPulse, { toValue: 1.12, duration: 420, useNativeDriver: true }),
          Animated.timing(hintPulse, { toValue: 1, duration: 420, useNativeDriver: true }),
        ])
      );
      hintAnimRef.current.start();
    } else {
      hintAnimRef.current?.stop();
      hintPulse.setValue(1);
    }
    return () => { hintAnimRef.current?.stop(); };
  }, [hintPair]);

  // Combo banner entrance + escalating effects
  useEffect(() => {
    if (combo >= 2) {
      // Spring scale + wobble on every increment
      comboScaleAnim.setValue(0.3);
      comboWobble.setValue(-1);
      Animated.parallel([
        Animated.spring(comboScaleAnim, { toValue: 1, friction: 4, tension: 220, useNativeDriver: true }),
        Animated.spring(comboWobble, { toValue: 0, friction: 2.5, tension: 250, useNativeDriver: true }),
      ]).start();

      // Board shake at combo ≥ 4
      if (combo >= 4) {
        boardShakeAnim.setValue(0);
        Animated.sequence([
          Animated.timing(boardShakeAnim, { toValue: -9, duration: 40, useNativeDriver: true }),
          Animated.timing(boardShakeAnim, { toValue: 9, duration: 40, useNativeDriver: true }),
          Animated.timing(boardShakeAnim, { toValue: -7, duration: 40, useNativeDriver: true }),
          Animated.timing(boardShakeAnim, { toValue: 7, duration: 40, useNativeDriver: true }),
          Animated.timing(boardShakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
        ]).start();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }

      // Mega combo burst at ≥ 5
      if (combo >= 5) {
        megaComboScale.setValue(0.3);
        megaComboOpacity.setValue(0);
        Animated.parallel([
          Animated.spring(megaComboScale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(megaComboOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
            Animated.delay(480),
            Animated.timing(megaComboOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]),
        ]).start();
      }
    }
  }, [combo]);

  // Toast slide-up + fade
  useEffect(() => {
    if (toast) {
      toastTranslateY.setValue(16);
      toastOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(toastTranslateY, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [toast]);

  // Score bump on each point gain
  useEffect(() => {
    if (score > 0) {
      scoreBump.setValue(1.4);
      Animated.spring(scoreBump, {
        toValue: 1,
        friction: 3,
        tension: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [score]);

  // Flash before row disappears
  useEffect(() => {
    if (clearingRows.length > 0) {
      clearFlash.setValue(0.7);
      Animated.sequence([
        Animated.timing(clearFlash, { toValue: 0.2, duration: 100, useNativeDriver: true }),
        Animated.timing(clearFlash, { toValue: 0.8, duration: 100, useNativeDriver: true }),
        Animated.timing(clearFlash, { toValue: 0.2, duration: 100, useNativeDriver: true }),
        Animated.timing(clearFlash, { toValue: 0.8, duration: 100, useNativeDriver: true }),
      ]).start();
    } else {
      clearFlash.setValue(1);
    }
  }, [clearingRows.length]);

  useEffect(() => {
    if (thawingCells.length === 0) return;
    thawScale.setValue(1);
    Animated.sequence([
      Animated.timing(thawScale, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.spring(thawScale, { toValue: 1, friction: 3, tension: 300, useNativeDriver: true }),
    ]).start(() => setThawingCells([]));
  }, [thawingCells]);

  useEffect(() => {
    if (hintPair) {
      const [a, b] = hintPair;
      if (!cells[a]?.active || !cells[b]?.active) setHintPair(null);
    }
  }, [cells]);

  useEffect(() => {
    if (stageComplete || noMoves || timeUp || adds > 0 || clearingRows.length > 0 || poppingPair !== null || mode === "tutorial") return;
    const rem = cells.filter((c) => c.active).length;
    if (rem === 0) return;
    if (findHint(cells, destroyedRows) === null) {
      if (mode === "timeattack") {
        const remaining = cells.filter((c) => c.active).map((c) => c.value);
        if (remaining.length > 0) {
          setCells((curr) => {
            const next = [...curr];
            let nextId = next.length;
            for (const v of remaining) next.push({ id: nextId++, value: v, active: true });
            return next;
          });
        }
      } else {
        playSound("no_moves", 0.7);
        setNoMoves(true);
      }
    }
  }, [cells, adds, destroyedRows, stageComplete, clearingRows, poppingPair, noMoves, timeUp, mode]);

  useEffect(() => {
    const totalRows = Math.ceil(cells.length / COLS);
    const newlyCleared: number[] = [];
    for (let r = 0; r < totalRows; r++) {
      if (clearingRows.includes(r) || destroyedRows.includes(r)) continue;
      const rowCells = cells.slice(r * COLS, (r + 1) * COLS);
      if (rowCells.length > 0 && rowCells.every((c) => !c.active)) newlyCleared.push(r);
    }
    if (newlyCleared.length > 0) {
      setClearingRows((prev) => [...prev, ...newlyCleared]);
      setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        playSound("row_clear", 0.8);
        setDestroyedRows((prev) => [...prev, ...newlyCleared]);
        setClearingRows((prev) => prev.filter((r) => !newlyCleared.includes(r)));
        setScore((s) => s + newlyCleared.length * 25);
        showToast(
          newlyCleared.length > 1
            ? `${newlyCleared.length} rows cleared! +${newlyCleared.length * 25}`
            : "Row cleared! +25",
          "win"
        );
      }, 500);
    }
  }, [cells]);

  useEffect(() => {
    if (mode === "golden" || mode === "timeattack") return;
    const rem = cells.filter((c) => c.active).length;
    if (rem === 0 && cells.length > 0 && !stageComplete && clearingRows.length === 0) {
      setStageComplete(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playSound("stage_win", 0.85);
      if (mode !== "tutorial") {
        onCrownsEarned(1);
        if (score > bestScore) {
          setBestScore(score);
          const key = mode === "freeze" ? `hiscore_freeze_${stage}` : `hiscore_${stage}`;
          AsyncStorage.setItem(key, String(score));
        }
      }
    }
  }, [cells, clearingRows, mode]);

  useEffect(() => {
    if (mode !== "timeattack" || timeUp) return;
    const rem = cells.filter((c) => c.active).length;
    if (rem === 0 && cells.length > 0 && clearingRows.length === 0) {
      setTimeLeft((t) => Math.min(t + 15, 120));
      onCrownsEarned(1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playSound("stage_win", 0.85);
      showToast("Board cleared!  +15s", "win", 1800);
      setCells(buildCells(STAGES[1]));
      setDestroyedRows([]);
      setSelected(null);
      setHintPair(null);
      setCombo(0);
      setPoppingPair(null);
      setHints(2);
      setMatchLine(null);
    }
  }, [cells, clearingRows, mode, timeUp]);

  // Golden Garden win detection
  useEffect(() => {
    if (mode !== "golden" || wonRef.current) return;
    const targetKeys = Object.keys(targets) as GemType[];
    if (targetKeys.length === 0) return;
    const allMet = targetKeys.every((k) => (collected[k] ?? 0) >= (targets[k] ?? 0));
    if (allMet) {
      wonRef.current = true;
      setStageComplete(true);
      onCrownsEarned(1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playSound("stage_win", 0.85);
      AsyncStorage.setItem(`golden_done_${stage}`, "1");
    }
  }, [collected, mode, targets]);

  function showToast(text: string, kind: "info" | "warn" | "win" = "info", ms = 1400) {
    setToast({ text, kind });
    setTimeout(() => setToast(null), ms);
  }

  function handleTap(idx: number) {
    if (paused || stageComplete || timeUp) return;
    if (poppingPair !== null) return;
    const cell = cells[idx];
    if (!cell?.active) return;

    if (mode === "tutorial") {
      const tStage = TUTORIAL_STAGES.find((s) => s.id === stage);
      const step = tStage?.steps[tutStep];
      if (step && step.action !== "match") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShakingCell(idx);
        const target = step.action === "hint" ? "💡 hint" : "＋ add row";
        if (!toast) showToast(`Tap the ${target} button!`, "warn", 1000);
        return;
      }
      if (step && step.action === "match" && !step.pair.includes(idx)) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShakingCell(idx);
        if (!toast) showToast("Tap the glowing cells!", "warn", 1000);
        return;
      }
    }

    if (cell.frozen) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setShakingCell(idx);
      if (!toast) showToast("❄️ Match adjacent to thaw", "warn", 1400);
      return;
    }

    if (selected === null) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      playSound("select", 0.6);
      selectBounce.setValue(0.82);
      Animated.spring(selectBounce, {
        toValue: 1,
        friction: 3,
        tension: 350,
        useNativeDriver: true,
      }).start();
      setSelected(idx);
      return;
    }
    if (selected === idx) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      playSound("select", 0.45);
      selectBounce.stopAnimation();
      selectBounce.setValue(1);
      setSelected(null);
      return;
    }

    if (isValidPair(cells, selected, idx, destroyedRows)) {
      const a = cells[selected];
      const b = cells[idx];
      const isSame = a.value === b.value;
      const matchColor = isSame ? C.coral : C.teal;
      setMatchIsSame(isSame);
      const earned = (isSame ? 5 : 10) + combo * 2;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (combo >= 1) playSound("combo", Math.min(1, 0.55 + combo * 0.08));
      else playSound("match", 0.7);

      // Identify adjacent frozen cells to thaw (freeze mode only)
      let thawedIds: number[] = [];
      if (mode === "freeze") {
        const r1 = Math.floor(selected / COLS), c1 = selected % COLS;
        const r2 = Math.floor(idx / COLS), c2 = idx % COLS;
        thawedIds = cells
          .filter((cell, cellIdx) => {
            if (!cell.active || !cell.frozen) return false;
            const r = Math.floor(cellIdx / COLS), c = cellIdx % COLS;
            const adjTo1 = (r === r1 && Math.abs(c - c1) === 1) || (c === c1 && Math.abs(r - r1) === 1);
            const adjTo2 = (r === r2 && Math.abs(c - c2) === 1) || (c === c2 && Math.abs(r - r2) === 1);
            return adjTo1 || adjTo2;
          })
          .map((cell) => cell.id);
      }

      setPoppingPair([selected, idx]);
      setMatchLine([selected, idx]);
      lineAnim.setValue(0);
      Animated.sequence([
        Animated.timing(lineAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.delay(70),
        Animated.timing(lineAnim, { toValue: 2, duration: 120, useNativeDriver: true }),
      ]).start(() => setMatchLine(null));

      const id1 = ++floatIdRef.current;
      const id2 = ++floatIdRef.current;
      const col1 = selected % COLS;
      const row1Vis = visibleRow(Math.floor(selected / COLS), destroyedRows);
      const col2 = idx % COLS;
      const row2Vis = visibleRow(Math.floor(idx / COLS), destroyedRows);
      const sx1 = 12 + BOARD_H_PAD + col1 * CELL_SIZE + CELL_SIZE / 2;
      const sy1 = scrollViewTopRef.current + BOARD_H_PAD + row1Vis * CELL_SIZE + CELL_SIZE / 2 - scrollYRef.current;
      const sx2 = 12 + BOARD_H_PAD + col2 * CELL_SIZE + CELL_SIZE / 2;
      const sy2 = scrollViewTopRef.current + BOARD_H_PAD + row2Vis * CELL_SIZE + CELL_SIZE / 2 - scrollYRef.current;
      setFloatingScores((f) => [
        ...f,
        { id: id1, idx: selected, value: earned, color: matchColor, sx: sx1, sy: sy1 },
        { id: id2, idx, value: earned, color: matchColor, sx: sx2, sy: sy2 },
      ]);

      setTimeout(() => {
        setCells((curr) =>
          curr.map((c) => {
            if (c.id === a.id || c.id === b.id) return { ...c, active: false };
            if (thawedIds.includes(c.id)) return { ...c, frozen: false };
            return c;
          })
        );
        setPoppingPair(null);
        if (thawedIds.length > 0) {
          setThawingCells(thawedIds);
          setScore((s) => s + thawedIds.length * 5);
          showToast(
            thawedIds.length > 1
              ? `❄️ ${thawedIds.length} cells thawed! +${thawedIds.length * 5}`
              : "❄️ Thawed! +5",
            "win",
            1200
          );
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        if (mode === "golden" && (a.gem || b.gem)) {
          setCollected((prev) => {
            const next = { ...prev };
            if (a.gem) next[a.gem] = (next[a.gem] ?? 0) + 1;
            if (b.gem) next[b.gem] = (next[b.gem] ?? 0) + 1;
            return next;
          });
        }
      }, 220);

      setScore((s) => s + earned);
      if (mode === "timeattack") {
        const timeBonus = isSame ? 1 : 2;
        setTimeLeft((t) => Math.min(t + timeBonus, 120));
      }
      setCombo((c) => {
        const next = c + 1;
        if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
        comboTimerRef.current = setTimeout(() => setCombo(0), 2500);
        return next;
      });
      setSelected(null);
      setHintPair(null);
      if (mode === "tutorial") {
        advanceTutorialStep();
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playSound("error", 0.6);
      selectBounce.stopAnimation();
      selectBounce.setValue(1);
      setShakingCell(idx);
      setSelected(idx);
      setCombo(0);
    }
  }

  function advanceTutorialStep() {
    const tStage = TUTORIAL_STAGES.find((ts) => ts.id === stage);
    if (!tStage) return;
    const nextStep = tutStep + 1;
    setTutStep(nextStep);
    if (nextStep >= tStage.steps.length) {
      // Stage 4 leaves leftover cells after Add Row, so force completion here
      // instead of waiting for the rem===0 effect.
      setStageComplete(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playSound("stage_win", 0.85);
      return;
    }
    const ns = tStage.steps[nextStep];
    if (ns.action === "match") setHintPair(ns.pair);
    else setHintPair(null);
  }

  function performAddRow() {
    setCells((curr) => {
      const remaining = curr.filter((c) => c.active).map((c) => c.value);
      if (remaining.length === 0) return curr;
      const next = [...curr];
      let nextId = next.length;
      for (const v of remaining) next.push({ id: nextId++, value: v, active: true });
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playSound("add_row", 0.7);
    setHintPair(null);
    setSelected(null);
    showToast("Row added!", "info", 800);
  }

  function handleAddRow() {
    if (paused || stageComplete) return;
    if (mode === "tutorial") {
      const tStage = TUTORIAL_STAGES.find((s) => s.id === stage);
      const step = tStage?.steps[tutStep];
      if (!step || step.action !== "add") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        showToast("Not yet!", "warn", 800);
        return;
      }
      setAdds((n) => Math.max(0, n - 1));
      performAddRow();
      advanceTutorialStep();
      return;
    }
    if (adds > 0) {
      setAdds((n) => n - 1);
      performAddRow();
      return;
    }
    const ad = rewardedAdRef.current;
    if (!ad) {
      console.log("rewardedAdRef", rewardedAdRef);
      showToast("Ads not available", "warn");
      return;
    }
    if (adLoaded) {
      ad.show();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showToast("Ad not ready — try again", "warn");
      ad.load();
    }
  }

  function handleHint() {
    if (paused || stageComplete) return;
    if (mode === "tutorial") {
      const tStage = TUTORIAL_STAGES.find((s) => s.id === stage);
      const step = tStage?.steps[tutStep];
      if (!step || step.action !== "hint") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        showToast("Not yet!", "warn", 800);
        return;
      }
      const pair = findHint(cells, destroyedRows);
      if (!pair) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      playSound("hint", 0.7);
      setHints((n) => Math.max(0, n - 1));
      setHintPair(pair);
      advanceTutorialStep();
      // advanceTutorialStep sets hintPair for the next match step (which equals `pair`
      // by stage 4 design); leave it on screen until the user matches.
      return;
    }
    if (hints <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      playSound("error", 0.5);
      showToast("No hints left", "warn");
      return;
    }
    const pair = findHint(cells, destroyedRows);
    if (!pair) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      playSound("error", 0.5);
      showToast("No matches — try adding a row", "warn", 1800);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playSound("hint", 0.7);
    setHintPair(pair);
    setHints((n) => n - 1);
    setTimeout(() => setHintPair(null), 2400);
  }

  function startStage(s: number) {
    if (mode === "endless" || mode === "freeze") {
      const key = mode === "endless" ? "endless_stage" : "freeze_stage";
      AsyncStorage.getItem(key).then((prev) => {
        const prevNum = prev ? parseInt(prev, 10) : 1;
        if (s > prevNum) AsyncStorage.setItem(key, String(s));
      });
    }
    setCells(buildCellsForMode(s, mode));
    setTargets(mode === "golden" ? (getGoldenStage(s)?.targets ?? {}) : {});
    setCollected({});
    wonRef.current = false;
    setSelected(null);
    setScore(0);
    setHintPair(null);
    setCombo(0);
    setStageComplete(false);
    setStage(s);
    setToast(null);
    setClearingRows([]);
    setDestroyedRows([]);
    setPoppingPair(null);
    setShakingCell(null);
    setAdds(mode === "timeattack" ? 0 : mode === "tutorial" ? (s === 4 ? 1 : 0) : mode === "freeze" ? 7 : 5);
    setHints(mode === "tutorial" ? (s === 4 ? 1 : 0) : 2);
    setNoMoves(false);
    setMatchLine(null);
    setThawingCells([]);
    if (mode === "tutorial") {
      setTutStep(0);
      const tStage = TUTORIAL_STAGES.find((ts) => ts.id === s);
      const s0 = tStage?.steps[0];
      if (s0 && s0.action === "match") setHintPair(s0.pair);
    }
    if (mode === "timeattack") {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setTimeLeft(TIMEATTACK_START);
      setTimeUp(false);
    }
  }

  const remaining = useMemo(() => cells.filter((c) => c.active).length, [cells]);
  const frozenCount = useMemo(() => cells.filter((c) => c.active && c.frozen).length, [cells]);

  const rows = useMemo(() => {
    const totalRows = Math.ceil(cells.length / COLS);
    const result: { index: number; cells: Cell[] }[] = [];
    for (let ri = 0; ri < totalRows; ri++) {
      if (destroyedRows.includes(ri)) continue;
      result.push({ index: ri, cells: cells.slice(ri * COLS, (ri + 1) * COLS) });
    }
    return result;
  }, [cells, destroyedRows]);

  return (
    <View style={gs.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={gs.header}>
        <TouchableOpacity style={gs.iconBtn} onPress={onBack} activeOpacity={0.75}>
          <Text style={gs.iconBtnText}>←</Text>
        </TouchableOpacity>
        <View style={gs.titleRow}>
          {mode === "tutorial" ? (
            <>
              <Text style={gs.titleLabel}>Tutorial · </Text>
              <Text style={[gs.titleNum, { color: C.primary }]}>{stage} of 4</Text>
            </>
          ) : mode === "timeattack" ? (
            <Text style={[gs.titleNum, { color: C.danger }]}>Time Attack</Text>
          ) : mode === "freeze" ? (
            <>
              <Text style={gs.titleLabel}>Freeze · Stage </Text>
              <Text style={[gs.titleNum, { color: C.freeze }]}>{stage}</Text>
            </>
          ) : (
            <>
              <Text style={gs.titleLabel}>
                {mode === "golden" ? "Garden · " : "Endless · Stage "}
              </Text>
              <Text style={gs.titleNum}>
                {mode === "golden" ? (getGoldenStage(stage)?.name ?? `#${stage}`) : stage}
              </Text>
            </>
          )}
        </View>
        <TouchableOpacity style={gs.iconBtn} onPress={() => setPaused((p) => !p)} activeOpacity={0.75}>
          <Text style={gs.iconBtnText}>{paused ? "▶" : "⏸"}</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={gs.statsRow}>
        <View
          ref={scoreCardRef}
          style={gs.statCard}
          onLayout={() => scoreCardRef.current?.measureInWindow((x, y, w, h) => {
            scoreTargetRef.current = { x: x + w / 2, y: y + h / 2 };
          })}
        >
          <Text style={gs.statLabel}>SCORE</Text>
          <Animated.Text style={[gs.statValue, { transform: [{ scale: scoreBump }] }]}>
            {score}
          </Animated.Text>
        </View>
        <View style={gs.statCard}>
          {mode === "timeattack" ? (
            <>
              <Text style={gs.statLabel}>TIME</Text>
              <Text style={[gs.statValue, timeLeft <= 10 && { color: C.danger }]}>
                {timeLeft}s
              </Text>
            </>
          ) : (
            <>
              <Text style={gs.statLabel}>CROWNS</Text>
              <Text style={[gs.statValue, { color: C.crown }]}>♛ {crowns}</Text>
            </>
          )}
        </View>
        <View style={gs.statCard}>
          <Text style={gs.statLabel}>LEFT</Text>
          <Text style={gs.statValue}>{remaining}</Text>
          {mode === "freeze" && frozenCount > 0 && (
            <Text style={[gs.statLabel, { color: C.freeze }]}>❄ {frozenCount}</Text>
          )}
        </View>
      </View>

      {mode === "golden" && Object.keys(targets).length > 0 && (
        <View style={gs.goalRow}>
          {(Object.keys(targets) as GemType[]).map((g) => {
            const need = targets[g] ?? 0;
            const have = collected[g] ?? 0;
            const done = have >= need;
            return (
              <View key={g} style={[gs.goalChip, done && gs.goalChipDone]}>
                <Text style={gs.goalEmoji}>{GEM_EMOJI[g]}</Text>
                <Text style={[gs.goalText, done && gs.goalTextDone]}>
                  {Math.min(have, need)}/{need}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Combo slot / Tutorial tip — fixed height so the board never shifts */}
      {mode === "tutorial" ? (() => {
        const tStage = TUTORIAL_STAGES.find((s) => s.id === stage);
        const step = tStage?.steps[tutStep];
        if (!step) return <View style={gs.comboSlot} />;
        const isPowerup = step.action === "hint" || step.action === "add";
        const tipColor = isPowerup
          ? C.primary
          : step.matchType === "sum10" ? C.teal : step.matchType === "path" ? C.crown : C.coral;
        const tipBg = isPowerup
          ? C.coralSoft
          : step.matchType === "sum10" ? C.tealSoft : step.matchType === "path" ? C.crownSoft : C.coralSoft;
        const tipLabel = step.action === "hint"
          ? "HINT"
          : step.action === "add"
          ? "ADD ROW"
          : step.matchType === "sum10" ? "SUM TO 10" : step.matchType === "path" ? "PATH" : "MATCH";
        return (
          <View style={[gs.tutTip, { borderLeftColor: tipColor, backgroundColor: tipBg }]}>
            <Text style={[gs.tutTipLabel, { color: tipColor }]}>{tipLabel}</Text>
            <Text style={gs.tutTipText}>{step.tip}</Text>
          </View>
        );
      })() : (
        <View style={gs.comboSlot}>
          {combo >= 2 && (
            <Animated.View
              renderToHardwareTextureAndroid
              style={[
                gs.comboBanner,
                combo >= 6 && gs.comboBannerMega,
                combo >= 4 && combo < 6 && gs.comboBannerFire,
                {
                  transform: [
                    { scale: comboScaleAnim },
                    { rotate: comboWobble.interpolate({ inputRange: [-1, 1], outputRange: ["-5deg", "5deg"] }) },
                  ],
                },
              ]}>
              <Text style={[gs.comboText, combo >= 4 && gs.comboTextLg]}>
                {combo >= 6 ? `×${combo} UNSTOPPABLE!` : combo >= 4 ? `×${combo} ON FIRE! 🔥` : `×${combo} combo!`}
              </Text>
            </Animated.View>
          )}
        </View>
      )}

      {/* Board */}
      <Animated.View
        style={{ flex: 1, transform: [{ translateX: boardShakeAnim }] }}
        renderToHardwareTextureAndroid
      >
      <View
        ref={scrollViewWrapRef}
        style={{ flex: 1 }}
        onLayout={() => scrollViewWrapRef.current?.measureInWindow((_: number, y: number) => {
          scrollViewTopRef.current = y;
        })}
      >
      <ScrollView
        style={gs.boardScroll}
        contentContainerStyle={gs.boardContent}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
      >
        <View style={gs.board}>
          {rows.map((row) => {
            const isClearing = clearingRows.includes(row.index);
            return (
              <Animated.View
                key={row.index}
                style={[
                  gs.row,
                  isClearing && gs.rowClearing,
                  isClearing ? { opacity: clearFlash } : null,
                ]}
              >
                {row.cells.map((cell) => {
                  const isSelected = selected === cell.id;
                  const isHint = !!(hintPair && (hintPair[0] === cell.id || hintPair[1] === cell.id));
                  const isPopping = !!(poppingPair && (poppingPair[0] === cell.id || poppingPair[1] === cell.id));
                  const isShaking = shakingCell === cell.id;
                  const isThawing = thawingCells.includes(cell.id);
                  const isFrozen = !!cell.frozen;
                  const ghost = !cell.active;

                  let scaleVal: any = 1;
                  let scaleSrc = "idle";
                  if (isPopping) { scaleVal = popScale; scaleSrc = "pop"; }
                  else if (isThawing) { scaleVal = thawScale; scaleSrc = "thaw"; }
                  else if (isSelected && !isShaking) { scaleVal = selectBounce; scaleSrc = "sel"; }
                  else if (isHint && !isShaking) { scaleVal = hintPulse; scaleSrc = "hint"; }

                  const transforms: any[] = [{ scale: scaleVal }];
                  if (isShaking) transforms.push({ translateX: shakeAnim });

                  // Include the scale source in the key so the Animated.View remounts
                  // when transitioning between animated/static scale. RN's Animated
                  // doesn't reliably unbind a previous Animated.Value from a transform
                  // key when it switches to a literal, so the old animated value can
                  // stay cached on the native node. A fresh remount avoids that.
                  return (
                    <Animated.View
                      key={`${cell.id}-${scaleSrc}`}
                      renderToHardwareTextureAndroid
                      style={[
                        gs.cellWrap,
                        { transform: transforms },
                      ]}
                    >
                      {cell.gem && cell.active && (
                        <Text style={gs.cellGem} pointerEvents="none">{GEM_EMOJI[cell.gem]}</Text>
                      )}
                      {isFrozen && cell.active && (
                        <Text style={gs.cellFreezeIcon} pointerEvents="none">❄</Text>
                      )}
                      <TouchableOpacity
                        style={[
                          gs.cell,
                          ghost && gs.cellGhost,
                          isFrozen && gs.cellFrozen,
                          isSelected && gs.cellSelected,
                          isHint && gs.cellHint,
                          isPopping && gs.cellPopping,
                          isPopping && { backgroundColor: matchIsSame ? C.coral : C.teal, borderColor: matchIsSame ? C.coral : C.teal },
                        ]}
                        onPress={() => handleTap(cell.id)}
                        disabled={!cell.active}
                        activeOpacity={0.65}
                      >
                        {!isFrozen && (
                          <Text style={[
                            gs.cellNum,
                            ghost && gs.cellNumGhost,
                            isSelected && gs.cellNumSelected,
                            isPopping && gs.cellNumPopping,
                          ]}>
                            {cell.value}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </Animated.View>
            );
          })}
          {matchLine && (() => {
            const p1x = BOARD_H_PAD + (matchLine[0] % COLS) * CELL_SIZE + CELL_SIZE / 2;
            const p1y = BOARD_H_PAD + visibleRow(Math.floor(matchLine[0] / COLS), destroyedRows) * CELL_SIZE + CELL_SIZE / 2;
            const p2x = BOARD_H_PAD + (matchLine[1] % COLS) * CELL_SIZE + CELL_SIZE / 2;
            const p2y = BOARD_H_PAD + visibleRow(Math.floor(matchLine[1] / COLS), destroyedRows) * CELL_SIZE + CELL_SIZE / 2;
            const dx = p2x - p1x;
            const dy = p2y - p1y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            return (
              <Animated.View
                pointerEvents="none"
                renderToHardwareTextureAndroid
                style={[
                  gs.matchLine,
                  {
                    backgroundColor: matchIsSame ? C.coral : C.teal,
                    shadowColor: matchIsSame ? C.coral : C.teal,
                    left: (p1x + p2x) / 2 - len / 2,
                    top: (p1y + p2y) / 2 - 2,
                    width: len,
                    transform: [
                      { rotate: `${angle}rad` },
                      { scaleX: lineAnim.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 1] }) },
                    ],
                    opacity: lineAnim.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }),
                  },
                ]}
              />
            );
          })()}
        </View>
      </ScrollView>
      </View>
      </Animated.View>

      {/* Actions */}
      {(mode !== "tutorial" || stage === 4) && <View style={gs.actions}>
        {mode !== "timeattack" && (
          <TouchableOpacity
            style={[
              gs.actionBtn,
              (paused || stageComplete) && gs.actionBtnDisabled,
              adds === 0 && gs.actionBtnAd,
            ]}
            onPress={handleAddRow}
            disabled={paused || stageComplete}
            activeOpacity={0.8}
          >
            <Text style={gs.actionBtnIcon}>{adds === 0 ? "📺" : "＋"}</Text>
            <View style={[gs.badge, adds === 0 && gs.badgeAd]}>
              <Text style={gs.badgeText}>{adds === 0 ? "AD" : adds}</Text>
            </View>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[gs.actionBtn, (paused || stageComplete || timeUp) && gs.actionBtnDisabled]}
          onPress={handleHint}
          disabled={paused || stageComplete || timeUp}
          activeOpacity={0.8}
        >
          <Text style={gs.actionBtnIcon}>💡</Text>
          <View style={gs.badge}><Text style={gs.badgeText}>{hints}</Text></View>
        </TouchableOpacity>
      </View>}

      {/* How-to */}
      {mode !== "tutorial" && <View style={gs.howto}>
        <Text style={gs.howtoText}>
          Match <Text style={gs.howtoEm}>identical</Text> numbers or pairs that{" "}
          <Text style={gs.howtoEm}>sum to 10</Text>. Connect along rows, columns,
          diagonals, or across line ends.
        </Text>
      </View>}

      {/* Mega combo burst overlay */}
      <Animated.View
        pointerEvents="none"
        style={[gs.megaComboOverlay, { opacity: megaComboOpacity, transform: [{ scale: megaComboScale }] }]}
      >
        <Text style={gs.megaComboText}>
          {combo >= 6 ? "UNSTOPPABLE!" : "MEGA COMBO!"}
        </Text>
        <Text style={gs.megaComboSub}>×{combo}</Text>
      </Animated.View>

      {/* Toast */}
      {toast && (
        <Animated.View style={[
          gs.toast,
          toast.kind === "warn" && gs.toastWarn,
          toast.kind === "win" && gs.toastWin,
          { transform: [{ translateY: toastTranslateY }], opacity: toastOpacity },
        ]}>
          <Text style={gs.toastText}>{toast.text}</Text>
        </Animated.View>
      )}

      {/* Flying scores overlay */}
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 500 }}>
        {floatingScores.map((f) => (
          <FlyingScore
            key={f.id}
            value={f.value}
            color={f.color}
            sx={f.sx}
            sy={f.sy}
            tx={scoreTargetRef.current.x}
            ty={scoreTargetRef.current.y}
            onDone={() => setFloatingScores((prev) => prev.filter((x) => x.id !== f.id))}
          />
        ))}
      </View>

      {/* Pause Modal */}
      <Modal visible={paused} transparent animationType="fade">
        <View style={gs.overlay}>
          <View style={gs.card}>
            <Text style={gs.cardTitle}>Paused</Text>
            <TouchableOpacity style={gs.primaryBtn} onPress={() => setPaused(false)} activeOpacity={0.8}>
              <Text style={gs.primaryBtnText}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity style={gs.secondaryBtn} onPress={() => { setPaused(false); startStage(stage); }} activeOpacity={0.8}>
              <Text style={gs.secondaryBtnText}>↺  Restart Stage</Text>
            </TouchableOpacity>
            <TouchableOpacity style={gs.ghostBtn} onPress={() => { setPaused(false); onBack(); }} activeOpacity={0.8}>
              <Text style={gs.ghostBtnText}>← Main Menu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Stage Complete Modal */}
      <Modal visible={stageComplete} transparent animationType="fade">
        <View style={gs.overlay}>
          <View style={gs.card}>
            {mode === "tutorial" ? (
              <>
                <Text style={gs.winEmoji}>{stage < 4 ? "✓" : "🎯"}</Text>
                <Text style={gs.cardTitle}>
                  {stage < 4 ? `Lesson ${stage} done!` : "You're ready!"}
                </Text>
                <Text style={[gs.winStatLabel, { textAlign: "center", lineHeight: 22 }]}>
                  {stage === 1
                    ? "Next: pairs that sum to 10"
                    : stage === 2
                    ? "Next: path connections"
                    : stage === 3
                    ? "Last lesson: power-ups"
                    : "Head to the main menu and start playing!"}
                </Text>
                <TouchableOpacity
                  style={gs.primaryBtn}
                  onPress={() => {
                    if (stage < 4) {
                      startStage(stage + 1);
                    } else {
                      onTutorialComplete?.();
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={gs.primaryBtnText}>
                    {stage < 4 ? "Next Lesson →" : "Start Playing! →"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={gs.ghostBtn}
                  onPress={() => onTutorialComplete?.()}
                  activeOpacity={0.8}
                >
                  <Text style={gs.ghostBtnText}>Skip to menu</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={gs.winEmoji}>{mode === "golden" ? "💎" : mode === "freeze" ? "🧊" : "♛"}</Text>
                <Text style={gs.cardTitle}>
                  {mode === "golden" ? "Garden Bloomed!" : mode === "freeze" ? "Board Thawed!" : "Stage Cleared!"}
                </Text>
                {mode === "golden" ? (
                  <View style={gs.winStats}>
                    <Text style={[gs.winStatLabel, { textAlign: "center" }]}>
                      {getGoldenStage(stage)?.name}
                    </Text>
                    <View style={gs.goalRow}>
                      {(Object.keys(targets) as GemType[]).map((g) => (
                        <View key={g} style={[gs.goalChip, gs.goalChipDone]}>
                          <Text style={gs.goalEmoji}>{GEM_EMOJI[g]}</Text>
                          <Text style={[gs.goalText, gs.goalTextDone]}>×{targets[g]}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={gs.winStatRow}>
                      <Text style={gs.winStatLabel}>Crowns earned</Text>
                      <Text style={gs.winStatValue}>♛ +1</Text>
                    </View>
                  </View>
                ) : (
                  <View style={gs.winStats}>
                    <View style={gs.winStatRow}>
                      <Text style={gs.winStatLabel}>Score</Text>
                      <CountUp to={score} visible={stageComplete} style={[gs.winStatValue, score > bestScore && { color: C.good }]} />
                    </View>
                    <View style={gs.winStatRow}>
                      <Text style={gs.winStatLabel}>Best</Text>
                      <Text style={gs.winStatValue}>{Math.max(score, bestScore)}</Text>
                    </View>
                    {winNewBestReady && score > bestScore && (
                      <Text style={[gs.winStatLabel, { color: C.good, textAlign: "center" }]}>New best!</Text>
                    )}
                    <View style={gs.winStatRow}>
                      <Text style={gs.winStatLabel}>Crowns earned</Text>
                      <Text style={gs.winStatValue}>♛ +1</Text>
                    </View>
                  </View>
                )}
                <TouchableOpacity
                  style={gs.primaryBtn}
                  onPress={() => {
                    if (mode === "golden") {
                      const ids = GOLDEN_STAGES.map((s) => s.id);
                      const i = ids.indexOf(stage);
                      const nextId = i >= 0 && i < ids.length - 1 ? ids[i + 1] : ids[0];
                      startStage(nextId);
                    } else {
                      startStage(stage < 6 ? stage + 1 : stage);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={gs.primaryBtnText}>
                    {mode === "golden"
                      ? (() => {
                          const ids = GOLDEN_STAGES.map((s) => s.id);
                          const i = ids.indexOf(stage);
                          return i >= 0 && i < ids.length - 1 ? "Next Garden →" : "Play Again";
                        })()
                      : (stage < 6 ? "Next Stage →" : "Play Again")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={gs.ghostBtn} onPress={onBack} activeOpacity={0.8}>
                  <Text style={gs.ghostBtnText}>← Main Menu</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Time's Up Modal */}
      <Modal visible={timeUp} transparent animationType="fade">
        <View style={gs.overlay}>
          <View style={gs.card}>
            <Text style={[gs.winEmoji, { color: C.danger }]}>⏱</Text>
            <Text style={gs.cardTitle}>Time's Up!</Text>
            <View style={gs.winStats}>
              <View style={gs.winStatRow}>
                <Text style={gs.winStatLabel}>Score</Text>
                <CountUp to={score} visible={timeUp} style={[gs.winStatValue, score > bestScore && { color: C.good }]} />
              </View>
              <View style={gs.winStatRow}>
                <Text style={gs.winStatLabel}>Best</Text>
                <Text style={gs.winStatValue}>{Math.max(score, bestScore)}</Text>
              </View>
              {winNewBestReady && score > bestScore && (
                <Text style={[gs.winStatLabel, { color: C.good, textAlign: "center" }]}>New best!</Text>
              )}
            </View>
            <TouchableOpacity style={gs.primaryBtn} onPress={() => startStage(1)} activeOpacity={0.8}>
              <Text style={gs.primaryBtnText}>↺  Play Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={gs.ghostBtn} onPress={onBack} activeOpacity={0.8}>
              <Text style={gs.ghostBtnText}>← Main Menu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* No Moves Modal */}
      <Modal visible={noMoves && mode !== "timeattack"} transparent animationType="fade">
        <View style={gs.overlay}>
          <View style={gs.card}>
            <Text style={[gs.winEmoji, { color: C.danger }]}>✕</Text>
            <Text style={gs.cardTitle}>No Moves Left</Text>
            <Text style={gs.howtoText}>
              {mode === "golden"
                ? "No valid pairs remain and your goals aren't met yet."
                : "No valid pairs remain and you're out of adds."}
            </Text>
            <TouchableOpacity style={gs.primaryBtn} onPress={() => startStage(stage)} activeOpacity={0.8}>
              <Text style={gs.primaryBtnText}>↺  Restart Stage</Text>
            </TouchableOpacity>
            <TouchableOpacity style={gs.ghostBtn} onPress={onBack} activeOpacity={0.8}>
              <Text style={gs.ghostBtnText}>← Main Menu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Design Tokens ────────────────────────────────────────────────────────────

const C = {
  bg: "#f5efe6",
  white: "#fbfaf6",
  grid: "rgba(26,29,46,0.10)",
  ink: "#1a1d2e",
  inkSoft: "rgba(26,29,46,0.52)",
  ghost: "#d6cdb9",
  select: "#f4c64a",
  selectShadow: "#d4960e",
  hint: "#fde5a8",
  coral: "#ec7458",
  coralSoft: "#fbe1d6",
  teal: "#3e9d8f",
  tealSoft: "#d6ebe5",
  primary: "#ec7458",
  primary2: "#d45c3a",
  primaryShadow: "#8f2c10",
  danger: "#d45c5c",
  good: "#5baa7a",
  crown: "#d9a648",
  crownSoft: "#f9eedb",
  freeze: "#3a9fdf",
  freezeBg: "#cce8f5",
  freezeBorder: "#5aabdd",
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const gs = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === "android" ? 36 : 52,
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 16,
    backgroundColor: C.white,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(26,29,46,0.08)",
    shadowColor: "rgba(26,29,46,1)", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10, shadowRadius: 8, elevation: 4,
  },
  iconBtnText: { fontSize: 22, color: C.ink },
  titleRow: { flexDirection: "row", alignItems: "baseline" },
  titleLabel: { fontSize: 14, color: C.inkSoft, fontWeight: "700" },
  titleNum: { fontSize: 22, color: C.primary, fontWeight: "900" },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  statCard: {
    flex: 1, backgroundColor: C.white, borderRadius: 18,
    paddingVertical: 10, paddingHorizontal: 8, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(26,29,46,0.06)",
    shadowColor: "rgba(26,29,46,1)", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  statLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8, color: "rgba(26,29,46,0.42)", marginBottom: 2 },
  statValue: { fontSize: 20, fontWeight: "900", color: C.ink },

  goalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
    justifyContent: "center",
  },
  goalChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1.5,
    borderColor: "rgba(232,160,32,0.35)",
    shadowColor: "rgba(26,29,46,1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  goalChipDone: {
    backgroundColor: "rgba(91,170,122,0.15)",
    borderColor: C.good,
  },
  goalEmoji: { fontSize: 16 },
  goalText: { fontSize: 14, fontWeight: "900", color: C.ink },
  goalTextDone: { color: C.good },

  cellGem: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: Math.floor(CELL_SIZE * 0.7),
    lineHeight: CELL_SIZE,
    opacity: 0.32,
  },

  comboSlot: {
    height: 36,
    alignItems: "flex-end",
    justifyContent: "center",
    marginBottom: 4,
  },
  comboBanner: {
    backgroundColor: "#c45c3a", borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 5,
    shadowColor: "#c45c3a", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.55, shadowRadius: 10, elevation: 8,
  },
  comboBannerFire: {
    backgroundColor: "#b03820",
    shadowColor: "#b03820", shadowOpacity: 0.55, shadowRadius: 12, elevation: 8,
  },
  comboBannerMega: {
    backgroundColor: "#7b4ea8",
    shadowColor: "#7b4ea8", shadowOpacity: 0.6, shadowRadius: 16, elevation: 10,
  },
  comboText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  comboTextLg: { fontSize: 16 },

  megaComboOverlay: {
    position: "absolute", alignSelf: "center",
    top: "35%", zIndex: 200,
    alignItems: "center",
    pointerEvents: "none",
  } as any,
  megaComboText: {
    fontSize: 36, fontWeight: "900", color: "#fff",
    textShadowColor: "rgba(123,78,168,0.8)",
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20,
    letterSpacing: 1,
  },
  megaComboSub: {
    fontSize: 52, fontWeight: "900", color: "#ffe566",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6,
    marginTop: -8,
  },

  boardScroll: { flex: 1 },
  boardContent: { paddingBottom: 8 },
  board: {
    backgroundColor: C.white, borderRadius: 18, padding: BOARD_H_PAD,
    borderWidth: 1, borderColor: "rgba(26,29,46,0.08)",
    shadowColor: "rgba(26,29,46,1)", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10, shadowRadius: 12, elevation: 4,
  },
  row: { flexDirection: "row" },
  rowClearing: { backgroundColor: "#d4eedf" },

  cellWrap: {
    width: CELL_SIZE, height: CELL_SIZE,
    position: "relative", alignItems: "center", justifyContent: "center",
  },
  cell: {
    width: CELL_SIZE, height: CELL_SIZE,
    borderWidth: 1, borderColor: C.grid,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "transparent",
  },
  cellGhost: { backgroundColor: "transparent" },
  cellSelected: { backgroundColor: C.select, borderColor: C.selectShadow },
  cellHint: { backgroundColor: C.hint, borderColor: "#c4960e" },
  cellPopping: { backgroundColor: C.coral, borderColor: C.coral },

  cellFrozen: { backgroundColor: "#cce8f5", borderColor: "#5aabdd" },
  cellFreezeIcon: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: Math.floor(CELL_SIZE * 0.58),
    lineHeight: CELL_SIZE,
    opacity: 0.65,
    color: "#1a6fa8",
  },

  cellNum: {
    fontSize: CELL_SIZE > 36 ? 18 : 14,
    fontWeight: "700", color: C.ink,
  },
  cellNumGhost: { color: Platform.OS === "ios" ? "#b8ab90" : C.ghost },
  cellNumFrozen: { color: "#2a6fa8", fontWeight: "900" },
  cellNumSelected: { color: "#3d2000" },
  cellNumPopping: { color: "#fff" },

  matchLine: {
    position: "absolute",
    height: 4,
    backgroundColor: C.coral,
    borderRadius: 2,
    zIndex: 10,
    shadowColor: C.coral,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 6,
  },

  actions: { flexDirection: "row", justifyContent: "center", gap: 26, paddingVertical: 12 },
  actionBtn: {
    width: 58, height: 58, borderRadius: 18,
    backgroundColor: C.white, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(26,29,46,0.10)",
    shadowColor: "rgba(26,29,46,1)", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10, shadowRadius: 8, elevation: 4,
  },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnAd: { borderColor: C.primary, borderWidth: 1.5 },
  actionBtnIcon: { fontSize: 24, color: C.ink },
  badge: {
    position: "absolute", top: -4, right: -4,
    minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: C.danger, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff", paddingHorizontal: 4,
  },
  badgeAd: { backgroundColor: C.primary },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "900" },

  howto: {
    backgroundColor: "rgba(251,250,246,0.7)",
    borderWidth: 1, borderColor: "rgba(26,29,46,0.12)", borderStyle: "dashed",
    borderRadius: 14, padding: 12, marginTop: 4,
  },
  howtoText: { fontSize: 13, color: C.inkSoft, textAlign: "center", lineHeight: 20 },
  howtoEm: { color: C.coral, fontWeight: "800" },

  toast: {
    position: "absolute", bottom: 90, alignSelf: "center",
    backgroundColor: C.ink, borderRadius: 999,
    paddingHorizontal: 20, paddingVertical: 10, zIndex: 100,
    shadowColor: "rgba(26,29,46,1)", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 8,
  },
  toastWarn: { backgroundColor: C.coral },
  toastWin: { backgroundColor: C.good },
  toastText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  overlay: {
    flex: 1, backgroundColor: "rgba(245,239,230,0.94)",
    alignItems: "center", justifyContent: "center",
  },
  card: {
    backgroundColor: C.white, borderRadius: 24,
    padding: 28, alignItems: "center", minWidth: 260,
    borderWidth: 1, borderColor: "rgba(26,29,46,0.08)",
    shadowColor: "rgba(26,29,46,1)", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16, shadowRadius: 24, elevation: 12,
    gap: 12,
  },
  cardTitle: { fontSize: 26, fontWeight: "900", color: C.ink },
  winEmoji: { fontSize: 52, color: C.crown },
  winStats: { width: "100%", gap: 8 },
  winStatRow: { flexDirection: "row", justifyContent: "space-between" },
  winStatLabel: { fontSize: 15, color: C.inkSoft },
  winStatValue: { fontSize: 15, fontWeight: "800", color: C.ink },

  primaryBtn: {
    width: "100%", backgroundColor: C.ink, borderRadius: 18,
    paddingVertical: 17, paddingHorizontal: 24, alignItems: "center",
    shadowColor: "rgba(26,29,46,1)", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.30, shadowRadius: 12, elevation: 5,
  },
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 17 },

  secondaryBtn: {
    width: "100%", backgroundColor: C.white,
    borderRadius: 18, paddingVertical: 15, paddingHorizontal: 24, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(26,29,46,0.10)",
  },
  secondaryBtnText: { color: C.ink, fontWeight: "700", fontSize: 15 },

  ghostBtn: {
    paddingVertical: 10, paddingHorizontal: 16,
  },
  ghostBtnText: { color: C.inkSoft, fontWeight: "700", fontSize: 14 },

  tutTip: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderLeftWidth: 3,
    gap: 10,
  },
  tutTipLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  tutTipText: {
    fontSize: 13,
    fontWeight: "600",
    color: C.ink,
    flex: 1,
    lineHeight: 18,
  },
});
