import React, { useEffect, useRef } from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Animated,
} from "react-native";
import {
  DailyLoginState, DAILY_REWARDS, nextClaimDay, canClaimToday,
} from "./dailyLogin";

const C = {
  white: "#fbfaf6",
  paper: "#fdfbf6",
  ink: "#1a1d2e",
  inkSoft: "rgba(26,29,46,0.55)",
  hairline: "rgba(26,29,46,0.08)",
  coral: "#ec7458",
  teal: "#3e9d8f",
  tealSoft: "#d6ebe5",
  crown: "#d9a648",
  crownSoft: "rgba(217,166,72,0.18)",
  heart: "#e35d6a",
  heartSoft: "rgba(227,93,106,0.14)",
  ghost: "#e9e1d2",
  scrim: "rgba(10,12,22,0.45)",
  good: "#4caf50",
};

interface Props {
  visible: boolean;
  state: DailyLoginState;
  onClaim: () => void;
  onClose: () => void;
}

export default function DailyLogin({ visible, state, onClaim, onClose }: Props) {
  const todayDay = nextClaimDay(state);
  const claimable = canClaimToday(state);
  const sheetScale = useRef(new Animated.Value(0.92)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      sheetScale.setValue(0.92);
      sheetOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(sheetScale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
        Animated.timing(sheetOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent hardwareAccelerated statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={s.scrim}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[s.sheet, { transform: [{ scale: sheetScale }], opacity: sheetOpacity }]}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.title}>Daily Reward</Text>
              <Text style={s.subtitle}>Come back every day — the streak grows.</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={s.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={s.grid}>
            {DAILY_REWARDS.slice(0, 6).map((r) => (
              <DayCell
                key={r.day}
                day={r.day}
                reward={r}
                claimed={r.day < todayDay || (r.day === todayDay && !claimable)}
                isToday={r.day === todayDay && claimable}
              />
            ))}
          </View>
          <View style={s.megaWrap}>
            <DayCell
              day={7}
              reward={DAILY_REWARDS[6]}
              claimed={7 < todayDay || (7 === todayDay && !claimable)}
              isToday={7 === todayDay && claimable}
              mega
            />
          </View>

          {claimable ? (
            <TouchableOpacity style={s.claimBtn} onPress={onClaim} activeOpacity={0.85}>
              <Text style={s.claimBtnText}>Claim Day {todayDay} →</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.claimedBox}>
              <Text style={s.claimedText}>✓ Claimed today — see you tomorrow!</Text>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function DayCell({
  day, reward, claimed, isToday, mega,
}: {
  day: number;
  reward: { crowns?: number; lives?: number; boosters?: { hint?: number; addrow?: number }; mega?: boolean };
  claimed: boolean;
  isToday: boolean;
  mega?: boolean;
}) {
  const todayPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isToday) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(todayPulse, { toValue: 1.06, duration: 700, useNativeDriver: true }),
        Animated.timing(todayPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isToday]);

  return (
    <Animated.View
      style={[
        s.cell,
        mega && s.cellMega,
        claimed && s.cellClaimed,
        isToday && s.cellToday,
        isToday && { transform: [{ scale: todayPulse }] },
      ]}
    >
      <Text style={[s.cellDay, mega && s.cellDayMega]}>
        {mega ? "Day 7 · Mega" : `Day ${day}`}
      </Text>
      <View style={s.rewardRow}>
        {reward.crowns ? (
          <View style={s.chip}>
            <Text style={s.chipIcon}>👑</Text>
            <Text style={s.chipText}>+{reward.crowns}</Text>
          </View>
        ) : null}
        {reward.lives ? (
          <View style={[s.chip, s.chipHeart]}>
            <Text style={s.chipIcon}>❤️</Text>
            <Text style={s.chipText}>+{reward.lives}</Text>
          </View>
        ) : null}
        {reward.boosters?.hint ? (
          <View style={s.chip}>
            <Text style={s.chipIcon}>💡</Text>
            <Text style={s.chipText}>+{reward.boosters.hint}</Text>
          </View>
        ) : null}
        {reward.boosters?.addrow ? (
          <View style={s.chip}>
            <Text style={s.chipIcon}>➕</Text>
            <Text style={s.chipText}>+{reward.boosters.addrow}</Text>
          </View>
        ) : null}
      </View>
      {claimed && <Text style={s.checkmark}>✓</Text>}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: C.scrim,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
  },
  sheet: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: C.white,
    borderRadius: 22,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: { fontSize: 22, fontWeight: "900", color: C.ink, letterSpacing: 0.2 },
  subtitle: { fontSize: 12, color: C.inkSoft, marginTop: 4, maxWidth: 240 },
  closeX: { fontSize: 18, color: C.inkSoft, fontWeight: "600", paddingHorizontal: 6 },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  megaWrap: { marginTop: 8 },
  cell: {
    width: "31.5%",
    minHeight: 78,
    borderRadius: 14,
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.hairline,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cellMega: {
    width: "100%",
    minHeight: 84,
    backgroundColor: C.crownSoft,
    borderColor: "rgba(217,166,72,0.4)",
    borderWidth: 1.5,
  },
  cellToday: {
    borderColor: C.coral,
    borderWidth: 2,
    backgroundColor: "#fff",
  },
  cellClaimed: {
    backgroundColor: C.ghost,
    opacity: 0.6,
  },
  cellDay: {
    fontSize: 11,
    fontWeight: "800",
    color: C.inkSoft,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  cellDayMega: {
    color: C.crown,
    fontSize: 12,
  },
  rewardRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 6,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: C.crownSoft,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 9,
  },
  chipHeart: {
    backgroundColor: C.heartSoft,
  },
  chipIcon: { fontSize: 11 },
  chipText: { fontSize: 12, fontWeight: "800", color: C.ink },
  checkmark: {
    position: "absolute",
    top: 4,
    right: 6,
    fontSize: 14,
    color: C.good,
    fontWeight: "900",
  },

  claimBtn: {
    marginTop: 16,
    backgroundColor: C.coral,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: C.coral,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  claimBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.4,
  },
  claimedBox: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: C.tealSoft,
    borderRadius: 14,
  },
  claimedText: { color: C.teal, fontWeight: "800", fontSize: 13 },
});
