// Garden meta: restore-the-garden progression
import React, { useState, useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MainMenu from "./screens/MainMenu";
import GameScreen from "./screens/GameScreen";
import SplashScreen from "./screens/SplashScreen";
import { GardenState, defaultGardenState, normalizeGardenState, investCrowns } from "./screens/gardenData";
import {
  LivesState, defaultLivesState, normalizeLivesState,
  tickRegen, spendLife, grantLives,
} from "./screens/livesData";
import {
  MailMessage, normalizeMailbox, todaysSeed, pushMessage,
} from "./screens/mailboxData";
import {
  todayKey, DAILY_BONUS_CROWNS, DAILY_BONUS_LIVES,
} from "./screens/dailyChallenge";
import { setMuted } from "./screens/sound";

type Screen = "menu" | "game";
export type GameMode = "endless" | "golden" | "timeattack" | "freeze" | "tutorial";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [currentStage, setCurrentStage] = useState(1);
  const [mode, setMode] = useState<GameMode>("endless");
  const [crowns, setCrowns] = useState(0);
  const [gardenState, setGardenState] = useState<GardenState>(defaultGardenState);
  const [lives, setLives] = useState<LivesState>(defaultLivesState);
  const [mailbox, setMailbox] = useState<MailMessage[]>([]);
  const [dailyDate, setDailyDate] = useState<string>("");
  const [soundOn, setSoundOn] = useState(true);
  const [hapticsOn, setHapticsOn] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [needsTutorial, setNeedsTutorial] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("crowns"),
      AsyncStorage.getItem("onboarding_done"),
      AsyncStorage.getItem("garden_state"),
      AsyncStorage.getItem("lives_state"),
      AsyncStorage.getItem("mailbox"),
      AsyncStorage.getItem("mailbox_seeded"),
      AsyncStorage.getItem("daily_challenge_date"),
      AsyncStorage.getItem("sound_muted"),
      AsyncStorage.getItem("haptics_enabled"),
    ]).then(([
      crownVal, onboardingDone, gardenVal,
      livesVal, mailVal, mailSeeded, dailyVal,
      soundMuted, hapticsEnabled,
    ]) => {
      if (crownVal !== null) setCrowns(parseInt(crownVal, 10));
      if (gardenVal) {
        try { setGardenState(normalizeGardenState(JSON.parse(gardenVal))); } catch {}
      }
      if (livesVal) {
        try { setLives(tickRegen(normalizeLivesState(JSON.parse(livesVal)))); } catch {}
      }
      if (mailSeeded !== "1") {
        setMailbox(todaysSeed());
        AsyncStorage.setItem("mailbox_seeded", "1").catch(() => {});
      } else if (mailVal) {
        try { setMailbox(normalizeMailbox(JSON.parse(mailVal))); } catch {}
      }
      if (dailyVal) setDailyDate(dailyVal);

      const soundEnabled = soundMuted !== "1";
      setSoundOn(soundEnabled);
      setMuted(!soundEnabled);
      setHapticsOn(hapticsEnabled !== "0");

      if (onboardingDone !== "1") {
        setNeedsTutorial(true);
        setMode("tutorial");
        setScreen("game");
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem("crowns", String(crowns));
  }, [crowns, loaded]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem("garden_state", JSON.stringify(gardenState));
  }, [gardenState, loaded]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem("lives_state", JSON.stringify(lives));
  }, [lives, loaded]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem("mailbox", JSON.stringify(mailbox));
  }, [mailbox, loaded]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem("daily_challenge_date", dailyDate);
  }, [dailyDate, loaded]);

  // Wall-clock lives regen. 1s cadence keeps the timer display in step with the
  // menu, and the setter is a no-op when nothing changed.
  useEffect(() => {
    const id = setInterval(() => {
      setLives((prev) => {
        const next = tickRegen(prev);
        return next === prev ? prev : next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  function handleInvestGarden() {
    const result = investCrowns(gardenState, crowns);
    if (result.spent > 0) {
      setCrowns((c) => Math.max(0, c - result.spent));
      setGardenState(result.next);
    }
  }

  // First crown of the day from a real run satisfies the daily challenge.
  // The bonus is delivered to the mailbox so the player sees it on return.
  function handleCrownsEarned(amount: number) {
    setCrowns((c) => c + amount);
    if (mode === "tutorial") return;
    const today = todayKey();
    if (dailyDate !== today) {
      setDailyDate(today);
      setLives((l) => grantLives(l, DAILY_BONUS_LIVES));
      setCrowns((c) => c + DAILY_BONUS_CROWNS);
      setMailbox((box) => pushMessage(box, {
        id: `daily-${today}`,
        title: "Daily Challenge complete",
        body: "Nice work — your bonus has been added to your wallet.",
        reward: { crowns: DAILY_BONUS_CROWNS, lives: DAILY_BONUS_LIVES },
        claimed: true,
      }));
    }
  }

  function handleClaimMail(id: string) {
    setMailbox((box) => {
      const target = box.find((m) => m.id === id);
      if (!target || target.claimed) return box.map((m) => (m.id === id ? { ...m, read: true } : m));
      if (target.reward?.crowns) setCrowns((c) => c + (target.reward!.crowns ?? 0));
      if (target.reward?.lives) setLives((l) => grantLives(l, target.reward!.lives ?? 0));
      return box.map((m) => (m.id === id ? { ...m, claimed: true, read: true } : m));
    });
  }

  function handleToggleSound(next: boolean) {
    setSoundOn(next);
    setMuted(!next);
    AsyncStorage.setItem("sound_muted", next ? "0" : "1").catch(() => {});
  }

  function handleToggleHaptics(next: boolean) {
    setHapticsOn(next);
    AsyncStorage.setItem("haptics_enabled", next ? "1" : "0").catch(() => {});
  }

  function navigateTo(newScreen: Screen, stage = 1, m: GameMode = "endless") {
    // Intercept any game navigation if tutorial hasn't been completed yet
    const effectiveMode = (newScreen === "game" && needsTutorial && m !== "tutorial") ? "tutorial" : m;
    const effectiveStage = effectiveMode === "tutorial" ? 1 : stage;
    // Real runs cost one life. Tutorial is free so onboarding can't hard-block.
    if (newScreen === "game" && effectiveMode !== "tutorial") {
      if (lives.count <= 0) return;
      setLives((l) => spendLife(l));
    }
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setCurrentStage(effectiveStage);
      setMode(effectiveMode);
      setScreen(newScreen);
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    });
  }

  function handleTutorialComplete() {
    setNeedsTutorial(false);
    AsyncStorage.setItem("onboarding_done", "1");
    navigateTo("menu");
  }

  async function handleResetTutorial() {
    // DEV: wipe ALL persisted game data (crowns, garden, high scores,
    // endless progress, golden completions, onboarding) and reset memory.
    try { await AsyncStorage.clear(); } catch {}
    setCrowns(0);
    setGardenState(defaultGardenState());
    setLives(defaultLivesState());
    setMailbox(todaysSeed());
    setDailyDate("");
    AsyncStorage.setItem("mailbox_seeded", "1").catch(() => {});
    setNeedsTutorial(true);
    navigateTo("game", 1, "tutorial");
  }

  if (!splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)} />;
  }

  if (!loaded) return <View style={{ flex: 1, backgroundColor: "#f5efe6" }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
      {screen === "game" ? (
        <GameScreen
          initialStage={currentStage}
          mode={mode}
          crowns={crowns}
          onCrownsEarned={handleCrownsEarned}
          onBack={() => navigateTo("menu")}
          onTutorialComplete={handleTutorialComplete}
        />
      ) : (
        <MainMenu
          crowns={crowns}
          gardenState={gardenState}
          lives={lives}
          mailbox={mailbox}
          dailyCompletedToday={dailyDate === todayKey()}
          soundOn={soundOn}
          hapticsOn={hapticsOn}
          onInvestGarden={handleInvestGarden}
          onDebugAddCrowns={(amount) => setCrowns((c) => c + amount)}
          onPlay={(stage, m) => navigateTo("game", stage, m)}
          onClaimMail={handleClaimMail}
          onToggleSound={handleToggleSound}
          onToggleHaptics={handleToggleHaptics}
          onResetTutorial={handleResetTutorial}
        />
      )}
    </Animated.View>
    </GestureHandlerRootView>
  );
}
