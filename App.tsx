// Garden meta: restore-the-garden progression
import React, { useState, useEffect, useRef } from "react";
import { Animated, AppState, View } from "react-native";
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
import {
  DailyLoginState, defaultDailyLogin, normalizeDailyLogin, claim as claimDailyLogin,
} from "./screens/dailyLogin";
import {
  Boosters, defaultBoosters, normalizeBoosters, BOOSTER_COST, MAX_BOOSTERS,
} from "./screens/boosters";
import { setMuted } from "./screens/sound";
import {
  requestPermission, scheduleLivesFull, scheduleDailyChallenge, scheduleDailyLogin,
} from "./screens/notifications";

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
  const [dailyLogin, setDailyLogin] = useState<DailyLoginState>(defaultDailyLogin);
  const [boosters, setBoosters] = useState<Boosters>(defaultBoosters);
  // Boosters spent on a run, handed to GameScreen on mount and zeroed in storage
  // so they don't double-apply. Read only inside the game screen.
  const [bonusBoosters, setBonusBoosters] = useState<Boosters>(defaultBoosters);
  const [goldenStage, setGoldenStage] = useState(1);
  const [freezeStage, setFreezeStage] = useState(1);
  const [soundOn, setSoundOn] = useState(true);
  const [hapticsOn, setHapticsOn] = useState(true);
  const [notifyOn, setNotifyOn] = useState(true);
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
      AsyncStorage.getItem("daily_login_state"),
      AsyncStorage.getItem("boosters"),
      AsyncStorage.getItem("golden_stage"),
      AsyncStorage.getItem("freeze_stage"),
      AsyncStorage.getItem("sound_muted"),
      AsyncStorage.getItem("haptics_enabled"),
      AsyncStorage.getItem("notifications_enabled"),
    ]).then(([
      crownVal, onboardingDone, gardenVal,
      livesVal, mailVal, mailSeeded, dailyVal,
      loginVal, boosterVal, goldenVal, freezeVal,
      soundMuted, hapticsEnabled, notifyEnabled,
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
      if (loginVal) {
        try { setDailyLogin(normalizeDailyLogin(JSON.parse(loginVal))); } catch {}
      }
      if (boosterVal) {
        try { setBoosters(normalizeBoosters(JSON.parse(boosterVal))); } catch {}
      }
      if (goldenVal) setGoldenStage(Math.max(1, parseInt(goldenVal, 10) || 1));
      if (freezeVal) setFreezeStage(Math.max(1, parseInt(freezeVal, 10) || 1));

      const soundEnabled = soundMuted !== "1";
      setSoundOn(soundEnabled);
      setMuted(!soundEnabled);
      setHapticsOn(hapticsEnabled !== "0");
      setNotifyOn(notifyEnabled !== "0");

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

  useEffect(() => {
    if (loaded) AsyncStorage.setItem("daily_login_state", JSON.stringify(dailyLogin));
  }, [dailyLogin, loaded]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem("boosters", JSON.stringify(boosters));
  }, [boosters, loaded]);

  // Wall-clock lives regen. The interval only runs while the app is active so we
  // don't burn battery in the background; the regen math reads Date.now() so a
  // single tick on foreground catches up however long we were away.
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      setLives((prev) => {
        const next = tickRegen(prev);
        return next === prev ? prev : next;
      });
    };
    const start = () => {
      if (id !== null) return;
      tick();
      id = setInterval(tick, 1000);
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

  // Keep scheduled notifications in sync with the current state. cancel-and-
  // reschedule is cheap and avoids stale fires when lives top up or the daily
  // challenge gets completed.
  useEffect(() => {
    if (!loaded || needsTutorial) return;
    scheduleLivesFull(lives, notifyOn);
  }, [lives, notifyOn, loaded, needsTutorial]);

  useEffect(() => {
    if (!loaded || needsTutorial) return;
    scheduleDailyChallenge(dailyDate === todayKey(), notifyOn);
    scheduleDailyLogin(notifyOn);
  }, [dailyDate, notifyOn, loaded, needsTutorial]);

  // Ask for permission once after the tutorial is done. Denial is sticky — we
  // won't pester the user again unless they flip the toggle in Settings.
  useEffect(() => {
    if (!loaded || needsTutorial || !notifyOn) return;
    (async () => {
      const asked = await AsyncStorage.getItem("notifications_asked");
      if (asked === "1") return;
      const granted = await requestPermission();
      AsyncStorage.setItem("notifications_asked", "1").catch(() => {});
      if (!granted) {
        setNotifyOn(false);
        AsyncStorage.setItem("notifications_enabled", "0").catch(() => {});
      }
    })();
  }, [loaded, needsTutorial, notifyOn]);

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

  function handleClaimDailyLogin() {
    const { next, reward } = claimDailyLogin(dailyLogin);
    if (!reward) return;
    setDailyLogin(next);
    if (reward.crowns) setCrowns((c) => c + (reward.crowns ?? 0));
    if (reward.lives) setLives((l) => grantLives(l, reward.lives ?? 0));
  }

  function handleBuyBooster(key: "hint" | "addrow") {
    const cost = BOOSTER_COST[key];
    if (crowns < cost) return;
    if (boosters[key] >= MAX_BOOSTERS) return;
    setCrowns((c) => c - cost);
    setBoosters((b) => ({ ...b, [key]: b[key] + 1 }));
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

  function handleToggleNotifications(next: boolean) {
    setNotifyOn(next);
    AsyncStorage.setItem("notifications_enabled", next ? "1" : "0").catch(() => {});
    if (next) requestPermission().catch(() => {});
  }

  // Per-mode stage updates pushed up from GameScreen so the menu tiles stay
  // accurate without it having to peek at AsyncStorage on every focus.
  function handleStageAdvance(m: GameMode, stage: number) {
    if (m === "golden") {
      setGoldenStage((prev) => {
        const next = Math.max(prev, stage);
        if (next !== prev) AsyncStorage.setItem("golden_stage", String(next)).catch(() => {});
        return next;
      });
    } else if (m === "freeze") {
      setFreezeStage((prev) => {
        const next = Math.max(prev, stage);
        if (next !== prev) AsyncStorage.setItem("freeze_stage", String(next)).catch(() => {});
        return next;
      });
    }
  }

  function navigateTo(newScreen: Screen, stage = 1, m: GameMode = "endless") {
    // Intercept any game navigation if tutorial hasn't been completed yet
    const effectiveMode = (newScreen === "game" && needsTutorial && m !== "tutorial") ? "tutorial" : m;
    const effectiveStage = effectiveMode === "tutorial" ? 1 : stage;
    // Real runs cost one life. Tutorial is free so onboarding can't hard-block.
    if (newScreen === "game" && effectiveMode !== "tutorial") {
      if (lives.count <= 0) return;
      setLives((l) => spendLife(l));
      // Hand off owned boosters once. Zeroing here means a tap to "Continue" on
      // the same run can't double-use them.
      setBonusBoosters(boosters);
      setBoosters(defaultBoosters());
    } else {
      setBonusBoosters(defaultBoosters());
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
    setDailyLogin(defaultDailyLogin());
    setBoosters(defaultBoosters());
    setGoldenStage(1);
    setFreezeStage(1);
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
          bonusHints={bonusBoosters.hint}
          bonusAdds={bonusBoosters.addrow}
          onCrownsEarned={handleCrownsEarned}
          onStageAdvance={handleStageAdvance}
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
          dailyLogin={dailyLogin}
          boosters={boosters}
          goldenStage={goldenStage}
          freezeStage={freezeStage}
          soundOn={soundOn}
          hapticsOn={hapticsOn}
          notifyOn={notifyOn}
          onInvestGarden={handleInvestGarden}
          onDebugAddCrowns={(amount) => setCrowns((c) => c + amount)}
          onPlay={(stage, m) => navigateTo("game", stage, m)}
          onClaimMail={handleClaimMail}
          onClaimDailyLogin={handleClaimDailyLogin}
          onBuyBooster={handleBuyBooster}
          onToggleSound={handleToggleSound}
          onToggleHaptics={handleToggleHaptics}
          onToggleNotifications={handleToggleNotifications}
          onResetTutorial={handleResetTutorial}
        />
      )}
    </Animated.View>
    </GestureHandlerRootView>
  );
}
