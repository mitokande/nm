import React from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from "react-native";
import { MailMessage } from "./mailboxData";

const C = {
  white: "#fbfaf6",
  paper: "#fdfbf6",
  ink: "#1a1d2e",
  inkSoft: "rgba(26,29,46,0.55)",
  hairline: "rgba(26,29,46,0.08)",
  coral: "#ec7458",
  teal: "#3e9d8f",
  crown: "#d9a648",
  scrim: "rgba(10,12,22,0.45)",
  unreadDot: "#ec7458",
};

interface Props {
  visible: boolean;
  messages: MailMessage[];
  onClaim: (id: string) => void;
  onClose: () => void;
}

export default function Mailbox({ visible, messages, onClaim, onClose }: Props) {
  return (
    <Modal visible={visible} transparent hardwareAccelerated statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={s.scrim}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.headerRow}>
            <Text style={s.title}>Mailbox</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={s.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          {messages.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>✉️</Text>
              <Text style={s.emptyText}>No messages right now.</Text>
              <Text style={s.emptySub}>Daily rewards land here.</Text>
            </View>
          ) : (
            <ScrollView style={s.list} contentContainerStyle={{ paddingBottom: 4 }}>
              {messages.map((m) => (
                <MessageRow key={m.id} m={m} onClaim={() => onClaim(m.id)} />
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function MessageRow({ m, onClaim }: { m: MailMessage; onClaim: () => void }) {
  const hasReward = !!(m.reward && ((m.reward.crowns ?? 0) > 0 || (m.reward.lives ?? 0) > 0));
  const claimable = hasReward && !m.claimed;
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        {(!m.read || claimable) && <View style={s.dot} />}
        <Text style={s.cardTitle}>{m.title}</Text>
      </View>
      <Text style={s.cardBody}>{m.body}</Text>

      {hasReward && (
        <View style={s.rewardRow}>
          {m.reward?.crowns ? (
            <View style={s.chip}>
              <Text style={s.chipIcon}>👑</Text>
              <Text style={s.chipText}>+{m.reward.crowns}</Text>
            </View>
          ) : null}
          {m.reward?.lives ? (
            <View style={s.chip}>
              <Text style={s.chipIcon}>❤️</Text>
              <Text style={s.chipText}>+{m.reward.lives}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          {claimable ? (
            <TouchableOpacity style={s.claimBtn} onPress={onClaim} activeOpacity={0.85}>
              <Text style={s.claimBtnText}>Claim</Text>
            </TouchableOpacity>
          ) : (
            <Text style={s.claimedTag}>✓ Claimed</Text>
          )}
        </View>
      )}
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
    maxWidth: 440,
    maxHeight: "78%",
    backgroundColor: C.white,
    borderRadius: 22,
    padding: 18,
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
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  title: { fontSize: 22, fontWeight: "900", color: C.ink, letterSpacing: 0.2 },
  closeX: { fontSize: 18, color: C.inkSoft, fontWeight: "600", paddingHorizontal: 6 },

  list: { maxHeight: 480 },

  empty: { alignItems: "center", paddingVertical: 36 },
  emptyIcon: { fontSize: 38, marginBottom: 10 },
  emptyText: { fontSize: 15, fontWeight: "700", color: C.ink },
  emptySub: { fontSize: 12, color: C.inkSoft, marginTop: 4 },

  card: {
    backgroundColor: C.paper,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: C.hairline,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.unreadDot },
  cardTitle: { fontSize: 15, fontWeight: "800", color: C.ink },
  cardBody: { fontSize: 13, color: C.inkSoft, marginTop: 6, lineHeight: 18 },

  rewardRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(217,166,72,0.14)",
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 12,
  },
  chipIcon: { fontSize: 13 },
  chipText: { fontSize: 13, fontWeight: "800", color: C.ink },

  claimBtn: {
    backgroundColor: C.teal,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  claimBtnText: { color: "#fff", fontWeight: "900", fontSize: 13, letterSpacing: 0.4 },
  claimedTag: { fontSize: 12, fontWeight: "700", color: C.inkSoft },
});
