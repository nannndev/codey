import { barSeconds, createComposer, sixteenthSeconds, STATION_SOUND, type Composer, type RadioStation } from "./music";
import { buildReverb, NoiseBank, Voices, type VoiceOutputs } from "./voices";

/**
 * Flow Radio engine: a look-ahead scheduler on the audio clock (so music does
 * not stutter when timers are throttled), station crossfades, a shared
 * reverb and compressor, and an offline renderer for previews and tests.
 */

const LOOKAHEAD = 1.6; // seconds of music scheduled ahead of the clock
const TICK_MS = 200;
const CROSSFADE = 1.6;

/** Loudness trims so switching stations does not jump in volume. */
const STATION_LEVEL: Record<RadioStation, number> = { lofi: 0.87, synthwave: 1.04, rain: 3.2, drone: 2.1, noise: 1 };

interface Chain {
  input: GainNode;
  reverb: ConvolverNode;
  master: GainNode;
  analyser: AnalyserNode;
  noise: NoiseBank;
  voices: Voices;
}

function buildChain(ctx: BaseAudioContext): Chain {
  const input = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 12;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.25;
  const master = ctx.createGain();
  master.gain.value = 0;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.78;
  const reverb = buildReverb(ctx);
  const reverbReturn = ctx.createGain();
  reverbReturn.gain.value = 0.55;
  reverb.connect(reverbReturn);
  reverbReturn.connect(input);
  input.connect(compressor);
  compressor.connect(master);
  master.connect(analyser);
  analyser.connect(ctx.destination);
  const noise = new NoiseBank(ctx);
  return { input, reverb, master, analyser, noise, voices: new Voices(ctx, noise) };
}

/** One station playing: its buses, beds and composer. */
class Session {
  readonly out: VoiceOutputs;
  readonly bus: GainNode;
  private wetFade: GainNode;
  private sources: AudioScheduledSourceNode[] = [];
  private composer: Composer;
  private sixteenth: number;
  private barLength: number;
  nextBar = 0;
  private barIndex = 0;

  constructor(private ctx: BaseAudioContext, private chain: Chain, readonly station: RadioStation, start: number, fadeIn: number, seed?: number) {
    const sound = STATION_SOUND[station];
    this.composer = createComposer(station, seed);
    this.sixteenth = sixteenthSeconds(sound.bpm);
    this.barLength = barSeconds(sound.bpm);
    this.nextBar = start;

    this.bus = ctx.createGain();
    const level = STATION_LEVEL[station];
    this.bus.gain.setValueAtTime(0.0001, start);
    this.bus.gain.linearRampToValueAtTime(level, start + fadeIn);
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = sound.tone ?? 18000;
    tone.connect(this.bus);
    this.bus.connect(chain.input);

    // The reverb send follows the station fade too, so tails leave with it.
    this.wetFade = ctx.createGain();
    this.wetFade.gain.setValueAtTime(0.0001, start);
    this.wetFade.gain.linearRampToValueAtTime(1, start + fadeIn);
    this.wetFade.connect(chain.reverb);
    const wet = ctx.createGain();
    wet.gain.value = sound.reverb;
    wet.connect(this.wetFade);

    const ducked = ctx.createGain();
    ducked.connect(tone);
    this.out = { dry: tone, wet, ducked: sound.pump ? ducked : undefined };

    if (sound.delay) {
      const delay = ctx.createDelay(2);
      delay.delayTime.value = this.sixteenth * sound.delay;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.38;
      const back = ctx.createGain();
      back.gain.value = 0.45;
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(back);
      back.connect(ducked);
      this.out.delay = delay;
    }

    if (sound.rainBed) this.bed(chain.noise.pink, sound.rainBed * 0.14, 450, 5200, start);
    if (sound.noiseBed === "brown") this.bed(chain.noise.brown, 0.75, 20, 900, start, true);
    if (sound.binaural) this.binaural(sound.binaural.carrier, sound.binaural.beat, start);
  }

  private bed(buffer: AudioBuffer, level: number, low: number, high: number, start: number, drift = false) {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const highpass = this.ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = low;
    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = high;
    const gain = this.ctx.createGain();
    gain.gain.value = level;
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.bus);
    if (drift) {
      // A slow sweep keeps static noise from sounding frozen.
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.04;
      const depth = this.ctx.createGain();
      depth.gain.value = 260;
      lfo.connect(depth);
      depth.connect(lowpass.frequency);
      lfo.start(start);
      this.sources.push(lfo);
    }
    source.start(start, Math.random() * buffer.duration);
    this.sources.push(source);
  }

  /** Left and right tones a few hertz apart; the brain hears the difference as a beat. */
  private binaural(carrier: number, beat: number, start: number) {
    const merger = this.ctx.createChannelMerger(2);
    const gain = this.ctx.createGain();
    gain.gain.value = 0.07;
    [carrier, carrier + beat].forEach((frequency, channel) => {
      const osc = this.ctx.createOscillator();
      osc.frequency.value = frequency;
      osc.connect(merger, 0, channel);
      osc.start(start);
      this.sources.push(osc);
    });
    merger.connect(gain);
    gain.connect(this.bus);
  }

  /** Writes every bar that starts before `until`. */
  schedule(until: number) {
    while (this.nextBar < until) {
      const barStart = this.nextBar;
      const swing = STATION_SOUND[this.station].swing;
      for (const event of this.composer.bar(this.barIndex)) {
        const whole = Math.floor(event.step);
        const late = whole % 2 === 1 && Number.isInteger(event.step) ? swing * this.sixteenth : 0;
        this.chain.voices.play(event, barStart + event.step * this.sixteenth + late, this.sixteenth, this.out);
      }
      this.nextBar += this.barLength;
      this.barIndex += 1;
    }
  }

  /** Fades out, then stops continuous sources and lets go of the graph. */
  end(at: number, fade: number) {
    for (const param of [this.bus.gain, this.wetFade.gain]) {
      param.cancelScheduledValues(at);
      param.setValueAtTime(param.value || 0.0001, at);
      param.linearRampToValueAtTime(0.0001, at + fade);
    }
    for (const source of this.sources) {
      try {
        source.stop(at + fade + 0.1);
      } catch {
        // already stopped
      }
    }
    return at + fade + 0.2;
  }

  disconnect() {
    this.bus.disconnect();
    this.wetFade.disconnect();
  }
}

/** Renders a station to an AudioBuffer, for previews and loudness checks. */
export async function renderStation(station: RadioStation, seconds: number, seed = 1, sampleRate = 44100): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const chain = buildChain(ctx);
  chain.master.gain.value = 0.5;
  const session = new Session(ctx, chain, station, 0.05, 0.5, seed);
  session.schedule(seconds);
  return ctx.startRendering();
}

export class FlowRadioEngine {
  private ctx: AudioContext | null = null;
  private chain: Chain | null = null;
  private session: Session | null = null;
  private timer: number | null = null;
  private stopTimer: number | null = null;
  private ambience: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private playing = false;
  private station: RadioStation = "lofi";
  private volume = 0.5;
  private rainMix = 0.3;

  get isPlaying() {
    return this.playing;
  }

  getAnalyser(): AnalyserNode | null {
    return this.chain?.analyser ?? null;
  }

  private ensure() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx({ latencyHint: "playback" });
      this.chain = buildChain(this.ctx);
    }
    return { ctx: this.ctx, chain: this.chain! };
  }

  /** Perceptual curve: the slider's middle sounds like the middle. */
  private masterLevel() {
    return this.volume ** 2 * 1.4;
  }

  start(station: RadioStation = this.station) {
    const { ctx, chain } = this.ensure();
    if (this.stopTimer !== null) {
      window.clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    void ctx.resume();
    this.station = station;
    const now = ctx.currentTime;
    chain.master.gain.cancelScheduledValues(now);
    chain.master.gain.setValueAtTime(chain.master.gain.value, now);
    chain.master.gain.linearRampToValueAtTime(this.masterLevel(), now + 0.8);
    if (!this.session || this.session.station !== station || !this.playing) {
      this.session?.end(now, 0.3);
      this.session = new Session(ctx, chain, station, now + 0.08, 1.2);
    }
    this.startAmbience();
    this.playing = true;
    if (this.timer === null) this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  stop() {
    if (!this.ctx || !this.chain || !this.playing) return;
    this.playing = false;
    const now = this.ctx.currentTime;
    const master = this.chain.master.gain;
    master.cancelScheduledValues(now);
    master.setValueAtTime(master.value, now);
    master.linearRampToValueAtTime(0.0001, now + 0.6);
    this.stopTimer = window.setTimeout(() => {
      this.stopTimer = null;
      if (this.timer !== null) window.clearInterval(this.timer);
      this.timer = null;
      const at = this.ctx!.currentTime;
      const done = this.session?.end(at, 0.05) ?? at;
      const ending = this.session;
      this.session = null;
      this.stopAmbience();
      window.setTimeout(() => {
        ending?.disconnect();
        if (!this.playing) void this.ctx?.suspend();
      }, Math.max(0, (done - at) * 1000) + 100);
    }, 700);
  }

  setStation(station: RadioStation) {
    if (station === this.station && this.session) return;
    this.station = station;
    if (!this.playing || !this.ctx || !this.chain) return;
    const now = this.ctx.currentTime;
    const old = this.session;
    const done = old?.end(now, CROSSFADE) ?? now;
    this.session = new Session(this.ctx, this.chain, station, now + 0.1, CROSSFADE);
    window.setTimeout(() => old?.disconnect(), (done - now) * 1000 + 200);
    this.tick();
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.ctx && this.chain && this.playing) this.chain.master.gain.setTargetAtTime(this.masterLevel(), this.ctx.currentTime, 0.05);
  }

  setRainMix(mix: number) {
    this.rainMix = Math.max(0, Math.min(1, mix));
    if (this.ctx && this.ambience) this.ambience.gain.gain.setTargetAtTime(this.rainMix * 0.55, this.ctx.currentTime, 0.2);
  }

  private tick() {
    if (!this.ctx || !this.session) return;
    const now = this.ctx.currentTime;
    // After the tab slept, skip ahead instead of cramming missed bars.
    if (this.session.nextBar < now - 0.05) this.session.nextBar = now + 0.05;
    this.session.schedule(now + LOOKAHEAD);
  }

  private startAmbience() {
    if (this.ambience || !this.ctx || !this.chain) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.chain.noise.pink;
    source.loop = true;
    const highpass = this.ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 500;
    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 6500;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    gain.gain.setTargetAtTime(this.rainMix * 0.55, this.ctx.currentTime, 0.4);
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.chain.input);
    source.start(this.ctx.currentTime, Math.random() * source.buffer.duration);
    this.ambience = { source, gain };
  }

  private stopAmbience() {
    if (!this.ambience) return;
    try {
      this.ambience.source.stop();
    } catch {
      // already stopped
    }
    this.ambience.gain.disconnect();
    this.ambience = null;
  }
}
