import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, AppState, StatusBar, Platform, Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GameMode } from "../App";
import { GardenState, stageImageIndex } from "./gardenData";
import Garden, { AmbientLife } from "./Garden";
import {
  LivesState, MAX_LIVES, msUntilNextLife, formatCountdown,
} from "./livesData";
import {
  msUntilTomorrow, formatHMS, todayKey,
  DailyChallengeProgress, challengeTarget, todaysChallenge,
} from "./dailyChallenge";
import { MailMessage, unreadCount } from "./mailboxData";
import { DailyLoginState, canClaimToday } from "./dailyLogin";
import { Boosters } from "./boosters";
import Settings from "./Settings";
import Mailbox from "./Mailbox";
import DailyLogin from "./DailyLogin";
import BoosterSheet from "./BoosterSheet";
import SideBadge from "./SideBadge";

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
  golden: "#d9a648",
};

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  crowns: number;
  gardenState: GardenState;
  lives: LivesState;
  mailbox: MailMessage[];
  dailyCompletedToday: boolean;
  dailyChallenge: DailyChallengeProgress;
  dailyLogin: DailyLoginState;
  boosters: Boosters;
  goldenStage: number;
  freezeStage: number;
  soundOn: boolean;
  hapticsOn: boolean;
  notifyOn: boolean;
  /** Invest the player's crowns into the current garden area. */
  onInvestGarden: () => void;
  onPlay: (stage: number, mode: GameMode) => void;
  onClaimMail: (id: string) => void;
  onOpenMailbox: () => void;
  onClaimDailyLogin: () => void;
  openModal: "daily-login" | null;
  onModalConsumed: () => void;
  onBuyBooster: (key: "hint" | "addrow") => void;
  onToggleSound: (next: boolean) => void;
  onToggleHaptics: (next: boolean) => void;
  onToggleNotifications: (next: boolean) => void;
  onDeleteAllData: () => void;
  onResetTutorial?: () => void;
  /** DEV-only: add crowns for debugging. */
  onDebugAddCrowns?: (amount: number) => void;
}

export default function MainMenu({
  crowns, gardenState, lives, mailbox, dailyCompletedToday,
  dailyChallenge,
  dailyLogin, boosters, goldenStage, freezeStage,
  soundOn, hapticsOn, notifyOn,
  onInvestGarden, onPlay, onClaimMail, onOpenMailbox, onClaimDailyLogin, onBuyBooster,
  openModal, onModalConsumed,
  onToggleSound, onToggleHaptics, onToggleNotifications,
  onDeleteAllData, onResetTutorial, onDebugAddCrowns,
}: Props) {
  const [endlessStage, setEndlessStage] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [dailyLoginOpen, setDailyLoginOpen] = useState(false);
  const [boosterOpen, setBoosterOpen] = useState(false);
  const dailyAutoPoppedRef = useRef(false);
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
  const railFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 11, useNativeDriver: true }),
      Animated.timing(railFade, { toValue: 1, duration: 600, delay: 180, useNativeDriver: true }),
    ]).start();
  }, []);

  // Drives the lives countdown and the daily challenge "next reset" label.
  // Paused while backgrounded — the labels are derived from Date.now(), so a
  // single update on foreground snaps the display back to current.
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id !== null) return;
      setNow(Date.now());
      id = setInterval(() => setNow(Date.now()), 1000);
    };
    const stop = () => {
      if (id !== null) { clearInterval(id); id = null; }
    };

    if (AppState.currentState === "active") start();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") start(); else stop();
    });
    return () => { stop(); sub.remove(); };
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

  // Auto-pop the daily reward modal once per session if the player can claim.
  // Standard hybrid-casual onboarding moment — fast dopamine on app open.
  const dailyClaimable = canClaimToday(dailyLogin);
  useEffect(() => {
    if (dailyClaimable && !dailyAutoPoppedRef.current) {
      dailyAutoPoppedRef.current = true;
      const t = setTimeout(() => setDailyLoginOpen(true), 450);
      return () => clearTimeout(t);
    }
  }, [dailyClaimable]);

  // A notification tap asked us to open the daily-reward modal.
  useEffect(() => {
    if (openModal === "daily-login") {
      setDailyLoginOpen(true);
      onModalConsumed();
    }
  }, [openModal]);

  // Daily-challenge badge: progress chip ("3/12" / "Score 200" / "Beat 90s").
  // Derived from the ticking `now` so a session that crosses midnight rolls over.
  const todayKeyNow = todayKey(now);
  const challengeDef = todaysChallenge(todayKeyNow);
  const challengeTargetN = challengeTarget(challengeDef);
  const challengeCurrent = dailyChallenge.date === todayKeyNow
    ? Math.min(dailyChallenge.progress, challengeTargetN)
    : 0;
  const challengeChip = dailyCompletedToday
    ? undefined
    : challengeDef.kind === "speed"
      ? challengeDef.short
      : `${challengeCurrent}/${challengeTargetN}`;

  const sceneIndex = stageImageIndex(gardenState);
  const canPlay = lives.count > 0;
  const livesCountdownMs = msUntilNextLife(lives, now);
  const livesCountdown = livesCountdownMs > 0 ? formatCountdown(livesCountdownMs) : null;
  const dailyResetIn = formatHMS(msUntilTomorrow(now));
  const totalBoosters = boosters.hint + boosters.addrow;

  return (
    <SceneBackground index={sceneIndex} style={ms.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Ambient life drifts across the whole scene */}
      <AmbientLife w={SCREEN_W} h={SCREEN_H} />

      {/* ── Top-left cluster: lives + crowns (resources) ─────────────────── */}
      <View style={ms.topLeft}>
        <Animated.View style={[ms.livesPill, { transform: [{ scale: heartBump }] }]}>
          <Text style={ms.heartGlyph}>❤️</Text>
          <Text style={ms.livesCount}>{lives.count}</Text>
          <Text style={ms.livesMax}>/{MAX_LIVES}</Text>
          {livesCountdown && (
            <Text style={ms.livesTimer}>  {livesCountdown}</Text>
          )}
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

      {/* ── Top-right cluster: mailbox + settings ────────────────────────── */}
      <View style={ms.topRight}>
        <Animated.View style={{ transform: [{ scale: mailBump }] }}>
          <TouchableOpacity
            style={ms.iconBtn}
            onPress={() => { onOpenMailbox(); setMailOpen(true); }}
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
          style={ms.iconBtn}
          onPress={() => setSettingsOpen(true)}
          activeOpacity={0.75}
          hitSlop={8}
        >
          <Text style={ms.iconBtnGlyph}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* ── Left rail: time-gated events ─────────────────────────────────── */}
      <Animated.View
        style={[ms.leftRail, { opacity: railFade, transform: [{ translateX: railFade.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }] }]}
        pointerEvents="box-none"
      >
        {dailyClaimable && (
          <SideBadge
            icon="🎁"
            label="Daily"
            tint={C.crown}
            dot
            pulse
            onPress={() => setDailyLoginOpen(true)}
          />
        )}
        <SideBadge
          icon="🎯"
          label="Challenge"
          chip={challengeChip}
          tint={C.teal}
          chipColor={C.teal}
          done={dailyCompletedToday}
          dot={!dailyCompletedToday}
          disabled={!canPlay}
          onPress={() => onPlay(endlessStage, "endless")}
        />
      </Animated.View>

      {/* ── Right rail: game modes + shop ────────────────────────────────── */}
      <Animated.View
        style={[ms.rightRail, { opacity: railFade, transform: [{ translateX: railFade.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}
        pointerEvents="box-none"
      >
        <SideBadge
          icon="💎"
          label="Golden"
          chip={`S${goldenStage}`}
          tint={C.golden}
          chipColor={C.golden}
          disabled={!canPlay}
          onPress={() => onPlay(goldenStage, "golden")}
        />
        <SideBadge
          icon="⚡"
          label="Time"
          chip="60s"
          tint={C.coral}
          chipColor={C.coral}
          disabled={!canPlay}
          onPress={() => onPlay(1, "timeattack")}
        />
        <SideBadge
          icon="🧊"
          label="Freeze"
          chip={`S${freezeStage}`}
          tint={C.freeze}
          chipColor={C.freeze}
          disabled={!canPlay}
          onPress={() => onPlay(freezeStage, "freeze")}
        />
        <SideBadge
          icon="🛒"
          label="Shop"
          chip={totalBoosters > 0 ? `×${totalBoosters}` : undefined}
          tint={C.ink}
          onPress={() => setBoosterOpen(true)}
        />
      </Animated.View>

      {/* ── Bottom: garden card + dominant play button ───────────────────── */}
      <Animated.View
        style={[ms.bottom, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        <Garden
          crowns={crowns}
          gardenState={gardenState}
          onInvest={onInvestGarden}
        />

        <TouchableOpacity
          style={[ms.playBtn, !canPlay && ms.playBtnDisabled]}
          onPress={() => canPlay && onPlay(endlessStage, "endless")}
          activeOpacity={canPlay ? 0.82 : 1}
        >
          <View style={ms.playBtnInner}>
            <Text style={ms.playBtnText}>
              {canPlay ? (endlessStage > 1 ? "CONTINUE" : "PLAY") : "OUT OF LIVES"}
            </Text>
            <Text style={ms.playBtnSub}>
              {canPlay
                ? (endlessStage > 1 ? `Stage ${endlessStage}` : "Tap to start")
                : livesCountdown ? `Next heart in ${livesCountdown}` : "Wait for hearts"}
            </Text>
          </View>
          <View style={ms.playBtnArrowWrap}>
            <Text style={ms.playBtnArrow}>{canPlay ? "▶" : "❤"}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      <Settings
        visible={settingsOpen}
        soundOn={soundOn}
        hapticsOn={hapticsOn}
        notifyOn={notifyOn}
        onToggleSound={onToggleSound}
        onToggleHaptics={onToggleHaptics}
        onToggleNotifications={onToggleNotifications}
        onDeleteAllData={onDeleteAllData}
        onResetTutorial={onResetTutorial}
        onClose={() => setSettingsOpen(false)}
      />

      <Mailbox
        visible={mailOpen}
        messages={mailbox}
        onClaim={onClaimMail}
        onClose={() => setMailOpen(false)}
      />

      <DailyLogin
        visible={dailyLoginOpen}
        state={dailyLogin}
        onClaim={() => {
          onClaimDailyLogin();
          // Leave the modal open so the user sees the "Claimed today" state,
          // then auto-dismiss after a beat.
          setTimeout(() => setDailyLoginOpen(false), 900);
        }}
        onClose={() => setDailyLoginOpen(false)}
      />

      <BoosterSheet
        visible={boosterOpen}
        boosters={boosters}
        crowns={crowns}
        onBuy={onBuyBooster}
        onClose={() => setBoosterOpen(false)}
      />
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

const TOP_OFFSET = Platform.OS === "android" ? 56 : 72;
// Side rails sit above the bottom UI (garden card + play button + padding).
const RAIL_BOTTOM = Platform.OS === "android" ? 250 : 262;

const ms = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  topLeft: {
    position: "absolute",
    top: TOP_OFFSET,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 10,
  },
  topRight: {
    position: "absolute",
    top: TOP_OFFSET,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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

  leftRail: {
    position: "absolute",
    left: 12,
    bottom: RAIL_BOTTOM,
    gap: 10,
    zIndex: 9,
  },
  rightRail: {
    position: "absolute",
    right: 12,
    bottom: RAIL_BOTTOM,
    gap: 10,
    zIndex: 9,
  },

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
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    shadowColor: C.coral,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
  playBtnDisabled: {
    backgroundColor: C.ghost,
    shadowColor: "rgba(26,29,46,1)",
    shadowOpacity: 0.2,
  },
  playBtnInner: { flex: 1, alignItems: "flex-start" },
  playBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 22,
    letterSpacing: 1.2,
  },
  playBtnSub: {
    color: "rgba(255,255,255,0.78)",
    fontWeight: "700",
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  playBtnArrowWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  playBtnArrow: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
    marginLeft: 2,
  },
});
