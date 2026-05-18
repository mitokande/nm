// Generates short PCM WAV files for game SFX. Run once: `node scripts/gen-sounds.js`.
const fs = require("fs");
const path = require("path");

const SR = 22050;
const OUT = path.join(__dirname, "..", "assets", "sounds");
fs.mkdirSync(OUT, { recursive: true });

function writeWav(name, samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32760), 44 + i * 2);
  }
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log("wrote", name, samples.length, "samples");
}

function env(t, attack, decay, sustain, release, dur) {
  if (t < attack) return t / attack;
  if (t < attack + decay) return 1 - (1 - sustain) * ((t - attack) / decay);
  if (t < dur - release) return sustain;
  if (t < dur) return sustain * (1 - (t - (dur - release)) / release);
  return 0;
}

function tone({ dur, freq, type = "sine", vol = 0.5, attack = 0.005, decay = 0.05, sustain = 0.7, release = 0.1, freqEnd = null, vibrato = 0 }) {
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = freqEnd !== null ? freq + (freqEnd - freq) * (t / dur) : freq;
    const vib = vibrato ? Math.sin(2 * Math.PI * 6 * t) * vibrato : 0;
    phase += (2 * Math.PI * (f + vib)) / SR;
    let s;
    if (type === "sine") s = Math.sin(phase);
    else if (type === "square") s = Math.sin(phase) >= 0 ? 1 : -1;
    else if (type === "saw") s = ((phase / (2 * Math.PI)) % 1) * 2 - 1;
    else if (type === "triangle") s = (2 / Math.PI) * Math.asin(Math.sin(phase));
    else s = Math.sin(phase);
    const e = env(t, attack, decay, sustain, release, dur);
    out[i] = s * e * vol;
  }
  return out;
}

function noise({ dur, vol = 0.4, attack = 0.005, decay = 0.05, sustain = 0.5, release = 0.1, lowpass = 0 }) {
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let s = Math.random() * 2 - 1;
    if (lowpass > 0) {
      s = prev + (s - prev) * lowpass;
      prev = s;
    }
    const e = env(t, attack, decay, sustain, release, dur);
    out[i] = s * e * vol;
  }
  return out;
}

function mix(...arrs) {
  const len = Math.max(...arrs.map((a) => a.length));
  const out = new Float32Array(len);
  for (const a of arrs) for (let i = 0; i < a.length; i++) out[i] += a[i];
  return out;
}

function concat(...arrs) {
  const len = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Float32Array(len);
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

// select: short soft blip
writeWav("select.wav", tone({ dur: 0.07, freq: 660, type: "sine", vol: 0.35, attack: 0.003, decay: 0.02, sustain: 0.6, release: 0.04 }));

// match: bright two-note ping
writeWav(
  "match.wav",
  mix(
    tone({ dur: 0.18, freq: 880, type: "sine", vol: 0.4, attack: 0.003, decay: 0.04, sustain: 0.5, release: 0.13 }),
    tone({ dur: 0.18, freq: 1320, type: "sine", vol: 0.25, attack: 0.003, decay: 0.04, sustain: 0.5, release: 0.13 })
  )
);

// error: low buzzy thunk
writeWav(
  "error.wav",
  tone({ dur: 0.16, freq: 180, freqEnd: 110, type: "square", vol: 0.28, attack: 0.003, decay: 0.05, sustain: 0.5, release: 0.1 })
);

// row clear: rising arpeggio
writeWav(
  "row_clear.wav",
  concat(
    tone({ dur: 0.09, freq: 660, type: "sine", vol: 0.4, attack: 0.003, decay: 0.02, sustain: 0.6, release: 0.06 }),
    tone({ dur: 0.09, freq: 880, type: "sine", vol: 0.4, attack: 0.003, decay: 0.02, sustain: 0.6, release: 0.06 }),
    tone({ dur: 0.18, freq: 1320, type: "sine", vol: 0.45, attack: 0.003, decay: 0.04, sustain: 0.6, release: 0.13 })
  )
);

// stage win: triumphant fanfare
writeWav(
  "stage_win.wav",
  concat(
    tone({ dur: 0.13, freq: 523, type: "triangle", vol: 0.45, attack: 0.005, decay: 0.03, sustain: 0.7, release: 0.08 }),
    tone({ dur: 0.13, freq: 659, type: "triangle", vol: 0.45, attack: 0.005, decay: 0.03, sustain: 0.7, release: 0.08 }),
    tone({ dur: 0.13, freq: 784, type: "triangle", vol: 0.45, attack: 0.005, decay: 0.03, sustain: 0.7, release: 0.08 }),
    mix(
      tone({ dur: 0.45, freq: 1047, type: "triangle", vol: 0.45, attack: 0.005, decay: 0.06, sustain: 0.6, release: 0.3 }),
      tone({ dur: 0.45, freq: 1319, type: "sine", vol: 0.25, attack: 0.005, decay: 0.06, sustain: 0.6, release: 0.3 })
    )
  )
);

// add row: airy whoosh-ish swept noise
writeWav(
  "add_row.wav",
  mix(
    noise({ dur: 0.22, vol: 0.18, attack: 0.01, decay: 0.05, sustain: 0.5, release: 0.15, lowpass: 0.2 }),
    tone({ dur: 0.22, freq: 300, freqEnd: 600, type: "sine", vol: 0.3, attack: 0.005, decay: 0.05, sustain: 0.5, release: 0.15 })
  )
);

// hint: sparkle ping
writeWav(
  "hint.wav",
  concat(
    tone({ dur: 0.08, freq: 1320, type: "sine", vol: 0.35, attack: 0.002, decay: 0.02, sustain: 0.5, release: 0.05 }),
    tone({ dur: 0.14, freq: 1760, type: "sine", vol: 0.4, attack: 0.002, decay: 0.03, sustain: 0.5, release: 0.1 })
  )
);

// combo: bright rising chirp
writeWav(
  "combo.wav",
  tone({ dur: 0.18, freq: 700, freqEnd: 1400, type: "triangle", vol: 0.4, attack: 0.003, decay: 0.04, sustain: 0.6, release: 0.12 })
);

// no moves: descending sad horn
writeWav(
  "no_moves.wav",
  concat(
    tone({ dur: 0.18, freq: 440, type: "triangle", vol: 0.4, attack: 0.005, decay: 0.04, sustain: 0.7, release: 0.12 }),
    tone({ dur: 0.32, freq: 330, freqEnd: 220, type: "triangle", vol: 0.4, attack: 0.005, decay: 0.05, sustain: 0.6, release: 0.22 })
  )
);
