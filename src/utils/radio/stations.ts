/** Flow Radio stations: what the player shows. The music itself loads on first play. */

export type RadioStation = "lofi" | "synthwave" | "rain" | "drone" | "noise";

export interface RadioStationInfo {
  id: RadioStation;
  name: string;
  genre: string;
  description: string;
  /** Accent colour for the player. */
  accent: string;
  /** Kept for older callers; the player draws its own icons. */
  icon: string;
  /** Binaural audio only works on headphones. */
  headphones?: boolean;
}

export const RADIO_STATIONS: RadioStationInfo[] = [
  { id: "lofi", name: "Midnight Coffee", genre: "Lo-fi chillhop · 76 BPM", description: "Dusty Rhodes chords, swung drums and vinyl crackle.", accent: "#f59e0b", icon: "☕" },
  { id: "synthwave", name: "Neon Outrun", genre: "Synthwave · 100 BPM", description: "Pumping pads, rolling saw bass and delayed arps.", accent: "#e879f9", icon: "🌆" },
  { id: "rain", name: "Rainy Sanctuary", genre: "Rain & piano · 64 BPM", description: "Soft piano over rain on the window.", accent: "#38bdf8", icon: "🌧️" },
  { id: "drone", name: "Deep Flow 40 Hz", genre: "Binaural gamma · ambient", description: "A true 40 Hz binaural beat under slow warm pads.", accent: "#34d399", icon: "🧘", headphones: true },
  { id: "noise", name: "Brown Noise", genre: "Focus noise", description: "Deep, steady brown noise that masks the room.", accent: "#fb923c", icon: "🌊" },
];
