import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Boosters, BOOSTER_COST, MAX_BOOSTERS } from "./boosters";

const C = {
  white: "#fbfaf6",
  ink: "#1a1d2e",
  inkSoft: "rgba(26,29,46,0.55)",
  hairline: "rgba(26,29,46,0.08)",
  teal: "#3e9d8f",
  tealSoft: "rgba(62,157,143,0.16)",
  coral: "#ec7458",
  coralSoft: "rgba(236,116,88,0.16)",
  crown: "#d9a648",
  ghost: "#cdc4b3",
};

type BoosterKey = "hint" | "addrow";

interface Meta {
  key: BoosterKey;
  icon: string;
  label: string;
  tintSoft: string;
}

const META: Meta[] = [
  { key: "hint",   icon: "💡", label: "Hint",     tintSoft: C.tealSoft },
  { key: "addrow", icon: "➕", label: "Add Row",  tintSoft: C.coralSoft },
];

interface Props {
  boosters: Boosters;
  crowns: number;
  onBuy: (key: BoosterKey) => void;
}

export default function BoosterShelf({ boosters, crowns, onBuy }: Props) {
  return (
    <View style={s.row}>
      {META.map((m) => {
        const count = boosters[m.key];
        const cost = BOOSTER_COST[m.key];
        const canBuy = crowns >= cost && count < MAX_BOOSTERS;
        return (
          <View key={m.key} style={s.pill}>
            <View style={[s.iconWrap, { backgroundColor: m.tintSoft }]}>
              <Text style={s.icon}>{m.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{m.label}</Text>
              <Text style={s.count}>×{count}</Text>
            </View>
            <TouchableOpacity
              style={[s.buyBtn, !canBuy && s.buyBtnDisabled]}
              onPress={() => canBuy && onBuy(m.key)}
              activeOpacity={canBuy ? 0.8 : 1}
            >
              <Text style={s.buyPlus}>+</Text>
              <Text style={s.buyCost}>{cost}</Text>
              <Text style={s.buyCrown}>👑</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: C.white,
    borderRadius: 14,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 6,
    borderWidth: 1,
    borderColor: C.hairline,
    shadowColor: "rgba(26,29,46,1)",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 14 },
  label: { fontSize: 11, fontWeight: "800", color: C.ink, letterSpacing: 0.2 },
  count: { fontSize: 13, fontWeight: "900", color: C.ink, marginTop: 1 },

  buyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.ink,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 2,
  },
  buyBtnDisabled: {
    backgroundColor: C.ghost,
  },
  buyPlus: { color: "#fff", fontSize: 12, fontWeight: "900", marginRight: 1 },
  buyCost: { color: "#fff", fontSize: 12, fontWeight: "900" },
  buyCrown: { fontSize: 10, marginLeft: 1 },
});
