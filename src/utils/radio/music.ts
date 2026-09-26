/**
 * Flow Radio composers. Each station writes music one bar at a time as a list
 * of note events; the engine turns them into sound. Pure and seedable, so the
 * patterns can be tested and rendered offline.
 */

import type { RadioStation } from "./stations";

export { RADIO_STATIONS, type RadioStation, type RadioStationInfo } from "./stations";

export type Voice = "ep" | "bass" | "kick" | "snare" | "hat" | "openHat" | "pluck" | "pad" | "slowPad" | "sawBass" | "arp" | "piano" | "bell" | "crackle" | "drop";

export interface NoteEvent {
  voice: Voice;
  /** Position in sixteenth notes from the start of the bar. */
  step: number;
  /** Length in sixteenth notes. */
  dur: number;
  /** MIDI notes; empty for drums. */
  notes: number[];
  /** 0-1 */
  vel: number;
}

export interface StationSound {
  bpm: number;
  /** 0-0.5: how late the off-beat sixteenths land. */
  swing: number;
  /** Share of the signal sent to the reverb. */
  reverb: number;
  /** Rain under the music that belongs to the station itself (0-1). */
  rainBed?: number;
  noiseBed?: "brown";
  binaural?: { carrier: number; beat: number };
  /** Duck pads and arps on each kick. */
  pump?: boolean;
  /** Feedback delay for arps, in sixteenths. */
  delay?: number;
  /** Low-pass on the whole station, for a warmer, dustier sound. */
  tone?: number;
}

export const STATION_SOUND: Record<RadioStation, StationSound> = {
  lofi: { bpm: 76, swing: 0.28, reverb: 0.18, tone: 6000 },
  synthwave: { bpm: 100, swing: 0, reverb: 0.22, pump: true, delay: 3, tone: 5200 },
  rain: { bpm: 64, swing: 0, reverb: 0.5, rainBed: 0.55, tone: 3200 },
  drone: { bpm: 60, swing: 0, reverb: 0.45, binaural: { carrier: 200, beat: 40 }, tone: 1800 },
  noise: { bpm: 60, swing: 0, reverb: 0, noiseBed: "brown" },
};

export const sixteenthSeconds = (bpm: number) => 60 / bpm / 4;
export const barSeconds = (bpm: number) => sixteenthSeconds(bpm) * 16;
export const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export type Rng = () => number;

/** Small, fast seeded generator (mulberry32). */
export function seeded(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rng: Rng, items: readonly T[]) => items[Math.floor(rng() * items.length)];
const chance = (rng: Rng, p: number) => rng() < p;
const around = (rng: Rng, value: number, spread: number) => Math.max(0.05, Math.min(1, value + (rng() - 0.5) * 2 * spread));

const QUALITIES = {
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 14],
  m7: [0, 3, 7, 10],
  m9: [0, 3, 7, 10, 14],
  dom13: [0, 4, 10, 14, 21],
  six9: [0, 4, 9, 14],
  lyd: [0, 4, 7, 11, 18],
  maj: [0, 4, 7, 12],
  min: [0, 3, 7, 12],
  sus2: [0, 7, 14, 19],
  open: [0, 7, 16, 19],
} as const;

type Quality = keyof typeof QUALITIES;
type Chord = [degree: number, quality: Quality];

/** Chord tones with the lowest note in the octave starting at `low` (E3 by default). */
export function voiceChord(root: number, quality: Quality, low = 52): number[] {
  const shift = Math.ceil((low - root) / 12) * 12;
  return QUALITIES[quality].map((interval) => root + shift + interval);
}

function bassNote(root: number, low = 33, high = 45) {
  let note = root;
  while (note < low) note += 12;
  while (note > high) note -= 12;
  return note;
}

const PENTATONIC = [0, 2, 4, 7, 9];

export interface Composer {
  bar(index: number): NoteEvent[];
}

/* ---- Midnight Coffee: lo-fi ---- */

const LOFI_PROGRESSIONS: Chord[][] = [
  [[2, "m9"], [7, "dom13"], [0, "maj9"], [9, "m7"]],
  [[5, "maj7"], [4, "m7"], [2, "m9"], [0, "maj9"]],
  [[9, "m9"], [2, "m9"], [7, "dom13"], [0, "maj9"]],
  [[0, "maj9"], [9, "m7"], [5, "maj7"], [7, "dom13"]],
  [[5, "maj7"], [7, "dom13"], [4, "m7"], [9, "m7"]],
];

function lofi(rng: Rng): Composer {
  const key = pick(rng, [0, 2, 3, 5, 7, 10]) + 48;
  let progression = pick(rng, LOFI_PROGRESSIONS);
  return {
    bar(index) {
      const events: NoteEvent[] = [];
      const position = index % 4;
      if (index > 0 && position === 0 && !chance(rng, 0.55)) progression = pick(rng, LOFI_PROGRESSIONS.filter((item) => item !== progression));
      const [degree, quality] = progression[position];
      const chord = voiceChord(key + degree, quality);
      const root = bassNote(key + degree);
      const section = index % 16;
      const breakdown = section >= 14;
      const intro = index < 2;

      events.push({ voice: "ep", step: 0, dur: 15, notes: chord, vel: around(rng, 0.55, 0.06) });
      if (chance(rng, 0.4)) events.push({ voice: "ep", step: pick(rng, [10, 11]), dur: 5, notes: chord.slice(-3), vel: around(rng, 0.32, 0.05) });

      events.push({ voice: "bass", step: 0, dur: 6, notes: [root], vel: 0.72 });
      events.push({ voice: "bass", step: pick(rng, [10, 11]), dur: 4, notes: [chance(rng, 0.6) ? root : root + 7], vel: 0.55 });
      if (chance(rng, 0.25)) events.push({ voice: "bass", step: 14, dur: 2, notes: [root + 12], vel: 0.4 });

      if (!breakdown) {
        events.push({ voice: "kick", step: 0, dur: 1, notes: [], vel: intro ? 0.6 : 0.9 });
        events.push({ voice: "kick", step: 10, dur: 1, notes: [], vel: 0.72 });
        if (chance(rng, 0.25)) events.push({ voice: "kick", step: 7, dur: 1, notes: [], vel: 0.45 });
        if (!intro) {
          events.push({ voice: "snare", step: 4, dur: 1, notes: [], vel: around(rng, 0.7, 0.05) });
          events.push({ voice: "snare", step: 12, dur: 1, notes: [], vel: around(rng, 0.72, 0.05) });
          if (chance(rng, 0.2)) events.push({ voice: "snare", step: 15, dur: 1, notes: [], vel: 0.22 });
        }
      } else if (section === 15) {
        events.push({ voice: "kick", step: 12, dur: 1, notes: [], vel: 0.5 });
      }
      for (let step = 0; step < 16; step += 2) {
        if (chance(rng, breakdown ? 0.5 : 0.12)) continue;
        events.push({ voice: "hat", step, dur: 1, notes: [], vel: around(rng, step % 4 === 0 ? 0.42 : 0.32, 0.06) });
        if (!breakdown && chance(rng, 0.15)) events.push({ voice: "hat", step: step + 1, dur: 1, notes: [], vel: 0.18 });
      }
      if (!breakdown && chance(rng, 0.12)) events.push({ voice: "openHat", step: 14, dur: 2, notes: [], vel: 0.3 });

      if (!intro && chance(rng, 0.35)) {
        const steps = [2, 3, 6, 8, 11, 13].filter(() => chance(rng, 0.5)).slice(0, 4);
        for (const step of steps) events.push({ voice: "pluck", step, dur: 3, notes: [key + 24 + pick(rng, PENTATONIC)], vel: around(rng, 0.38, 0.07) });
      }
      const crackles = 3 + Math.floor(rng() * 4);
      for (let count = 0; count < crackles; count += 1) events.push({ voice: "crackle", step: rng() * 16, dur: 0, notes: [], vel: around(rng, 0.2, 0.1) });
      return events;
    },
  };
}

/* ---- Neon Outrun: synthwave ---- */

const SYNTH_PROGRESSIONS: Chord[][] = [
  [[5, "min"], [1, "maj"], [8, "maj"], [3, "maj"]],
  [[5, "min"], [3, "maj"], [1, "maj"], [3, "maj"]],
  [[5, "min"], [8, "maj"], [3, "maj"], [1, "maj"]],
];

function synthwave(rng: Rng): Composer {
  const key = 36; // around C2; progressions are written from F minor's relative major
  let progression = pick(rng, SYNTH_PROGRESSIONS);
  return {
    bar(index) {
      const events: NoteEvent[] = [];
      const position = index % 4;
      if (index > 0 && position === 0 && chance(rng, 0.35)) progression = pick(rng, SYNTH_PROGRESSIONS);
      const [degree, quality] = progression[position];
      const root = bassNote(key + degree, 36, 47);
      const chord = voiceChord(key + degree, quality, 55);
      const section = index % 16;
      const breakdown = section >= 12 && section < 14;
      const intro = index < 2;

      events.push({ voice: "pad", step: 0, dur: 16, notes: chord, vel: 0.4 });
      if (!breakdown) {
        for (let step = 0; step < 16; step += 2) events.push({ voice: "sawBass", step, dur: 2, notes: [step % 4 === 0 ? root : root + 12], vel: step === 0 ? 0.75 : 0.58 });
      }
      if (!intro) {
        const tones = [...chord.slice(0, 3).map((note) => note + 12), chord[0] + 24];
        const shape = pick(rng, [[0, 1, 2, 3, 2, 1, 2, 3], [0, 2, 1, 3, 0, 2, 1, 3], [3, 2, 1, 0, 1, 2, 3, 2]]);
        for (let step = 0; step < 16; step += 1) {
          if (breakdown && step % 2) continue;
          events.push({ voice: "arp", step, dur: 1, notes: [tones[shape[step % shape.length]]], vel: around(rng, step % 4 === 0 ? 0.36 : 0.26, 0.04) });
        }
      }
      if (!breakdown) {
        for (const step of [0, 4, 8, 12]) events.push({ voice: "kick", step, dur: 1, notes: [], vel: 0.88 });
        if (!intro) for (const step of [4, 12]) events.push({ voice: "snare", step, dur: 1, notes: [], vel: 0.62 });
        for (const step of [2, 6, 10, 14]) events.push({ voice: "openHat", step, dur: 1, notes: [], vel: 0.26 });
      }
      return events;
    },
  };
}

/* ---- Rainy Sanctuary: piano ---- */

const RAIN_PROGRESSIONS: Chord[][] = [
  [[0, "maj9"], [9, "m9"], [5, "lyd"], [7, "six9"]],
  [[5, "lyd"], [0, "maj9"], [9, "m9"], [7, "six9"]],
  [[9, "m9"], [5, "lyd"], [0, "maj9"], [4, "m7"]],
];

function rain(rng: Rng): Composer {
  const key = 48 + pick(rng, [0, 2, 5, 7]);
  let progression = pick(rng, RAIN_PROGRESSIONS);
  return {
    bar(index) {
      const events: NoteEvent[] = [];
      // Each chord lasts two bars.
      const chordIndex = Math.floor(index / 2) % 4;
      if (index > 0 && index % 8 === 0 && chance(rng, 0.5)) progression = pick(rng, RAIN_PROGRESSIONS);
      const [degree, quality] = progression[chordIndex];
      const chord = voiceChord(key + degree, quality, 48);
      if (index % 2 === 0) {
        events.push({ voice: "slowPad", step: 0, dur: 32, notes: chord.slice(0, 3), vel: 0.18 });
        events.push({ voice: "piano", step: 0, dur: 24, notes: [bassNote(key + degree, 36, 47)], vel: 0.4 });
        chord.slice(0, 4).forEach((note, order) => events.push({ voice: "piano", step: 2 + order * 2, dur: 20, notes: [note + 12], vel: around(rng, 0.34, 0.06) }));
      } else {
        const steps = [0, 3, 4, 6, 8, 10, 12].filter(() => chance(rng, 0.35)).slice(0, 3);
        for (const step of steps) events.push({ voice: "piano", step, dur: 14, notes: [key + 24 + pick(rng, PENTATONIC)], vel: around(rng, 0.3, 0.07) });
      }
      const drops = 3 + Math.floor(rng() * 5);
      for (let count = 0; count < drops; count += 1) events.push({ voice: "drop", step: rng() * 16, dur: 0, notes: [84 + Math.floor(rng() * 16)], vel: around(rng, 0.12, 0.08) });
      return events;
    },
  };
}

/* ---- Deep Flow: binaural drone ---- */

const DRONE_CHORDS: Chord[] = [[9, "sus2"], [5, "open"], [0, "sus2"], [7, "sus2"]];

function drone(rng: Rng): Composer {
  const key = 36;
  return {
    bar(index) {
      const events: NoteEvent[] = [];
      if (index % 2 === 0) {
        const [degree, quality] = DRONE_CHORDS[(index / 2) % DRONE_CHORDS.length];
        events.push({ voice: "slowPad", step: 0, dur: 40, notes: voiceChord(key + degree, quality, 40), vel: 0.34 });
      }
      if (chance(rng, 0.3)) events.push({ voice: "bell", step: pick(rng, [2, 6, 10]), dur: 16, notes: [69 + pick(rng, [0, 3, 5, 7, 10])], vel: around(rng, 0.14, 0.04) });
      return events;
    },
  };
}

export function createComposer(station: RadioStation, seed = Date.now()): Composer {
  const rng = seeded(seed);
  switch (station) {
    case "lofi": return lofi(rng);
    case "synthwave": return synthwave(rng);
    case "rain": return rain(rng);
    case "drone": return drone(rng);
    case "noise": return { bar: () => [] };
  }
}
