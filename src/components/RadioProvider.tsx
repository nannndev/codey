import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { SYNC_EVENT } from "@/lib/account-sync";
import { flowRadioIfLoaded, loadFlowRadio, type RadioStation, RADIO_STATIONS, type RadioStationInfo } from "@/utils/flow-radio-engine";

interface RadioPreferences {
  station: RadioStation;
  volume: number;
  rainMix: number;
  rainEnabled: boolean;
}

const STORAGE_KEY = "codetype-flow-radio";

const DEFAULT_PREFERENCES: RadioPreferences = {
  station: "lofi",
  volume: 50,
  rainMix: 30,
  rainEnabled: false,
};

interface RadioContextValue {
  isPlaying: boolean;
  station: RadioStation;
  stationInfo: RadioStationInfo;
  volume: number;
  rainMix: number;
  rainEnabled: boolean;
  /** When the focus timer stops the music (ms since epoch), or null. */
  timerEndsAt: number | null;
  togglePlay: () => void;
  setStation: (station: RadioStation) => void;
  nextStation: () => void;
  previousStation: () => void;
  setVolume: (volume: number) => void;
  setRainMix: (mix: number) => void;
  toggleRain: () => void;
  /** Stop after this many minutes; null clears the timer. */
  setTimer: (minutes: number | null) => void;
  getAnalyser: () => AnalyserNode | null;
}

const RadioContext = createContext<RadioContextValue | null>(null);

function loadPreferences(): RadioPreferences {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_PREFERENCES;
    const parsed = { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) } as RadioPreferences;
    if (!RADIO_STATIONS.some((station) => station.id === parsed.station)) parsed.station = "lofi";
    return parsed;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function savePreferences(prefs: RadioPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

const ambience = (prefs: RadioPreferences) => (prefs.rainEnabled ? prefs.rainMix / 100 : 0);

export function RadioProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<RadioPreferences>(loadPreferences);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);

  // Another device changed this; the account sync wrote it to storage.
  useEffect(() => {
    const onSync = (event: Event) => {
      if ((event as CustomEvent<string[]>).detail?.includes("radio")) setPrefs(loadPreferences());
    };
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, []);

  useEffect(() => {
    savePreferences(prefs);
    const engine = flowRadioIfLoaded();
    engine?.setVolume(prefs.volume / 100);
    engine?.setRainMix(ambience(prefs));
    engine?.setStation(prefs.station);
  }, [prefs]);

  const stationInfo = RADIO_STATIONS.find((station) => station.id === prefs.station) || RADIO_STATIONS[0];

  const play = useCallback(() => {
    setIsPlaying(true);
    void loadFlowRadio().then((engine) => {
      engine.setVolume(prefs.volume / 100);
      engine.setRainMix(ambience(prefs));
      engine.start(prefs.station);
    });
  }, [prefs]);

  const pause = useCallback(() => {
    flowRadioIfLoaded()?.stop();
    setIsPlaying(false);
    setTimerEndsAt(null);
  }, []);

  const togglePlay = useCallback(() => (isPlaying ? pause() : play()), [isPlaying, pause, play]);

  const setStation = useCallback((station: RadioStation) => setPrefs((prev) => ({ ...prev, station })), []);

  const stepStation = useCallback((direction: 1 | -1) => {
    setPrefs((prev) => {
      const index = RADIO_STATIONS.findIndex((station) => station.id === prev.station);
      const next = RADIO_STATIONS[(index + direction + RADIO_STATIONS.length) % RADIO_STATIONS.length];
      return { ...prev, station: next.id };
    });
  }, []);

  const setVolume = useCallback((volume: number) => setPrefs((prev) => ({ ...prev, volume: Math.max(0, Math.min(100, volume)) })), []);
  const setRainMix = useCallback((rainMix: number) => setPrefs((prev) => ({ ...prev, rainMix: Math.max(0, Math.min(100, rainMix)), rainEnabled: true })), []);
  const toggleRain = useCallback(() => setPrefs((prev) => ({ ...prev, rainEnabled: !prev.rainEnabled })), []);

  const setTimer = useCallback((minutes: number | null) => {
    setTimerEndsAt(minutes ? Date.now() + minutes * 60_000 : null);
    if (minutes && !isPlaying) play();
  }, [play, isPlaying]);

  // Focus timer: fade out when the session is over.
  useEffect(() => {
    if (!timerEndsAt) return;
    const timeout = window.setTimeout(pause, Math.max(0, timerEndsAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [timerEndsAt, pause]);

  // System media controls: keyboard media keys, the lock screen, headphones.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    try {
      session.metadata = new MediaMetadata({ title: stationInfo.name, artist: "Codey Flow Radio", album: stationInfo.genre });
      session.playbackState = isPlaying ? "playing" : "paused";
      session.setActionHandler("play", play);
      session.setActionHandler("pause", pause);
      session.setActionHandler("nexttrack", () => stepStation(1));
      session.setActionHandler("previoustrack", () => stepStation(-1));
    } catch {
      // Some browsers expose only part of the API.
    }
  }, [stationInfo, isPlaying, play, pause, stepStation]);

  const value = useMemo<RadioContextValue>(() => ({
    isPlaying,
    station: prefs.station,
    stationInfo,
    volume: prefs.volume,
    rainMix: prefs.rainMix,
    rainEnabled: prefs.rainEnabled,
    timerEndsAt,
    togglePlay,
    setStation,
    nextStation: () => stepStation(1),
    previousStation: () => stepStation(-1),
    setVolume,
    setRainMix,
    toggleRain,
    setTimer,
    getAnalyser: () => flowRadioIfLoaded()?.getAnalyser() ?? null,
  }), [isPlaying, prefs, stationInfo, timerEndsAt, togglePlay, setStation, stepStation, setVolume, setRainMix, toggleRain, setTimer]);

  return <RadioContext.Provider value={value}>{children}</RadioContext.Provider>;
}

export function useFlowRadio() {
  const context = useContext(RadioContext);
  if (!context) {
    throw new Error("useFlowRadio must be used within a RadioProvider");
  }
  return context;
}
