import React from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Switch, Platform,
  Linking, Alert, ScrollView, Dimensions,
} from "react-native";
import Constants from "expo-constants";
import { manageAdConsent } from "./consent";
import { C } from "./tokens";

const PRIVACY_URL = "https://mithatck.com/numbermatch/privacy.html";
const TERMS_URL = "https://mithatck.com/numbermatch/terms.html";

interface Props {
  visible: boolean;
  soundOn: boolean;
  hapticsOn: boolean;
  notifyOn: boolean;
  onToggleSound: (next: boolean) => void;
  onToggleHaptics: (next: boolean) => void;
  onToggleNotifications: (next: boolean) => void;
  onDeleteAllData: () => void;
  onResetTutorial?: () => void;
  onClose: () => void;
}

export default function Settings({
  visible, soundOn, hapticsOn, notifyOn,
  onToggleSound, onToggleHaptics, onToggleNotifications,
  onDeleteAllData, onResetTutorial, onClose,
}: Props) {
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  function openUrl(url: string) {
    Linking.openURL(url).catch(() =>
      Alert.alert("Couldn't open link", "Please try again in a moment."),
    );
  }

  async function handleAdPrivacy() {
    const shown = await manageAdConsent();
    if (!shown) {
      Alert.alert(
        "Ad privacy",
        "There are no ad-consent options to change in your region right now. " +
          "You can also manage tracking in your device's privacy settings.",
      );
    }
  }

  function handleDelete() {
    Alert.alert(
      "Delete all data?",
      "This permanently erases your progress, crowns, high scores, and settings on " +
        "this device. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => { onClose(); onDeleteAllData(); },
        },
      ],
    );
  }

  return (
    <Modal visible={visible} transparent hardwareAccelerated statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={s.scrim}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.headerRow}>
            <Text style={s.title}>Settings</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={16}
              accessibilityRole="button"
              accessibilityLabel="Close settings"
            >
              <Text style={s.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
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

            <ActionRow
              icon="📜"
              label="Privacy Policy"
              sub="How we handle your data"
              onPress={() => openUrl(PRIVACY_URL)}
            />
            <ActionRow
              icon="📄"
              label="Terms of Service"
              sub="The rules for using Number Match"
              onPress={() => openUrl(TERMS_URL)}
            />
            <ActionRow
              icon="🛡️"
              label="Ad privacy settings"
              sub="Manage personalized-ad consent"
              onPress={handleAdPrivacy}
            />

            <TouchableOpacity style={s.dangerBtn} onPress={handleDelete} activeOpacity={0.8}>
              <Text style={s.dangerBtnText}>🗑  Delete all data</Text>
            </TouchableOpacity>

            {__DEV__ && onResetTutorial && (
              <TouchableOpacity style={s.devBtn} onPress={onResetTutorial} activeOpacity={0.8}>
                <Text style={s.devBtnText}>↺  Reset all progress (DEV)</Text>
              </TouchableOpacity>
            )}

            <Text style={s.versionLabel}>Number Match · v{appVersion}</Text>
          </ScrollView>
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

function ActionRow({
  icon, label, sub, onPress,
}: {
  icon: string;
  label: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <Text style={s.rowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowSub}>{sub}</Text>
      </View>
      <Text style={s.chevron}>›</Text>
    </TouchableOpacity>
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
  scroll: {
    maxHeight: Dimensions.get("window").height * 0.62,
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
  chevron: { fontSize: 24, color: C.inkSoft, fontWeight: "600", paddingHorizontal: 4 },
  dangerBtn: {
    marginTop: 18,
    backgroundColor: "rgba(212,92,92,0.10)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  dangerBtnText: { color: C.danger, fontWeight: "800", fontSize: 13 },
  devBtn: {
    marginTop: 10,
    backgroundColor: "rgba(26,29,46,0.06)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  devBtnText: { color: C.inkSoft, fontWeight: "800", fontSize: 13 },
  versionLabel: {
    textAlign: "center",
    marginTop: 16,
    fontSize: 11,
    color: C.inkSoft,
    letterSpacing: 0.5,
  },
});
