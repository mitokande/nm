import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";

const { width: SW } = Dimensions.get("window");

const LOGO_SIZE = SW * 0.58;
const BG = "#f5efe6";
const INK = "#3d2b1f";
const PRIMARY = "#c0614a";

interface Props {
  onDone: () => void;
}

export default function SplashScreen({ onDone }: Props) {
  const scale = useRef(new Animated.Value(0.1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const doneRef = useRef(false);

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    Animated.timing(containerOpacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => onDone());
  }

  useEffect(() => {
    Animated.sequence([
      // logo spring in
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          tension: 60,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      // brief pause then text appears
      Animated.delay(120),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 480,
        useNativeDriver: true,
      }),
      // hold
      Animated.delay(900),
    ]).start(() => finish());
  }, []);

  return (
    <TouchableWithoutFeedback onPress={finish}>
      <Animated.View style={[s.container, { opacity: containerOpacity }]}>
        <Animated.Image
          source={require("../assets/logo.png")}
          style={[
            s.logo,
            { opacity: logoOpacity, transform: [{ scale }] },
          ]}
          resizeMode="contain"
        />
        <Animated.View style={[s.textBlock, { opacity: textOpacity }]}>
          <Text style={s.title}>Number Match</Text>
          <Text style={s.sub}>match · clear · advance</Text>
        </Animated.View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  textBlock: {
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: INK,
    letterSpacing: 0.5,
  },
  sub: {
    fontSize: 13,
    color: PRIMARY,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "500",
  },
});
