// Catches render-time crashes in its subtree, reports them, and shows a styled
// recovery screen instead of a white screen of death. Wrap GameScreen (with an
// onReset that returns to the menu) and MainMenu separately so a crash in one
// never takes down the other.

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { captureError } from "./telemetry";
import { C } from "./tokens";

interface Props {
  children: React.ReactNode;
  /** Label for the crash report (e.g. "game" | "menu"). */
  label?: string;
  /** Called when the user taps the recovery button (e.g. navigate to menu). */
  onReset?: () => void;
  /** Button copy. Defaults to "Back to menu". */
  resetLabel?: string;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string }) {
    captureError(error, {
      boundary: this.props.label ?? "root",
      componentStack: info?.componentStack,
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={s.root}>
        <Text style={s.emoji}>🌧️</Text>
        <Text style={s.title}>Something went wrong</Text>
        <Text style={s.sub}>The game hit an unexpected snag. Your progress is safe.</Text>
        <TouchableOpacity style={s.btn} onPress={this.handleReset} activeOpacity={0.85}>
          <Text style={s.btnText}>{this.props.resetLabel ?? "Back to menu"}</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingBottom: Platform.OS === "android" ? 24 : 40,
  },
  emoji: { fontSize: 52, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "900", color: C.ink, letterSpacing: 0.2, textAlign: "center" },
  sub: {
    fontSize: 14,
    color: C.inkSoft,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  btn: {
    marginTop: 28,
    backgroundColor: C.coral,
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 36,
    shadowColor: C.coral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  btnText: { color: "#fff", fontWeight: "900", fontSize: 16, letterSpacing: 0.5 },
});
