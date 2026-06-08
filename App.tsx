// Garden meta: restore-the-garden progression
import React, { useState, useEffect, useRef } from "react";
import { Animated, AppState, View, Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MainMenu from "./screens/MainMenu";
import GameScreen from "./screens/GameScreen";
import NumberSortScreen from "./screens/NumberSortScreen";
import SplashScreen from "./screens/SplashScreen";
import { GardenState, defaultGardenState, normalizeGardenState, investCrowns } from "./screens/gardenData";
import {
  LivesState, defaultLivesState, normalizeLivesState,
  tickRegen, spendLife, grantLives,
} from "./screens/livesData";
import {
  MailMessage, normalizeMailbox, todaysSeed, pushMessage, pruneMailbox,
} from "./screens/mailboxData";
import {
  todayKey, DAILY_BONUS_CROWNS, DAILY_BONUS_LIVES,
  DailyChallengeProgress, defaultChallengeProgress, normalizeChallengeProgress,
  applyStageStat, StageStat, todaysChallenge,
} from "./screens/dailyChallenge";
import {
  DailyLoginState, defaultDailyLogin, normalizeDailyLogin, claim as claimDailyLogin,
} from "./screens/dailyLogin";
import {
  Boosters, defaultBoosters, normalizeBoosters, grantBoosters, BOOSTER_COST, MAX_BOOSTERS,
} from "./screens/boosters";
import { showRewarded, isRewardedReady } from "./screens/adManager";
import { setMuted, disposeSounds } from "./screens/sound";
import {
  requestPermission, scheduleLivesFull, scheduleDailyChallenge, scheduleDailyLogin,
  getInitialDeepLink, addDeepLinkListener, DeepLink,
} from "./screens/notifications";
import { ensureSchemaVersion } from "./screens/storage";
import {
  initTelemetry, identify, track, screenView, captureError,
  onStorageError, flushTelemetry, withSentry,
} from "./screens/telemetry";
import { getInstallId } from "./screens/installId";
import ErrorBoundary from "./screens/ErrorBoundary";

// Initialize crash reporting + analytics as early as possible (before first render).
initTelemetry();

type Screen = "menu" | "game" | "sortlab";
export type GameMode = "endless" | "golden" | "timeattack" | "freeze" | "tutorial";

function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [currentStage, setCurrentStage] = useState(1);
  const [mode, setMode] = useState<GameMode>("endless");
  const [crowns, setCrowns] = useState(0);
  const [gardenState, setGardenState] = useState<GardenState>(defaultGardenState);
  const [lives, setLives] = useState<LivesState>(defaultLivesState);
  const [mailbox, setMailbox] = useState<MailMessage[]>([]);
  const [dailyDate, setDailyDate] = useState<string>("");
  const [dailyChallenge, setDailyChallenge] = useState<DailyChallengeProgress>(defaultChallengeProgress);
  const [dailyLogin, setDailyLogin] = useState<DailyLoginState>(defaultDailyLogin);
  // Set when a notification tap should auto-open a menu modal; consumed by MainMenu.
  const [menuDeepLink, setMenuDeepLink] = useState<"daily-login" | null>(null);
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
    // Run schema migrations BEFORE reading any persisted state (so a future
    // migration sees the old shape and the reads below see the new one).
    ensureSchemaVersion().then(() => Promise.all([
      AsyncStorage.getItem("crowns"),
      AsyncStorage.getItem("onboarding_done"),
      AsyncStorage.getItem("garden_state"),
      AsyncStorage.getItem("lives_state"),
      AsyncStorage.getItem("mailbox"),
      AsyncStorage.getItem("mailbox_seeded"),
      AsyncStorage.getItem("daily_challenge_date"),
      AsyncStorage.getItem("daily_challenge_progress"),
      AsyncStorage.getItem("daily_login_state"),
      AsyncStorage.getItem("boosters"),
      AsyncStorage.getItem("golden_stage"),
      AsyncStorage.getItem("freeze_stage"),
      AsyncStorage.getItem("sound_muted"),
      AsyncStorage.getItem("haptics_enabled"),
      AsyncStorage.getItem("notifications_enabled"),
    ])).then(([
      crownVal, onboardingDone, gardenVal,
      livesVal, mailVal, mailSeeded, dailyVal, dailyProgVal,
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
        AsyncStorage.setItem("mailbox_seeded", "1").catch(onStorageError("mailbox_seeded"));
      } else if (mailVal) {
        try { setMailbox(pruneMailbox(normalizeMailbox(JSON.parse(mailVal)))); } catch {}
      }
      if (dailyVal) setDailyDate(dailyVal);
      if (dailyProgVal) {
        try { setDailyChallenge(normalizeChallengeProgress(JSON.parse(dailyProgVal))); } catch {}
      }
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
    }).catch((e) => { captureError(e, { kind: "hydrate" }); setLoaded(true); });
  }, []);

  // Analytics: record app open and bind the anonymous install id.
  useEffect(() => {
    track("app_open");
    getInstallId()
      .then((id) => identify(id))
      .catch((e) => captureError(e, { kind: "install_id" }));
  }, []);

  // Fire a screen_view on the initial render and every screen change.
  useEffect(() => {
    if (loaded) screenView(screen);
  }, [screen, loaded]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem("crowns", String(crowns)).catch(onStorageError("crowns"));
  }, [crowns, loaded]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem("garden_state", JSON.stringify(gardenState)).catch(onStorageError("garden_state"));
  }, [gardenState, loaded]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem("lives_state", JSON.stringify(lives)).catch(onStorageError("lives_state"));
  }, [lives, loaded]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem("mailbox", JSON.stringify(mailbox)).catch(onStorageError("mailbox"));
  }, [mailbox, loaded]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem("daily_challenge_date", dailyDate).catch(onStorageError("daily_challenge_date"));
  }, [dailyDate, loaded]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem("daily_challenge_progress", JSON.stringify(dailyChallenge)).catch(onStorageError("daily_challenge_progress"));
  }, [dailyChallenge, loaded]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem("daily_login_state", JSON.stringify(dailyLogin)).catch(onStorageError("daily_login_state"));
  }, [dailyLogin, loaded]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem("boosters", JSON.stringify(boosters)).catch(onStorageError("boosters"));
  }, [boosters, loaded]);

  // Wall-clock lives regen. The interval only runs while the app is active so we
  // don't burn battery in the background; the regen math reads Date.now() so a
  // single tick on foreground catches up however long we were away. We also flush
  // queued analytics on the way to the background.
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
      if (state === "active") start();
      else { stop(); flushTelemetry(); disposeSounds(); }
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
      AsyncStorage.setItem("notifications_asked", "1").catch(onStorageError("notifications_asked"));
      if (!granted) {
        setNotifyOn(false);
        AsyncStorage.setItem("notifications_enabled", "0").catch(onStorageError("notifications_enabled"));
      }
    })().catch((e) => captureError(e, { kind: "notif_permission" }));
  }, [loaded, needsTutorial, notifyOn]);

  // Notification deep links: a tap lands the player on the relevant surface and
  // tags the session for attribution. Onboarding is never interrupted.
  const coldStartDeepLinkRef = useRef(false);
  useEffect(() => {
    if (!loaded) return;
    const handle = (link: DeepLink) => {
      track("notification_opened", { link });
      if (needsTutorial) return;
      navigateTo("menu");
      if (link === "daily-login") setMenuDeepLink("daily-login");
    };
    // Read the cold-start response exactly once — getLastNotificationResponseAsync
    // keeps returning the SAME tap on every call, so without this ref any future
    // re-run of this effect (e.g. needsTutorial flipping) would re-fire it.
    if (!coldStartDeepLinkRef.current) {
      coldStartDeepLinkRef.current = true;
      getInitialDeepLink().then((link) => { if (link) handle(link); }).catch(() => {});
    }
    return addDeepLinkListener(handle);
  }, [loaded, needsTutorial]);

  function handleInvestGarden() {
    const result = investCrowns(gardenState, crowns);
    if (result.spent > 0) {
      setCrowns((c) => Math.max(0, c - result.spent));
      setGardenState(result.next);
      track("garden_invested", { spent: result.spent, restored: result.next.restored });
    }
  }

  function handleCrownsEarned(amount: number) {
    setCrowns((c) => c + amount);
  }

  // Each non-tutorial stage clear feeds the rotating daily challenge. Completing
  // the goal delivers the bonus to the mailbox (goal-gated, was "first crown").
  // Pre-computed off current state so the bonus fires exactly once.
  function handleStageCleared(stat: StageStat) {
    // justCompleted is true only on the transition to done (applyStageStat
    // returns false once today's goal is already met), so it fires the bonus once.
    const { next, justCompleted } = applyStageStat(dailyChallenge, stat);
    setDailyChallenge(next);
    if (justCompleted) {
      const today = next.date;
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
      track("daily_challenge_complete", {
        kind: todaysChallenge(today).kind,
        bonus_crowns: DAILY_BONUS_CROWNS,
        bonus_lives: DAILY_BONUS_LIVES,
      });
    }
  }

  // Mailbox opened → clear the "new" state (mark all read) and prune old/expired.
  // Returns the previous reference unchanged when nothing actually changes, so
  // opening an already-read+pruned mailbox doesn't trigger a persistence write.
  function handleMailboxOpened() {
    setMailbox((box) => {
      let changed = false;
      const marked = box.map((m) => {
        if (m.read) return m;
        changed = true;
        return { ...m, read: true };
      });
      const pruned = pruneMailbox(marked);
      if (!changed && pruned.length === box.length) return box;
      return pruned;
    });
  }

  function handleClaimMail(id: string) {
    // Pre-compute the reward off current state so the analytics event fires once
    // (state-updater bodies are re-invoked under StrictMode in dev).
    const target = mailbox.find((m) => m.id === id);
    if (target && !target.claimed && target.reward) {
      track("mailbox_claimed", {
        id,
        crowns: target.reward.crowns ?? 0,
        lives: target.reward.lives ?? 0,
      });
    }
    setMailbox((box) => {
      const t = box.find((m) => m.id === id);
      if (!t || t.claimed) return box.map((m) => (m.id === id ? { ...m, read: true } : m));
      if (t.reward?.crowns) setCrowns((c) => c + (t.reward!.crowns ?? 0));
      if (t.reward?.lives) setLives((l) => grantLives(l, t.reward!.lives ?? 0));
      if (t.reward?.boosters) setBoosters((b) => grantBoosters(b, t.reward!.boosters));
      return box.map((m) => (m.id === id ? { ...m, claimed: true, read: true } : m));
    });
  }

  function handleClaimDailyLogin() {
    const { next, reward } = claimDailyLogin(dailyLogin);
    if (!reward) return;
    setDailyLogin(next);
    if (reward.crowns) setCrowns((c) => c + (reward.crowns ?? 0));
    if (reward.lives) setLives((l) => grantLives(l, reward.lives ?? 0));
    if (reward.boosters) setBoosters((b) => grantBoosters(b, reward.boosters));
    track("daily_login_claimed", { crowns: reward.crowns ?? 0, lives: reward.lives ?? 0 });
  }

  function handleBuyBooster(key: "hint" | "addrow") {
    const cost = BOOSTER_COST[key];
    if (crowns < cost) return;
    if (boosters[key] >= MAX_BOOSTERS) return;
    setCrowns((c) => c - cost);
    setBoosters((b) => ({ ...b, [key]: b[key] + 1 }));
    track("booster_purchased", { key, cost });
  }

  function handleToggleSound(next: boolean) {
    setSoundOn(next);
    setMuted(!next);
    AsyncStorage.setItem("sound_muted", next ? "0" : "1").catch(onStorageError("sound_muted"));
    track("settings_toggled", { setting: "sound", value: next });
  }

  function handleToggleHaptics(next: boolean) {
    setHapticsOn(next);
    AsyncStorage.setItem("haptics_enabled", next ? "1" : "0").catch(onStorageError("haptics_enabled"));
    track("settings_toggled", { setting: "haptics", value: next });
  }

  function handleToggleNotifications(next: boolean) {
    setNotifyOn(next);
    AsyncStorage.setItem("notifications_enabled", next ? "1" : "0").catch(onStorageError("notifications_enabled"));
    if (next) requestPermission().catch((e) => captureError(e, { kind: "request_permission" }));
    track("settings_toggled", { setting: "notifications", value: next });
  }

  // Per-mode stage updates pushed up from GameScreen so the menu tiles stay
  // accurate without it having to peek at AsyncStorage on every focus.
  function handleStageAdvance(m: GameMode, stage: number) {
    if (m === "golden") {
      setGoldenStage((prev) => {
        const next = Math.max(prev, stage);
        if (next !== prev) AsyncStorage.setItem("golden_stage", String(next)).catch(onStorageError("golden_stage"));
        return next;
      });
    } else if (m === "freeze") {
      setFreezeStage((prev) => {
        const next = Math.max(prev, stage);
        if (next !== prev) AsyncStorage.setItem("freeze_stage", String(next)).catch(onStorageError("freeze_stage"));
        return next;
      });
    }
  }

  // The shared cross-fade between menu and game.
  function enterScreen(newScreen: Screen, stage: number, m: GameMode) {
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setCurrentStage(stage);
      setMode(m);
      setScreen(newScreen);
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    });
  }

  // Spend a life, hand off owned boosters once (zeroing so a same-run "Continue"
  // can't double-use them), and enter the game.
  function beginRealRun(stage: number, m: GameMode) {
    setLives((l) => spendLife(l));
    setBonusBoosters(boosters);
    setBoosters(defaultBoosters());
    track("run_started", { mode: m, stage });
    enterScreen("game", stage, m);
  }

  // Out of lives → offer a rewarded ad for +1 life. On reward we grant a life and
  // immediately start the run; the grant/spend functional updates compose to a
  // net zero, so the run begins with the freshly-earned life consumed.
  function offerLifeForAd(stage: number, m: GameMode) {
    if (!isRewardedReady()) {
      Alert.alert("Out of lives", "Your lives refill over time — come back soon, or grab the daily reward.");
      return;
    }
    Alert.alert("Out of lives", "Watch a short ad to get +1 life and keep playing?", [
      { text: "Not now", style: "cancel" },
      {
        text: "Watch ad",
        onPress: () => {
          showRewarded("continue_life", { stage, mode: m }).then((res) => {
            if (res.earned) {
              setLives((l) => grantLives(l, 1));
              beginRealRun(stage, m);
            } else if (!res.shown) {
              Alert.alert("Ad not ready", "Please try again in a moment.");
            }
          });
        },
      },
    ]);
  }

  function navigateTo(newScreen: Screen, stage = 1, m: GameMode = "endless") {
    // Intercept any game navigation if tutorial hasn't been completed yet
    const effectiveMode = (newScreen === "game" && needsTutorial && m !== "tutorial") ? "tutorial" : m;
    const effectiveStage = effectiveMode === "tutorial" ? 1 : stage;
    // Real runs cost one life. Tutorial is free so onboarding can't hard-block.
    if (newScreen === "game" && effectiveMode !== "tutorial") {
      if (lives.count <= 0) {
        track("lives_depleted");
        offerLifeForAd(effectiveStage, effectiveMode);
        return;
      }
      beginRealRun(effectiveStage, effectiveMode);
      return;
    }
    // Menu navigation, or the free tutorial run.
    setBonusBoosters(defaultBoosters());
    if (newScreen === "game" && effectiveMode === "tutorial") {
      track("run_started", { mode: "tutorial", stage: effectiveStage });
    }
    enterScreen(newScreen, effectiveStage, effectiveMode);
  }

  function handleTutorialComplete() {
    setNeedsTutorial(false);
    AsyncStorage.setItem("onboarding_done", "1").catch(onStorageError("onboarding_done"));
    track("tutorial_complete");
    navigateTo("menu");
  }

  async function handleResetTutorial() {
    // DEV: wipe ALL persisted game data (crowns, garden, high scores,
    // endless progress, golden completions, onboarding) and reset memory.
    try { await AsyncStorage.clear(); } catch (e) { captureError(e, { kind: "storage_clear" }); }
    setCrowns(0);
    setGardenState(defaultGardenState());
    setLives(defaultLivesState());
    setMailbox(todaysSeed());
    setDailyDate("");
    setDailyChallenge(defaultChallengeProgress());
    setDailyLogin(defaultDailyLogin());
    setBoosters(defaultBoosters());
    setGoldenStage(1);
    setFreezeStage(1);
    AsyncStorage.setItem("mailbox_seeded", "1").catch(onStorageError("mailbox_seeded"));
    setNeedsTutorial(true);
    navigateTo("game", 1, "tutorial");
  }

  async function handleDeleteAllData() {
    // User-initiated full data wipe (Settings → Delete all data). Mirrors the
    // DEV reset, but stays on the menu instead of forcing the tutorial. The
    // next time the user taps Play, onboarding will run again (data is gone).
    track("settings_toggled", { setting: "delete_all_data" });
    try { await AsyncStorage.clear(); } catch (e) { captureError(e, { kind: "storage_clear" }); }
    setCrowns(0);
    setGardenState(defaultGardenState());
    setLives(defaultLivesState());
    setMailbox(todaysSeed());
    setDailyDate("");
    setDailyChallenge(defaultChallengeProgress());
    setDailyLogin(defaultDailyLogin());
    setBoosters(defaultBoosters());
    setGoldenStage(1);
    setFreezeStage(1);
    AsyncStorage.setItem("mailbox_seeded", "1").catch(onStorageError("mailbox_seeded"));
    setNeedsTutorial(true);
  }

  if (!splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)} />;
  }

  if (!loaded) return <View style={{ flex: 1, backgroundColor: "#f5efe6" }} />;

  return (
    <SafeAreaProvider>
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#f5efe6" }}>
    <Animated.View
      style={{ flex: 1, backgroundColor: "#f5efe6", opacity: fadeAnim }}
      renderToHardwareTextureAndroid
      needsOffscreenAlphaCompositing
    >
      {screen === "sortlab" ? (
        <ErrorBoundary label="sortlab" onReset={() => setScreen("menu")}>
          <NumberSortScreen onBack={() => setScreen("menu")} />
        </ErrorBoundary>
      ) : screen === "game" ? (
        <ErrorBoundary label="game" onReset={() => navigateTo("menu")}>
          <GameScreen
            initialStage={currentStage}
            mode={mode}
            crowns={crowns}
            bonusHints={bonusBoosters.hint}
            bonusAdds={bonusBoosters.addrow}
            onCrownsEarned={handleCrownsEarned}
            onStageAdvance={handleStageAdvance}
            onStageCleared={handleStageCleared}
            onBack={() => navigateTo("menu")}
            onTutorialComplete={handleTutorialComplete}
          />
        </ErrorBoundary>
      ) : (
        <ErrorBoundary label="menu">
          <MainMenu
            crowns={crowns}
            gardenState={gardenState}
            lives={lives}
            mailbox={mailbox}
            dailyCompletedToday={dailyDate === todayKey()}
            dailyChallenge={dailyChallenge}
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
            onOpenMailbox={handleMailboxOpened}
            onClaimDailyLogin={handleClaimDailyLogin}
            openModal={menuDeepLink}
            onModalConsumed={() => setMenuDeepLink(null)}
            onBuyBooster={handleBuyBooster}
            onToggleSound={handleToggleSound}
            onToggleHaptics={handleToggleHaptics}
            onToggleNotifications={handleToggleNotifications}
            onDeleteAllData={handleDeleteAllData}
            onResetTutorial={handleResetTutorial}
            onOpenSortLab={() => setScreen("sortlab")}
          />
        </ErrorBoundary>
      )}
    </Animated.View>
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

export default withSentry(App);
