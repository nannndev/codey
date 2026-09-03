import { Volume2, VolumeX, X, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreferences, type KeyboardSoundProfile } from "@/components/PreferencesProvider";
import { useKeyboardSound } from "@/hooks/useKeyboardSound";

interface SoundPackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SOUND_PACK_PRESETS: { id: KeyboardSoundProfile; name: string; tag: string; desc: string; icon: string }[] = [
  { id: "thock", name: "Holy Panda (Thock)", tag: "Tactile Thock", desc: "Deep, bassy thock with stem bottom-out sound", icon: "🐼" },
  { id: "clicky", name: "Cherry MX Blue", tag: "Crisp Clicky", desc: "High-pitched crisp tactile click & spring release", icon: "🔵" },
  { id: "linear", name: "Cherry MX Red", tag: "Smooth Linear", desc: "Soft, smooth linear stroke with gentle bottom-out thud", icon: "🔴" },
  { id: "tactile", name: "Topre Electro-Capacitive", tag: "Soft Tactile", desc: "Smooth rounded tactile bump with muffled dome pop", icon: "🏛️" },
  { id: "custom", name: "Cyberpunk Synth & Custom", tag: "Synth Tuning", desc: "Custom tuned synth frequency with adjustable click & damping", icon: "⚡" },
];

export function SoundPackModal({ isOpen, onClose }: SoundPackModalProps) {
  const { preferences, setPreference } = usePreferences();
  const playSound = useKeyboardSound(
    true,
    preferences.keyboardSoundProfile,
    preferences.keyboardSoundVolume,
    preferences.keyboardSoundTuning
  );

  if (!isOpen) return null;

  function handleTestKey() {
    playSound("a", true);
    setTimeout(() => playSound(" ", true), 120);
    setTimeout(() => playSound("Enter", true), 240);
  }

  function handleSelectProfile(id: KeyboardSoundProfile) {
    setPreference("keyboardSoundProfile", id);
    setPreference("keyboardSound", true);
    setTimeout(() => playSound("a", true), 50);
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Mechanical Keyboard Switch Sound Pack Engine"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl animate-scale-in space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🎹</span>
            <div>
              <h3 className="font-bold text-lg tracking-tight text-foreground">Mechanical Switch Audio Engine</h3>
              <p className="text-xs text-muted-foreground font-medium">Synthesized Web Audio switch profiles with realistic pitch variation.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Toggle Sound On/Off */}
        <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-3.5">
          <div className="flex items-center gap-2.5">
            {preferences.keyboardSound ? <Volume2 className="size-5 text-amber-400" /> : <VolumeX className="size-5 text-muted-foreground" />}
            <div>
              <p className="text-sm font-bold">Keypress Sound Effects</p>
              <p className="text-xs text-muted-foreground">Play mechanical switch sound on every keypress</p>
            </div>
          </div>
          <Button
            type="button"
            variant={preferences.keyboardSound ? "default" : "outline"}
            size="sm"
            onClick={() => setPreference("keyboardSound", !preferences.keyboardSound)}
          >
            {preferences.keyboardSound ? "Enabled" : "Muted"}
          </Button>
        </div>

        {/* Sound Pack Presets */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Switch Soundpack Presets</h4>
            <Button type="button" variant="outline" size="sm" onClick={handleTestKey} className="h-7 gap-1.5 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
              <Sparkles className="size-3" /> Test Sound
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {SOUND_PACK_PRESETS.map((preset) => {
              const isSelected = preferences.keyboardSound && preferences.keyboardSoundProfile === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectProfile(preset.id)}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all active:scale-[0.98] ${
                    isSelected
                      ? "border-amber-500/60 bg-amber-500/15 text-foreground ring-1 ring-amber-500/40 shadow-lg"
                      : "border-border/60 bg-card/60 hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="text-2xl select-none">{preset.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-foreground">{preset.name}</span>
                      {isSelected && <Check className="size-3.5 text-amber-400 shrink-0" />}
                    </div>
                    <span className="inline-block mt-0.5 text-[10px] font-mono text-amber-500 font-bold uppercase tracking-wider">{preset.tag}</span>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{preset.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Volume Slider */}
        <div className="space-y-2 border-t pt-4">
          <div className="flex justify-between text-xs">
            <span className="font-bold text-foreground">Audio Volume</span>
            <span className="font-mono text-muted-foreground tabular-nums font-bold">{preferences.keyboardSoundVolume}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={preferences.keyboardSoundVolume}
            onChange={(e) => setPreference("keyboardSoundVolume", parseInt(e.target.value, 10))}
            className="w-full accent-amber-500 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
