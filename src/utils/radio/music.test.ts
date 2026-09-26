import { describe, expect, it } from "vitest";
import { barSeconds, createComposer, midiToHz, RADIO_STATIONS, seeded, STATION_SOUND, voiceChord, type RadioStation } from "./music";

const MUSICAL: RadioStation[] = ["lofi", "synthwave", "rain", "drone"];
const bars = (station: RadioStation, count: number, seed = 42) => {
  const composer = createComposer(station, seed);
  return Array.from({ length: count }, (_, index) => composer.bar(index));
};

describe("Flow Radio composers", () => {
  it("keeps every event inside its bar with playable notes", () => {
    for (const station of MUSICAL) {
      for (const bar of bars(station, 32)) {
        for (const event of bar) {
          expect(event.step).toBeGreaterThanOrEqual(0);
          expect(event.step).toBeLessThan(16);
          expect(event.vel).toBeGreaterThan(0);
          expect(event.vel).toBeLessThanOrEqual(1);
          for (const note of event.notes) {
            expect(note).toBeGreaterThanOrEqual(24);
            expect(note).toBeLessThanOrEqual(108);
          }
        }
      }
    }
  });

  it("is repeatable for a seed and different across seeds", () => {
    expect(bars("lofi", 8, 7)).toEqual(bars("lofi", 8, 7));
    expect(bars("lofi", 8, 7)).not.toEqual(bars("lofi", 8, 8));
  });

  it("does not loop the same bar forever", () => {
    for (const station of ["lofi", "synthwave", "rain"] as RadioStation[]) {
      const distinct = new Set(bars(station, 16).map((bar) => JSON.stringify(bar)));
      expect(distinct.size).toBeGreaterThan(8);
    }
  });

  it("gives lo-fi a groove with a breakdown every sixteen bars", () => {
    const song = bars("lofi", 16);
    const snares = (index: number) => song[index].filter((event) => event.voice === "snare").length;
    expect(snares(4)).toBeGreaterThanOrEqual(2);
    expect(snares(14)).toBe(0);
    expect(song[0].some((event) => event.voice === "ep" && event.notes.length >= 4)).toBe(true);
  });

  it("changes the chord every bar in lo-fi and every two bars on the piano station", () => {
    const chordOf = (bar: ReturnType<typeof bars>[number], voice: string) => JSON.stringify(bar.find((event) => event.voice === voice)?.notes);
    const lofiSong = bars("lofi", 4);
    expect(new Set(lofiSong.map((bar) => chordOf(bar, "ep"))).size).toBeGreaterThan(1);
    const rainSong = bars("rain", 4);
    expect(rainSong[0].some((event) => event.voice === "slowPad")).toBe(true);
    expect(rainSong[1].some((event) => event.voice === "slowPad")).toBe(false);
  });

  it("leaves the noise station to its bed", () => {
    expect(bars("noise", 4).flat()).toEqual([]);
    expect(STATION_SOUND.noise.noiseBed).toBe("brown");
  });
});

describe("helpers", () => {
  it("tunes to A440 and voices chords around middle C", () => {
    expect(midiToHz(69)).toBeCloseTo(440);
    expect(midiToHz(57)).toBeCloseTo(220);
    const chord = voiceChord(38, "m9");
    expect(chord[0]).toBeGreaterThanOrEqual(52);
    expect(chord[0]).toBeLessThanOrEqual(63);
    expect(chord.map((note) => note - chord[0])).toEqual([0, 3, 7, 10, 14]);
  });

  it("has a real 40 Hz binaural beat and sensible tempos", () => {
    expect(STATION_SOUND.drone.binaural).toEqual({ carrier: 200, beat: 40 });
    expect(RADIO_STATIONS.find((station) => station.id === "drone")?.headphones).toBe(true);
    expect(barSeconds(STATION_SOUND.lofi.bpm)).toBeCloseTo((60 / 76) * 4);
  });

  it("seeds a uniform generator", () => {
    const rng = seeded(1);
    const values = Array.from({ length: 1000 }, rng);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    expect(values.reduce((sum, value) => sum + value, 0) / values.length).toBeCloseTo(0.5, 1);
  });
});
