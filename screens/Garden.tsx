import React, { useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
} from "react-native";
import {
  GardenState, GARDEN_AREAS,
  currentArea, isFullyRestored,
} from "./gardenData";

const C = {
  white: "#fbfaf6",
  ink: "#2a2118",
  inkSoft: "rgba(42,33,24,0.5)",
  ghost: "#cdc4b3",
  crown: "#d9a648",
  coral: "#ec7458",
  track: "rgba(42,33,24,0.10)",
  leaf: "#5f8a47",
};

interface Props {
  crowns: number;
  gardenState: GardenState;
  /** Invest available crowns into the current area. */
  onInvest: () => void;
}

export default function Garden({ crowns, gardenState, onInvest }: Props) {
  const area = currentArea(gardenState);
  const done = isFullyRestored(gardenState);

  // ── Progress bar fill ────────────────────────────────────────────────────
  const fillAnim = useRef(new Animated.Value(0)).current;
  const pct = area ? Math.min(1, gardenState.invested / area.cost) : 1;
  useEffect(() => {
    Animated.timing(fillAnim, { toValue: pct, duration: 450, useNativeDriver: false }).start();
  }, [pct]);

  // ── Press feedback when there's nothing to invest ────────────────────────
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;

  function handleCardPress() {
    if (done) return;
    const canInvest = crowns > 0 && area && gardenState.invested < area.cost;
    if (!canInvest) {
      shakeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
      return;
    }
    cardScale.setValue(0.97);
    Animated.spring(cardScale, { toValue: 1, friction: 4, tension: 300, useNativeDriver: true }).start();
    onInvest();
  }

  const nextArea = GARDEN_AREAS[gardenState.restored + 1] ?? null;
  const shakeX = shakeAnim.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });

  return (
    <View>
      {/* Restore card — floats over the full-screen garden background */}
      <Animated.View style={{ transform: [{ translateX: shakeX }, { scale: cardScale }] }}>
        {done ? (
          <View style={g.card}>
            <View style={g.iconDisc}>
              <Text style={g.iconEmoji}>🌳</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={g.cardTitle}>Garden Restored</Text>
              <Text style={g.cardSub}>Every area is in full bloom.</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={g.card} activeOpacity={0.85} onPress={handleCardPress}>
            <View style={g.iconDisc}>
              <Text style={g.iconEmoji}>{area?.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={g.eyebrow}>NEXT REWARD</Text>
              <Text style={g.cardTitle}>{area?.name}</Text>
              <Text style={g.cardSub}>
                {crowns > 0 ? "Tap to spend your crowns" : "Restore and unlock this area"}
              </Text>
              <View style={g.barRow}>
                <View style={g.track}>
                  <Animated.View
                    style={[
                      g.fill,
                      { width: fillAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) },
                    ]}
                  />
                </View>
                <Text style={g.barLabel}>
                  <Text style={g.crownIcon}>👑 </Text>
                  {gardenState.invested}/{area?.cost}
                </Text>
              </View>
            </View>
            {nextArea && (
              <View style={g.nextThumb}>
                <Text style={g.nextThumbEmoji}>{nextArea.icon}</Text>
                <View style={g.lockBadge}>
                  <Text style={g.lockBadgeText}>🔒</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Ambient life ─────────────────────────────────────────────────────────────
// Lightweight looping particles (butterflies + drifting petals) so the garden
// feels alive even when idle. All transforms use the native driver.

export function AmbientLife({ w, h }: { w: number; h: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Petal w={w} h={h} emoji="🌸" startX={w * 0.18} delay={0} duration={9000} />
      <Petal w={w} h={h} emoji="🍃" startX={w * 0.5} delay={3200} duration={11000} />
      <Petal w={w} h={h} emoji="🌸" startX={w * 0.78} delay={6000} duration={8200} />
      <Petal w={w} h={h} emoji="🌼" startX={w * 0.35} delay={4500} duration={10500} />
      <Butterfly w={w} h={h} xMin={w * 0.12} xMax={w * 0.42} yMin={h * 0.30} yMax={h * 0.58} dx={4200} dy={3100} delay={0} />
      <Butterfly w={w} h={h} xMin={w * 0.55} xMax={w * 0.85} yMin={h * 0.22} yMax={h * 0.5} dx={5200} dy={3700} delay={900} />
    </View>
  );
}

function Butterfly({
  xMin, xMax, yMin, yMax, dx, dy, delay,
}: { w: number; h: number; xMin: number; xMax: number; yMin: number; yMax: number; dx: number; dy: number; delay: number }) {
  const ax = useRef(new Animated.Value(0)).current;
  const ay = useRef(new Animated.Value(0)).current;
  const flap = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const yoyo = (v: Animated.Value, d: number) =>
      Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: d, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: d, useNativeDriver: true }),
      ]));
    const a = yoyo(ax, dx);
    const b = yoyo(ay, dy);
    const f = Animated.loop(Animated.sequence([
      Animated.timing(flap, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(flap, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]));
    const t = setTimeout(() => { a.start(); b.start(); f.start(); }, delay);
    return () => { clearTimeout(t); a.stop(); b.stop(); f.stop(); };
  }, []);

  const translateX = ax.interpolate({ inputRange: [0, 1], outputRange: [xMin, xMax] });
  const translateY = ay.interpolate({ inputRange: [0, 1], outputRange: [yMin, yMax] });
  const scaleX = flap.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });

  return (
    <Animated.Text style={[gl.butterfly, { transform: [{ translateX }, { translateY }, { scaleX }] }]}>
      🦋
    </Animated.Text>
  );
}

function Petal({
  h, emoji, startX, delay, duration,
}: { w: number; h: number; emoji: string; startX: number; delay: number; duration: number }) {
  const t = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fall = Animated.loop(Animated.timing(t, { toValue: 1, duration, useNativeDriver: true }));
    const s = Animated.loop(Animated.sequence([
      Animated.timing(sway, { toValue: 1, duration: 1800, useNativeDriver: true }),
      Animated.timing(sway, { toValue: 0, duration: 1800, useNativeDriver: true }),
    ]));
    const timer = setTimeout(() => { fall.start(); s.start(); }, delay);
    return () => { clearTimeout(timer); fall.stop(); s.stop(); };
  }, []);

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [-20, h + 20] });
  const translateX = sway.interpolate({ inputRange: [0, 1], outputRange: [startX - 14, startX + 14] });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "260deg"] });
  const opacity = t.interpolate({ inputRange: [0, 0.12, 0.85, 1], outputRange: [0, 0.85, 0.85, 0] });

  return (
    <Animated.Text style={[gl.petal, { opacity, transform: [{ translateX }, { translateY }, { rotate }] }]}>
      {emoji}
    </Animated.Text>
  );
}

const gl = StyleSheet.create({
  butterfly: { position: "absolute", top: 0, left: 0, fontSize: 18 },
  petal: { position: "absolute", top: 0, left: 0, fontSize: 15 },
});

const g = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(42,33,24,0.07)",
    shadowColor: "rgba(42,33,24,1)",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  iconDisc: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#f1e8d6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(42,33,24,0.08)",
  },
  iconEmoji: { fontSize: 28 },
  eyebrow: { fontSize: 10, fontWeight: "900", color: C.coral, letterSpacing: 1, marginBottom: 1 },
  cardTitle: { fontSize: 16, fontWeight: "900", color: C.ink, letterSpacing: -0.3 },
  cardSub: { fontSize: 12.5, color: C.inkSoft, fontWeight: "500", marginTop: 1 },

  barRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 8 },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.track,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 4, backgroundColor: C.coral },
  barLabel: { fontSize: 12, fontWeight: "800", color: C.ink },
  crownIcon: { fontSize: 11, color: C.crown },

  nextThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#f1e8d6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(42,33,24,0.08)",
  },
  nextThumbEmoji: { fontSize: 24, opacity: 0.45 },
  lockBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(42,33,24,0.1)",
  },
  lockBadgeText: { fontSize: 10 },
});
