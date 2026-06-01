// Garden meta: restore-the-garden progression
import React, { useState, useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MainMenu from "./screens/MainMenu";
import GameScreen from "./screens/GameScreen";
import SplashScreen from "./screens/SplashScreen";
import { GardenState, defaultGardenState, normalizeGardenState, investCrowns } from "./screens/gardenData";

type Screen = "menu" | "game";
export type GameMode = "endless" | "golden" | "timeattack" | "freeze" | "tutorial";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [currentStage, setCurrentStage] = useState(1);
  const [mode, setMode] = useState<GameMode>("endless");
  const [crowns, setCrowns] = useState(0);
  const [gardenState, setGardenState] = useState<GardenState>(defaultGardenState);
  const [loaded, setLoaded] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [needsTutorial, setNeedsTutorial] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("crowns"),
      AsyncStorage.getItem("onboarding_done"),
      AsyncStorage.getItem("garden_state"),
    ]).then(([crownVal, onboardingDone, gardenVal]) => {
      if (crownVal !== null) setCrowns(parseInt(crownVal, 10));
      if (gardenVal) {
        try { setGardenState(normalizeGardenState(JSON.parse(gardenVal))); } catch {}
      }
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

  function handleInvestGarden() {
    const result = investCrowns(gardenState, crowns);
    if (result.spent > 0) {
      setCrowns((c) => Math.max(0, c - result.spent));
      setGardenState(result.next);
    }
  }

  function navigateTo(newScreen: Screen, stage = 1, m: GameMode = "endless") {
    // Intercept any game navigation if tutorial hasn't been completed yet
    const effectiveMode = (newScreen === "game" && needsTutorial && m !== "tutorial") ? "tutorial" : m;
    const effectiveStage = effectiveMode === "tutorial" ? 1 : stage;
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
          onCrownsEarned={(amount) => setCrowns((c) => c + amount)}
          onBack={() => navigateTo("menu")}
          onTutorialComplete={handleTutorialComplete}
        />
      ) : (
        <MainMenu
          crowns={crowns}
          gardenState={gardenState}
          onInvestGarden={handleInvestGarden}
          onDebugAddCrowns={(amount) => setCrowns((c) => c + amount)}
          onPlay={(stage, m) => navigateTo("game", stage, m)}
          onResetTutorial={handleResetTutorial}
        />
      )}
    </Animated.View>
    </GestureHandlerRootView>
  );
}
