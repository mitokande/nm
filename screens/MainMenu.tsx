import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, StatusBar, Platform, Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GameMode } from "../App";
import { GardenState, stageImageIndex } from "./gardenData";
import Garden, { AmbientLife } from "./Garden";
import {
  LivesState, MAX_LIVES, msUntilNextLife, formatCountdown,
} from "./livesData";
import {
  msUntilTomorrow, formatHMS, DAILY_BONUS_CROWNS, DAILY_BONUS_LIVES,
} from "./dailyChallenge";
import { MailMessage, unreadCount } from "./mailboxData";
import Settings from "./Settings";
import Mailbox from "./Mailbox";

// Full-screen garden scenes, indexed by stageImageIndex (number of areas restored).
// 0 = barren, then one image per restored area up to fully restored.
const GARDEN_SCENES = [
  require("../assets/garden/main.jpg"),   // 0 — barren
  require("../assets/garden/stage0.png"), // 1 — plant the first rose
  require("../assets/garden/stage1.png"), // 2 — add another flower bed
  require("../assets/garden/stage2.png"), // 3 — rose grows
  require("../assets/garden/stage3.png"), // 4 — rose grows more
  require("../assets/garden/stage4.png"), // 5 — rose fully grown
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
  heart: "#e35d6a",
};

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  crowns: number;
  gardenState: GardenState;
  lives: LivesState;
  mailbox: MailMessage[];
  dailyCompletedToday: boolean;
  soundOn: boolean;
  hapticsOn: boolean;
  /** Invest the player's crowns into the current garden area. */
  onInvestGarden: () => void;
  onPlay: (stage: number, mode: GameMode) => void;
  onClaimMail: (id: string) => void;
  onToggleSound: (next: boolean) => void;
  onToggleHaptics: (next: boolean) => void;
  onResetTutorial?: () => void;
  /** DEV-only: add crowns for debugging. */
  onDebugAddCrowns?: (amount: number) => void;
}

export default function MainMenu({
  crowns, gardenState, lives, mailbox, dailyCompletedToday,
  soundOn, hapticsOn,
  onInvestGarden, onPlay, onClaimMail,
  onToggleSound, onToggleHaptics, onResetTutorial, onDebugAddCrowns,
}: Props) {
  const [endlessStage, setEndlessStage] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  const crownBump = useRef(new Animated.Value(1)).current;
  const heartBump = useRef(new Animated.Value(1)).current;
  const mailBump = useRef(new Animated.Value(1)).current;
  const isFirstCrownRef = useRef(true);
  const isFirstLivesRef = useRef(true);

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

  // Drives the lives countdown and the daily challenge "next reset" label.
  // 1s tick is cheap and only runs while the menu is mounted.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (isFirstCrownRef.current) { isFirstCrownRef.current = false; return; }
    crownBump.setValue(1.7);
    Animated.spring(crownBump, { toValue: 1, friction: 3, tension: 350, useNativeDriver: true }).start();
  }, [crowns]);

  useEffect(() => {
    if (isFirstLivesRef.current) { isFirstLivesRef.current = false; return; }
    heartBump.setValue(1.5);
    Animated.spring(heartBump, { toValue: 1, friction: 3, tension: 350, useNativeDriver: true }).start();
  }, [lives.count]);

  const unread = unreadCount(mailbox);
  useEffect(() => {
    if (unread > 0) {
      Animated.sequence([
        Animated.timing(mailBump, { toValue: 1.15, duration: 220, useNativeDriver: true }),
        Animated.spring(mailBump, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [unread]);

  const sceneIndex = stageImageIndex(gardenState);
  const canPlay = lives.count > 0;
  const livesCountdownMs = msUntilNextLife(lives, now);
  const livesCountdown = livesCountdownMs > 0 ? formatCountdown(livesCountdownMs) : null;
  const dailyResetIn = formatHMS(msUntilTomorrow(now));

  return (
    <SceneBackground index={sceneIndex} style={ms.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Ambient life drifts across the whole scene */}
      <AmbientLife w={SCREEN_W} h={SCREEN_H} />

      {/* ── Top-left cluster: settings + lives ───────────────────────────── */}
      <View style={ms.topLeft}>
        <TouchableOpacity
          style={ms.iconBtn}
          onPress={() => setSettingsOpen(true)}
          activeOpacity={0.75}
          hitSlop={8}
        >
          <Text style={ms.iconBtnGlyph}>⚙</Text>
        </TouchableOpacity>

        <Animated.View style={[ms.livesPill, { transform: [{ scale: heartBump }] }]}>
          <Text style={ms.heartGlyph}>❤️</Text>
          <Text style={ms.livesCount}>{lives.count}</Text>
          <Text style={ms.livesMax}>/{MAX_LIVES}</Text>
          {livesCountdown && (
            <Text style={ms.livesTimer}>  {livesCountdown}</Text>
          )}
        </Animated.View>
      </View>

      {/* ── Top-right cluster: mailbox + crowns ──────────────────────────── */}
      <View style={ms.topRight}>
        <Animated.View style={{ transform: [{ scale: mailBump }] }}>
          <TouchableOpacity
            style={ms.iconBtn}
            onPress={() => setMailOpen(true)}
            activeOpacity={0.75}
            hitSlop={8}
          >
            <Text style={ms.iconBtnGlyph}>✉️</Text>
            {unread > 0 && (
              <View style={ms.badge}>
                <Text style={ms.badgeText}>{unread > 9 ? "9+" : unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          style={ms.crownPill}
          activeOpacity={__DEV__ ? 0.7 : 1}
          onPress={() => { if (__DEV__) onDebugAddCrowns?.(10); }}
        >
          <Text style={ms.crownEmoji}>👑</Text>
          <Animated.Text style={[ms.crownCount, { transform: [{ scale: crownBump }] }]}>
            {crowns}
          </Animated.Text>
        </TouchableOpacity>
      </View>

      {/* Bottom UI floats over the garden background */}
      <Animated.View
        style={[ms.bottom, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        <Garden
          crowns={crowns}
          gardenState={gardenState}
          onInvest={onInvestGarden}
        />

        {/* ── Daily challenge card ──────────────────────────────────────── */}
        <DailyChallengeCard
          completed={dailyCompletedToday}
          resetIn={dailyResetIn}
          disabled={!canPlay}
          onPress={() => canPlay && onPlay(endlessStage, "endless")}
        />

        {/* ── Play button (gated on lives) ──────────────────────────────── */}
        <TouchableOpacity
          style={[ms.playBtn, !canPlay && ms.playBtnDisabled]}
          onPress={() => canPlay && onPlay(endlessStage, "endless")}
          activeOpacity={canPlay ? 0.82 : 1}
        >
          <View style={{ alignItems: "flex-start" }}>
            <Text style={ms.playBtnText}>
              {canPlay ? (endlessStage > 1 ? "Continue" : "Play") : "Out of lives"}
            </Text>
            {canPlay && endlessStage > 1 && (
              <Text style={ms.playBtnSub}>Stage {endlessStage} · earn crowns to grow</Text>
            )}
            {!canPlay && livesCountdown && (
              <Text style={ms.playBtnSub}>Next heart in {livesCountdown}</Text>
            )}
          </View>
          <Text style={ms.playBtnArrow}>{canPlay ? "→" : "❤"}</Text>
        </TouchableOpacity>
      </Animated.View>

      <Settings
        visible={settingsOpen}
        soundOn={soundOn}
        hapticsOn={hapticsOn}
        onToggleSound={onToggleSound}
        onToggleHaptics={onToggleHaptics}
        onResetTutorial={onResetTutorial}
        onClose={() => setSettingsOpen(false)}
      />

      <Mailbox
        visible={mailOpen}
        messages={mailbox}
        onClaim={onClaimMail}
        onClose={() => setMailOpen(false)}
      />
    </SceneBackground>
  );
}

// ─── Daily challenge card ─────────────────────────────────────────────────────

function DailyChallengeCard({
  completed, resetIn, disabled, onPress,
}: {
  completed: boolean;
  resetIn: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[ms.dailyCard, completed && ms.dailyCardDone]}
      activeOpacity={completed || disabled ? 1 : 0.85}
      onPress={completed || disabled ? undefined : onPress}
    >
      <View style={ms.dailyIconWrap}>
        <Text style={ms.dailyIcon}>{completed ? "✓" : "🎯"}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ms.dailyTitle}>Daily Challenge</Text>
        {completed ? (
          <Text style={ms.dailySub}>Done · resets in {resetIn}</Text>
        ) : (
          <Text style={ms.dailySub}>
            Play one stage today · +{DAILY_BONUS_CROWNS} 👑 · +{DAILY_BONUS_LIVES} ❤
          </Text>
        )}
      </View>
      {!completed && !disabled && <Text style={ms.dailyChevron}>→</Text>}
    </TouchableOpacity>
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

const TOP_OFFSET = Platform.OS === "android" ? 56 : 72;

const ms = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  topLeft: {
    position: "absolute",
    top: TOP_OFFSET,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 10,
  },
  topRight: {
    position: "absolute",
    top: TOP_OFFSET,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 10,
  },

  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(26,29,46,0.08)",
    shadowColor: "rgba(26,29,46,1)",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  iconBtnGlyph: { fontSize: 18, color: C.ink },

  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.coral,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.white,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },

  livesPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.white,
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(26,29,46,0.08)",
    shadowColor: "rgba(26,29,46,1)",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  heartGlyph: { fontSize: 14, marginRight: 5 },
  livesCount: { fontSize: 15, fontWeight: "900", color: C.ink },
  livesMax: { fontSize: 12, fontWeight: "700", color: C.inkSoft, marginLeft: 1 },
  livesTimer: { fontSize: 12, fontWeight: "700", color: C.inkSoft, fontVariant: ["tabular-nums"] },

  crownPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.white,
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(26,29,46,0.08)",
    shadowColor: "rgba(26,29,46,1)",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  crownEmoji: { fontSize: 15 },
  crownCount: { fontSize: 15, fontWeight: "900", color: C.ink },

  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingBottom: Platform.OS === "android" ? 28 : 40,
    gap: 12,
  },

  dailyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.white,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(26,29,46,0.08)",
    shadowColor: "rgba(26,29,46,1)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  dailyCardDone: {
    opacity: 0.85,
  },
  dailyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.tealSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  dailyIcon: { fontSize: 18, color: C.teal, fontWeight: "900" },
  dailyTitle: { fontSize: 14, fontWeight: "900", color: C.ink, letterSpacing: 0.2 },
  dailySub: { fontSize: 12, color: C.inkSoft, marginTop: 2 },
  dailyChevron: { fontSize: 18, color: C.inkSoft, fontWeight: "600" },

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
  playBtnDisabled: {
    backgroundColor: C.ghost,
    shadowColor: "rgba(26,29,46,1)",
    shadowOpacity: 0.2,
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
});
