import { createAudioPlayer, setAudioModeAsync, AudioModule } from "expo-audio";

export type SoundName =
  | "select"
  | "match"
  | "error"
  | "row_clear"
  | "stage_win"
  | "add_row"
  | "hint"
  | "combo"
  | "no_moves";

const sources: Record<SoundName, number> = {
  select: require("../assets/sounds/select.wav"),
  match: require("../assets/sounds/match.wav"),
  error: require("../assets/sounds/error.wav"),
  row_clear: require("../assets/sounds/row_clear.wav"),
  stage_win: require("../assets/sounds/stage_win.wav"),
  add_row: require("../assets/sounds/add_row.wav"),
  hint: require("../assets/sounds/hint.wav"),
  combo: require("../assets/sounds/combo.wav"),
  no_moves: require("../assets/sounds/no_moves.wav"),
};

type Player = ReturnType<typeof createAudioPlayer>;
const players: Partial<Record<SoundName, Player>> = {};
let initialized = false;
let muted = false;

function ensureInit() {
  if (initialized) return;
  initialized = true;
  setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "mixWithOthers" }).catch(() => {});
  for (const key of Object.keys(sources) as SoundName[]) {
    try {
      players[key] = createAudioPlayer(sources[key]);
    } catch {}
  }
}

export function playSound(name: SoundName, volume = 1) {
  if (muted) return;
  ensureInit();
  const p = players[name];
  if (!p) return;
  try {
    p.volume = volume;
    p.seekTo(0);
    p.play();
  } catch {}
}

export function setMuted(value: boolean) {
  muted = value;
}

export function isMuted() {
  return muted;
}

export function disposeSounds() {
  for (const key of Object.keys(players) as SoundName[]) {
    try {
      players[key]?.remove();
    } catch {}
    delete players[key];
  }
  initialized = false;
}

export { AudioModule };
