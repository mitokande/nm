import React from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Switch, Platform,
} from "react-native";

const C = {
  white: "#fbfaf6",
  ink: "#1a1d2e",
  inkSoft: "rgba(26,29,46,0.55)",
  hairline: "rgba(26,29,46,0.08)",
  coral: "#ec7458",
  teal: "#3e9d8f",
  danger: "#d45c5c",
  scrim: "rgba(10,12,22,0.45)",
};

interface Props {
  visible: boolean;
  soundOn: boolean;
  hapticsOn: boolean;
  notifyOn: boolean;
  onToggleSound: (next: boolean) => void;
  onToggleHaptics: (next: boolean) => void;
  onToggleNotifications: (next: boolean) => void;
  onResetTutorial?: () => void;
  onClose: () => void;
}

export default function Settings({
  visible, soundOn, hapticsOn, notifyOn,
  onToggleSound, onToggleHaptics, onToggleNotifications,
  onResetTutorial, onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.scrim}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.headerRow}>
            <Text style={s.title}>Settings</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={s.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          <Row
            icon="🔊"
            label="Sound"
            sub="Match, combo, and row-clear effects"
            value={soundOn}
            onChange={onToggleSound}
          />
          <Row
            icon="📳"
            label="Haptics"
            sub="Light taps on matches and combos"
            value={hapticsOn}
            onChange={onToggleHaptics}
          />
          <Row
            icon="🔔"
            label="Notifications"
            sub="Hearts full and daily reward reminders"
            value={notifyOn}
            onChange={onToggleNotifications}
          />

          {__DEV__ && onResetTutorial && (
            <TouchableOpacity style={s.dangerBtn} onPress={onResetTutorial} activeOpacity={0.8}>
              <Text style={s.dangerBtnText}>↺  Reset all progress (DEV)</Text>
            </TouchableOpacity>
          )}

          <Text style={s.versionLabel}>Number Match</Text>
        </View>
      </View>
    </Modal>
  );
}

function Row({
  icon, label, sub, value, onChange,
}: {
  icon: string;
  label: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={s.row}>
      <Text style={s.rowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "rgba(26,29,46,0.15)", true: C.teal }}
        thumbColor={Platform.OS === "android" ? (value ? C.white : "#f3f3f3") : undefined}
      />
    </View>
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
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: C.ink,
    letterSpacing: 0.2,
  },
  closeX: {
    fontSize: 18,
    color: C.inkSoft,
    fontWeight: "600",
    paddingHorizontal: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: C.hairline,
  },
  rowIcon: { fontSize: 22, width: 28, textAlign: "center" },
  rowLabel: { fontSize: 16, fontWeight: "800", color: C.ink },
  rowSub: { fontSize: 12, color: C.inkSoft, marginTop: 2 },
  dangerBtn: {
    marginTop: 18,
    backgroundColor: "rgba(212,92,92,0.10)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  dangerBtnText: { color: C.danger, fontWeight: "800", fontSize: 13 },
  versionLabel: {
    textAlign: "center",
    marginTop: 16,
    fontSize: 11,
    color: C.inkSoft,
    letterSpacing: 0.5,
  },
});
