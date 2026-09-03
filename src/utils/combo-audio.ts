let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a synthesized tone or chord for combo milestone chimes.
 */
function playNote(freq: number, startDelay: number, duration: number, type: OscillatorType = "sine", gainLevel = 0.12) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime + startDelay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(gainLevel, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.05);
}

export function playComboMilestoneSound(streak: number, volume = 0.4) {
  const baseGain = Math.max(0.05, Math.min(0.25, 0.12 * (volume / 50)));

  if (streak === 25) {
    // Crisp two-note ping
    playNote(523.25, 0, 0.18, "triangle", baseGain); // C5
    playNote(659.25, 0.06, 0.22, "sine", baseGain); // E5
  } else if (streak === 50) {
    // Energetic triad
    playNote(523.25, 0, 0.16, "triangle", baseGain); // C5
    playNote(659.25, 0.06, 0.18, "triangle", baseGain); // E5
    playNote(783.99, 0.12, 0.28, "sine", baseGain * 1.2); // G5
  } else if (streak === 100) {
    // Overdrive triumphant arpeggio
    playNote(523.25, 0, 0.14, "triangle", baseGain); // C5
    playNote(659.25, 0.05, 0.14, "triangle", baseGain); // E5
    playNote(783.99, 0.1, 0.16, "triangle", baseGain); // G5
    playNote(1046.5, 0.16, 0.35, "sine", baseGain * 1.3); // C6
  } else if (streak > 100 && streak % 50 === 0) {
    // High combo loop fanfare
    playNote(659.25, 0, 0.12, "triangle", baseGain);
    playNote(783.99, 0.06, 0.14, "triangle", baseGain);
    playNote(1046.5, 0.12, 0.22, "sine", baseGain);
    playNote(1318.51, 0.18, 0.35, "sine", baseGain * 1.3);
  }
}

export function playComboLostSound(volume = 0.4) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const baseGain = Math.max(0.04, Math.min(0.2, 0.1 * (volume / 50)));

  osc.type = "sine";
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);

  gain.gain.setValueAtTime(baseGain, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.22);
}
