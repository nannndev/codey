import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { flowRadio, type RadioStation, RADIO_STATIONS, type RadioStationInfo } from "@/utils/flow-radio-engine";

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
  rainEnabled: true,
};

interface RadioContextValue {
  isPlaying: boolean;
  station: RadioStation;
  stationInfo: RadioStationInfo;
  volume: number;
  rainMix: number;
  rainEnabled: boolean;
  togglePlay: () => void;
  setStation: (station: RadioStation) => void;
  setVolume: (volume: number) => void;
  setRainMix: (mix: number) => void;
  toggleRain: () => void;
}

const RadioContext = createContext<RadioContextValue | null>(null);

function loadPreferences(): RadioPreferences {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
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

export function RadioProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<RadioPreferences>(loadPreferences);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    savePreferences(prefs);
  }, [prefs]);

  const currentStationInfo =
    RADIO_STATIONS.find((s) => s.id === prefs.station) || RADIO_STATIONS[0];

  const togglePlay = () => {
    if (isPlaying) {
      flowRadio.stop();
      setIsPlaying(false);
    } else {
      flowRadio.setVolume(prefs.volume / 100);
      flowRadio.setRainMix(prefs.rainEnabled ? prefs.rainMix / 100 : 0);
      flowRadio.start(prefs.station);
      setIsPlaying(true);
    }
  };

  const setStation = (newStation: RadioStation) => {
    setPrefs((prev) => ({ ...prev, station: newStation }));
    flowRadio.setStation(newStation);
  };

  const setVolume = (newVol: number) => {
    const clamped = Math.max(0, Math.min(100, newVol));
    setPrefs((prev) => ({ ...prev, volume: clamped }));
    flowRadio.setVolume(clamped / 100);
  };

  const setRainMix = (newMix: number) => {
    const clamped = Math.max(0, Math.min(100, newMix));
    setPrefs((prev) => ({ ...prev, rainMix: clamped }));
    if (prefs.rainEnabled) {
      flowRadio.setRainMix(clamped / 100);
    }
  };

  const toggleRain = () => {
    setPrefs((prev) => {
      const nextEnabled = !prev.rainEnabled;
      flowRadio.setRainMix(nextEnabled ? prev.rainMix / 100 : 0);
      return { ...prev, rainEnabled: nextEnabled };
    });
  };

  return (
    <RadioContext.Provider
      value={{
        isPlaying,
        station: prefs.station,
        stationInfo: currentStationInfo,
        volume: prefs.volume,
        rainMix: prefs.rainMix,
        rainEnabled: prefs.rainEnabled,
        togglePlay,
        setStation,
        setVolume,
        setRainMix,
        toggleRain,
      }}
    >
      {children}
    </RadioContext.Provider>
  );
}

export function useFlowRadio() {
  const context = useContext(RadioContext);
  if (!context) {
    throw new Error("useFlowRadio must be used within a RadioProvider");
  }
  return context;
}
