import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, StatusBar, Platform, Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GameMode } from "../App";
import { GardenState, stageImageIndex } from "./gardenData";
import Garden, { AmbientLife } from "./Garden";

// Full-screen garden scenes, indexed by stageImageIndex (number of areas restored).
// 0 = barren, then one image per restored area up to fully restored.
const GARDEN_SCENES = [
  require("../assets/garden/main.jpg"),   // 0 — barren
  require("../assets/garden/stage0.png"), // 1 — first area restored
  require("../assets/garden/stage1.png"), // 2 — second area restored
  require("../assets/garden/stage2.png"), // 3 — fully restored
];
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

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

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  crowns: number;
  gardenState: GardenState;
  /** Invest the player's crowns into the current garden area. */
  onInvestGarden: () => void;
  onPlay: (stage: number, mode: GameMode) => void;
  onResetTutorial?: () => void;
  /** DEV-only: add crowns for debugging. */
  onDebugAddCrowns?: (amount: number) => void;
}

export default function MainMenu({
  crowns, gardenState, onInvestGarden, onPlay, onResetTutorial, onDebugAddCrowns,
}: Props) {
  const [endlessStage, setEndlessStage] = useState(1);
  const crownBump = useRef(new Animated.Value(1)).current;
  const isFirstCrownRef = useRef(true);

  useEffect(() => {
    AsyncStorage.getItem("endless_stage")
      .then((endlessVal) => {
        if (endlessVal) setEndlessStage(parseInt(endlessVal, 10));
      })
      .catch(() => {});
  }, []);

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

  const sceneIndex = stageImageIndex(gardenState);

  return (
    <SceneBackground index={sceneIndex} style={ms.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Ambient life drifts across the whole scene */}
      <AmbientLife w={SCREEN_W} h={SCREEN_H} />

      {/* Crown badge — fixed top right */}
      <View style={ms.topBar}>
        <Text style={ms.crownEmoji}>👑</Text>
        <Animated.Text style={[ms.crownCount, { transform: [{ scale: crownBump }] }]}>{crowns}</Animated.Text>
      </View>

      {/* DEV — reset first-launch onboarding (dev builds only) */}
      {__DEV__ && (
        <TouchableOpacity style={ms.devBtn} onPress={devResetFirstLaunch} activeOpacity={0.7}>
          <Text style={ms.devBtnText}>↺ onboard</Text>
        </TouchableOpacity>
      )}

      {/* Bottom UI floats over the garden background */}
      <Animated.View
        style={[ms.bottom, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        <Garden
          crowns={crowns}
          gardenState={gardenState}
          onInvest={onInvestGarden}
        />

        <TouchableOpacity
          style={ms.playBtn}
          onPress={() => onPlay(endlessStage, "endless")}
          activeOpacity={0.82}
        >
          <View style={{ alignItems: "flex-start" }}>
            <Text style={ms.playBtnText}>{endlessStage > 1 ? "Continue" : "Play"}</Text>
            {endlessStage > 1 && (
              <Text style={ms.playBtnSub}>Stage {endlessStage} · earn crowns to grow</Text>
            )}
          </View>
          <Text style={ms.playBtnArrow}>→</Text>
        </TouchableOpacity>
      </Animated.View>
    </SceneBackground>
  );
}

// ─── Scene background ─────────────────────────────────────────────────────────
// Renders the full-screen garden image for the current state and crossfades to a
// new image whenever the garden advances a stage. The previous scene stays at the
// bottom so there is never a transparent flash mid-transition.

function SceneBackground({
  index, style, children,
}: { index: number; style?: any; children: React.ReactNode }) {
  const clamp = (i: number) => Math.max(0, Math.min(GARDEN_SCENES.length - 1, i));
  const [layers, setLayers] = useState(() => [
    { key: 0, source: GARDEN_SCENES[clamp(index)], anim: new Animated.Value(1) },
  ]);
  const prevIndexRef = useRef(index);

  useEffect(() => {
    if (index === prevIndexRef.current) return;
    prevIndexRef.current = index;
    const anim = new Animated.Value(0);
    const layer = { key: Date.now(), source: GARDEN_SCENES[clamp(index)], anim };
    setLayers((prev) => [...prev, layer]);
    Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setLayers([{ key: layer.key, source: layer.source, anim: new Animated.Value(1) }]);
    });
  }, [index]);

  return (
    <View style={style}>
      {layers.map((layer) => (
        <Animated.Image
          key={layer.key}
          source={layer.source}
          resizeMode="cover"
          style={[StyleSheet.absoluteFill, { width: undefined, height: undefined, opacity: layer.anim }]}
        />
      ))}
      {children}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ms = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  topBar: {
    position: "absolute",
    top: Platform.OS === "android" ? 76 : 92,
    right: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: C.white,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(26,29,46,0.08)",
    shadowColor: "rgba(26,29,46,1)",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 10,
  },
  crownEmoji: { fontSize: 17 },
  crownCount: { fontSize: 16, fontWeight: "900", color: C.ink },

  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingBottom: Platform.OS === "android" ? 28 : 40,
    gap: 14,
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
