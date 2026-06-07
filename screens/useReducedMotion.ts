// Reactive "reduce motion" preference. Mirrors the OS-level toggle (iOS
// Settings → Accessibility → Motion, Android Settings → Accessibility → Remove
// animations). Components that run perpetual loops (badge pulse, ambient
// butterflies, confetti) gate on this and either freeze in a settled state or
// skip the animation entirely. Hook is safe in any environment — defaults to
// `false` if the AccessibilityInfo APIs are missing.

import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    try {
      AccessibilityInfo.isReduceMotionEnabled?.()
        .then((v) => { if (!cancelled) setReduced(!!v); })
        .catch(() => {});
    } catch {}
    const sub = AccessibilityInfo.addEventListener?.("reduceMotionChanged", (v: boolean) => setReduced(!!v));
    return () => {
      cancelled = true;
      try { sub?.remove?.(); } catch {}
    };
  }, []);

  return reduced;
}
