import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";

const C = {
  white: "#fbfaf6",
  ink: "#1a1d2e",
  inkSoft: "rgba(26,29,46,0.55)",
  hairline: "rgba(26,29,46,0.10)",
  ghostDisc: "#e7e1d2",
  ghostInk: "rgba(26,29,46,0.45)",
  coral: "#ec7458",
  teal: "#3e9d8f",
};

interface Props {
  /** Emoji or single glyph rendered inside the colored disc. */
  icon: string;
  /** Tiny caption below the disc. Pass undefined to skip. */
  label?: string;
  /** Small pill in the bottom-right corner (e.g. "S3", "60s", "×4"). */
  chip?: string;
  /** Tint applied to the inner icon disc. */
  tint: string;
  /** Optional brand color for the corner chip. Falls back to ink. */
  chipColor?: string;
  /** Show a red notification dot top-right. */
  dot?: boolean;
  /** Show a teal ✓ overlay top-right (mutually exclusive with `dot`). */
  done?: boolean;
  /** Subtle pulse loop for actionable / unclaimed badges. */
  pulse?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export default function SideBadge({
  icon, label, chip, tint, chipColor, dot, done, pulse, disabled, onPress,
}: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse || disabled) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.08, duration: 750, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, disabled]);

  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.82}
      onPress={() => { if (!disabled) onPress(); }}
      onPressIn={() => {
        if (disabled) return;
        Animated.spring(pressAnim, { toValue: 0.92, friction: 6, tension: 300, useNativeDriver: true }).start();
      }}
      onPressOut={() => {
        Animated.spring(pressAnim, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }).start();
      }}
      style={[s.touch, disabled && s.touchDisabled]}
      hitSlop={6}
    >
      <Animated.View style={{ transform: [{ scale: Animated.multiply(pulseAnim, pressAnim) }] }}>
        <View style={s.disc}>
          <View style={[s.icon, { backgroundColor: disabled ? C.ghostDisc : tint }]}>
            <Text style={[s.iconGlyph, disabled && { opacity: 0.55 }]}>{icon}</Text>
          </View>
          {chip ? (
            <View style={[s.chip, { backgroundColor: chipColor ?? C.ink }]}>
              <Text style={s.chipText} numberOfLines={1}>{chip}</Text>
            </View>
          ) : null}
          {dot && !done ? <View style={s.dot} /> : null}
          {done ? (
            <View style={s.done}>
              <Text style={s.doneCheck}>✓</Text>
            </View>
          ) : null}
        </View>
      </Animated.View>
      {label ? (
        <Text style={[s.label, disabled && { color: C.ghostInk }]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const DISC = 54;
const ICON = 44;

const s = StyleSheet.create({
  touch: { alignItems: "center" },
  touchDisabled: { opacity: 0.6 },

  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.hairline,
    shadowColor: "rgba(26,29,46,1)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 9,
    elevation: 4,
  },
  icon: {
    width: ICON,
    height: ICON,
    borderRadius: ICON / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  iconGlyph: { fontSize: 22 },

  chip: {
    position: "absolute",
    bottom: -4,
    right: -6,
    minWidth: 22,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: C.white,
  },
  chipText: {
    color: "#fff",
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

  dot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.coral,
    borderWidth: 2,
    borderColor: C.white,
  },
  done: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.teal,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: C.white,
  },
  doneCheck: { color: "#fff", fontSize: 10, fontWeight: "900" },

  label: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "900",
    color: C.ink,
    letterSpacing: 0.3,
    textShadowColor: "rgba(255,255,255,0.85)",
    textShadowRadius: 3,
  },
});
