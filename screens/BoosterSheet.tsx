import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Boosters, BOOSTER_COST, MAX_BOOSTERS } from "./boosters";
import { C as BASE_C } from "./tokens";

// BoosterSheet uses translucent rgba variants of teal/coral for the chip
// backgrounds, where the canonical solid hex versions would overpower the card.
const C = {
  ...BASE_C,
  tealSoft: "rgba(62,157,143,0.16)",
  coralSoft: "rgba(236,116,88,0.16)",
};

type BoosterKey = "hint" | "addrow";

interface Meta {
  key: BoosterKey;
  icon: string;
  label: string;
  blurb: string;
  tintSoft: string;
}

const META: Meta[] = [
  { key: "hint",   icon: "💡", label: "Hint",    blurb: "Reveal a matching pair.", tintSoft: C.tealSoft },
  { key: "addrow", icon: "➕", label: "Add Row", blurb: "Add a fresh row of cells.", tintSoft: C.coralSoft },
];

interface Props {
  visible: boolean;
  boosters: Boosters;
  crowns: number;
  onBuy: (key: BoosterKey) => void;
  onClose: () => void;
}

export default function BoosterSheet({ visible, boosters, crowns, onBuy, onClose }: Props) {
  return (
    <Modal visible={visible} transparent hardwareAccelerated statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={s.scrim}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.title}>Boosters</Text>
              <Text style={s.sub}>Stock up — they apply on your next run.</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={16}
              accessibilityRole="button"
              accessibilityLabel="Close booster shop"
            >
              <Text style={s.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={s.walletPill}>
            <Text style={s.walletGlyph}>👑</Text>
            <Text style={s.walletCount}>{crowns}</Text>
          </View>

          {META.map((m, i) => {
            const count = boosters[m.key];
            const cost = BOOSTER_COST[m.key];
            const maxed = count >= MAX_BOOSTERS;
            const canBuy = !maxed && crowns >= cost;
            return (
              <View key={m.key} style={[s.row, i === 0 && { borderTopWidth: 0 }]}>
                <View style={[s.iconWrap, { backgroundColor: m.tintSoft }]}>
                  <Text style={s.icon}>{m.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.labelRow}>
                    <Text style={s.label}>{m.label}</Text>
                    <Text style={s.count}>×{count}</Text>
                  </View>
                  <Text style={s.blurb}>{m.blurb}</Text>
                </View>
                <TouchableOpacity
                  style={[s.buyBtn, !canBuy && s.buyBtnDisabled]}
                  onPress={() => canBuy && onBuy(m.key)}
                  activeOpacity={canBuy ? 0.82 : 1}
                >
                  {maxed ? (
                    <Text style={s.maxedText}>MAX</Text>
                  ) : (
                    <>
                      <Text style={s.buyCost}>{cost}</Text>
                      <Text style={s.buyCrown}>👑</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </View>
    </Modal>
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
    maxWidth: 420,
    backgroundColor: C.white,
    borderRadius: 22,
    padding: 22,
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
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: "900", color: C.ink, letterSpacing: 0.2 },
  sub: { fontSize: 12, color: C.inkSoft, marginTop: 2 },
  closeX: { fontSize: 18, color: C.inkSoft, fontWeight: "600", paddingHorizontal: 6 },

  walletPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(217,166,72,0.14)",
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  walletGlyph: { fontSize: 13 },
  walletCount: { fontSize: 13, fontWeight: "900", color: C.ink },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: C.hairline,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 22 },
  labelRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  label: { fontSize: 15, fontWeight: "900", color: C.ink, letterSpacing: 0.2 },
  count: { fontSize: 13, fontWeight: "800", color: C.inkSoft },
  blurb: { fontSize: 12, color: C.inkSoft, marginTop: 2 },

  buyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.ink,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    gap: 4,
    minWidth: 64,
    justifyContent: "center",
  },
  buyBtnDisabled: { backgroundColor: C.ghost },
  buyCost: { color: "#fff", fontSize: 13, fontWeight: "900" },
  buyCrown: { fontSize: 11 },
  maxedText: { color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.6 },
});
