import { midiToHz, type NoteEvent } from "./music";

/**
 * Web Audio instruments for Flow Radio. Everything is synthesised: no
 * samples to download, and it works offline.
 */

export interface VoiceOutputs {
  /** Dry signal. */
  dry: AudioNode;
  /** Reverb send. */
  wet: AudioNode;
  /** Arp delay send, when the station has one. */
  delay?: AudioNode;
  /** Pads and arps go here so the kick can duck them. */
  ducked?: GainNode;
}

type Ctx = BaseAudioContext;

function envelope(gain: GainNode, time: number, peak: number, attack: number, hold: number, release: number) {
  const param = gain.gain;
  param.setValueAtTime(0.0001, time);
  param.linearRampToValueAtTime(peak, time + attack);
  param.setTargetAtTime(0.0001, time + attack + hold, release / 4);
}

/** Noise buffers built once per context. */
export class NoiseBank {
  readonly white: AudioBuffer;
  readonly pink: AudioBuffer;
  readonly brown: AudioBuffer;

  constructor(ctx: Ctx) {
    this.white = NoiseBank.build(ctx, 1, () => Math.random() * 2 - 1);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    this.pink = NoiseBank.build(ctx, 8, () => {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      const value = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
      return value;
    });
    let last = 0;
    this.brown = NoiseBank.build(ctx, 8, () => {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      return last * 3.2;
    });
  }

  /**
   * A seamless loop: the head is crossfaded with audio that continues past
   * the end, so the jump from the last sample back to the first is continuous.
   */
  private static build(ctx: Ctx, seconds: number, sample: () => number) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const fade = Math.floor(ctx.sampleRate * 0.25);
    const source = new Float32Array(length + fade);
    for (let index = 0; index < source.length; index += 1) source[index] = sample();
    // loop[length - 1] is followed by source[length], which the head fades in from.
    const loop = source.slice(0, length);
    for (let index = 0; index < fade; index += 1) {
      const weight = index / fade;
      loop[index] = source[index] * weight + source[length + index] * (1 - weight);
    }
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    // The right channel plays the same loop half a loop later, so the noise is wide.
    const offset = Math.floor(length / 2);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    for (let index = 0; index < length; index += 1) {
      left[index] = loop[index];
      right[index] = loop[(index + offset) % length];
    }
    return buffer;
  }
}

/** A stereo room for the reverb send. */
export function buildReverb(ctx: Ctx, seconds = 2.8) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 3;
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  return convolver;
}

export class Voices {
  constructor(private ctx: Ctx, private noise: NoiseBank) {}

  play(event: NoteEvent, time: number, sixteenth: number, out: VoiceOutputs) {
    const dur = Math.max(0.05, event.dur * sixteenth);
    switch (event.voice) {
      case "ep": return this.ep(event.notes, time, dur, event.vel, out);
      case "bass": return this.bass(event.notes[0], time, dur, event.vel, out);
      case "sawBass": return this.sawBass(event.notes[0], time, dur, event.vel, out);
      case "kick": return this.kick(time, event.vel, out);
      case "snare": return this.snare(time, event.vel, out);
      case "hat": return this.hat(time, event.vel, 0.035, out);
      case "openHat": return this.hat(time, event.vel, 0.18, out);
      case "pluck": return this.pluck(event.notes[0], time, event.vel, out);
      case "bell": return this.bell(event.notes[0], time, dur, event.vel, out);
      case "piano": return this.piano(event.notes[0], time, dur, event.vel, out);
      case "pad": return this.pad(event.notes, time, dur, event.vel, 0.4, 900, out);
      case "slowPad": return this.pad(event.notes, time, dur, event.vel, Math.min(3, dur / 3), 700, out);
      case "arp": return this.arp(event.notes[0], time, event.vel, out);
      case "crackle": return this.crackle(time, event.vel, out);
      case "drop": return this.drop(event.notes[0], time, event.vel, out);
    }
  }

  private osc(type: OscillatorType, frequency: number, time: number, end: number, detune = 0) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, time);
    if (detune) osc.detune.setValueAtTime(detune, time);
    osc.start(time);
    osc.stop(end);
    return osc;
  }

  private noiseSource(buffer: AudioBuffer, time: number, length: number) {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.start(time, Math.random() * (buffer.duration - length - 0.01), length);
    return source;
  }

  private connect(node: AudioNode, out: VoiceOutputs, wet = 1, delay = false, duck = false) {
    node.connect(duck && out.ducked ? out.ducked : out.dry);
    if (wet > 0) {
      const send = this.ctx.createGain();
      send.gain.value = wet;
      node.connect(send);
      send.connect(out.wet);
    }
    if (delay && out.delay) node.connect(out.delay);
  }

  /** Rhodes-like electric piano: soft bell attack, warm body, slow tremolo. */
  private ep(notes: number[], time: number, dur: number, vel: number, out: VoiceOutputs) {
    const bus = this.ctx.createGain();
    bus.gain.value = 1;
    const tremolo = this.osc("sine", 4.2, time, time + dur + 1);
    const depth = this.ctx.createGain();
    depth.gain.value = 0.12;
    tremolo.connect(depth);
    depth.connect(bus.gain);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2200, time);
    filter.frequency.exponentialRampToValueAtTime(900, time + dur);
    bus.connect(filter);
    this.connect(filter, out, 0.8);
    notes.forEach((note, index) => {
      const start = time + index * 0.018;
      const frequency = midiToHz(note);
      const end = start + dur + 1.2;
      const gain = this.ctx.createGain();
      envelope(gain, start, (0.1 * vel) / Math.sqrt(notes.length / 3), 0.012, 0.25, dur);
      const body = this.osc("sine", frequency, start, end, (Math.random() - 0.5) * 8);
      const tine = this.osc("sine", frequency * 2, start, end);
      const tineGain = this.ctx.createGain();
      tineGain.gain.setValueAtTime(0.35, start);
      tineGain.gain.exponentialRampToValueAtTime(0.02, start + 0.5);
      body.connect(gain);
      tine.connect(tineGain);
      tineGain.connect(gain);
      gain.connect(bus);
    });
  }

  private bass(note: number, time: number, dur: number, vel: number, out: VoiceOutputs) {
    const frequency = midiToHz(note);
    const gain = this.ctx.createGain();
    envelope(gain, time, 0.26 * vel, 0.01, dur * 0.7, 0.25);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    this.osc("sine", frequency, time, time + dur + 0.5).connect(gain);
    const edge = this.osc("triangle", frequency, time, time + dur + 0.5);
    const edgeGain = this.ctx.createGain();
    edgeGain.gain.value = 0.4;
    edge.connect(edgeGain);
    edgeGain.connect(gain);
    gain.connect(filter);
    this.connect(filter, out, 0);
  }

  private sawBass(note: number, time: number, dur: number, vel: number, out: VoiceOutputs) {
    const frequency = midiToHz(note);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 6;
    filter.frequency.setValueAtTime(1400, time);
    filter.frequency.exponentialRampToValueAtTime(220, time + dur * 0.8);
    const gain = this.ctx.createGain();
    envelope(gain, time, 0.16 * vel, 0.005, dur * 0.5, 0.12);
    this.osc("sawtooth", frequency, time, time + dur + 0.3).connect(filter);
    this.osc("sawtooth", frequency, time, time + dur + 0.3, 9).connect(filter);
    filter.connect(gain);
    this.connect(gain, out, 0.05);
  }

  private kick(time: number, vel: number, out: VoiceOutputs) {
    const osc = this.osc("sine", 130, time, time + 0.45);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.14);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.55 * vel, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.42);
    osc.connect(gain);
    this.connect(gain, out, 0);
    if (out.ducked) {
      const param = out.ducked.gain;
      param.cancelScheduledValues(time);
      param.setValueAtTime(0.35, time);
      param.setTargetAtTime(1, time + 0.02, 0.09);
    }
  }

  private snare(time: number, vel: number, out: VoiceOutputs) {
    const noise = this.noiseSource(this.noise.white, time, 0.3);
    const band = this.ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1900;
    band.Q.value = 0.8;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.32 * vel, time + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    noise.connect(band);
    band.connect(gain);
    this.connect(gain, out, 0.35);
    const body = this.osc("triangle", 190, time, time + 0.15);
    body.frequency.exponentialRampToValueAtTime(120, time + 0.1);
    const bodyGain = this.ctx.createGain();
    bodyGain.gain.setValueAtTime(0.18 * vel, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    body.connect(bodyGain);
    this.connect(bodyGain, out, 0.2);
  }

  private hat(time: number, vel: number, length: number, out: VoiceOutputs) {
    const noise = this.noiseSource(this.noise.white, time, length + 0.05);
    const high = this.ctx.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 7200;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.12 * vel, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
    noise.connect(high);
    high.connect(gain);
    this.connect(gain, out, 0.1);
  }

  private pluck(note: number, time: number, vel: number, out: VoiceOutputs) {
    const frequency = midiToHz(note);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.09 * vel, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.4);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2400;
    this.osc("triangle", frequency, time, time + 1.5).connect(filter);
    const overtone = this.osc("sine", frequency * 3, time, time + 0.4);
    const overtoneGain = this.ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.2, time);
    overtoneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    overtone.connect(overtoneGain);
    overtoneGain.connect(filter);
    filter.connect(gain);
    this.connect(gain, out, 0.6);
  }

  private bell(note: number, time: number, dur: number, vel: number, out: VoiceOutputs) {
    const frequency = midiToHz(note);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.08 * vel, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(3, dur));
    [1, 2.76, 5.4].forEach((ratio, index) => {
      const partial = this.osc("sine", frequency * ratio, time, time + Math.max(3, dur) + 0.1);
      const level = this.ctx.createGain();
      level.gain.value = [1, 0.35, 0.12][index];
      partial.connect(level);
      level.connect(gain);
    });
    this.connect(gain, out, 1.2);
  }

  /** A soft felt piano: fundamental plus fading overtones. */
  private piano(note: number, time: number, dur: number, vel: number, out: VoiceOutputs) {
    const frequency = midiToHz(note);
    const ring = Math.min(6, Math.max(1.5, dur));
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.14 * vel, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.05 * vel, time + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + ring);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200 + 2400 * vel, time);
    filter.frequency.exponentialRampToValueAtTime(700, time + ring);
    [1, 2, 3].forEach((ratio, index) => {
      const partial = this.osc(index ? "sine" : "triangle", frequency * ratio, time, time + ring + 0.1, (Math.random() - 0.5) * 4);
      const level = this.ctx.createGain();
      level.gain.value = [1, 0.4, 0.12][index];
      partial.connect(level);
      level.connect(filter);
    });
    filter.connect(gain);
    this.connect(gain, out, 1);
  }

  /** Two detuned saws per note, filtered warm; attack and release scale with the length. */
  private pad(notes: number[], time: number, dur: number, vel: number, attack: number, cutoff: number, out: VoiceOutputs) {
    const gain = this.ctx.createGain();
    const release = Math.min(3, attack * 1.5 + 0.8);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime((0.05 * vel) / Math.sqrt(notes.length / 3), time + attack);
    gain.gain.setValueAtTime((0.05 * vel) / Math.sqrt(notes.length / 3), time + Math.max(attack, dur - 0.05));
    gain.gain.setTargetAtTime(0.0001, time + Math.max(attack, dur), release / 4);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    filter.Q.value = 0.7;
    const end = time + dur + release + 0.2;
    for (const note of notes) {
      const frequency = midiToHz(note);
      this.osc("sawtooth", frequency, time, end, -7).connect(filter);
      this.osc("sawtooth", frequency, time, end, 7).connect(filter);
    }
    filter.connect(gain);
    this.connect(gain, out, 0.9, false, true);
  }

  private arp(note: number, time: number, vel: number, out: VoiceOutputs) {
    const frequency = midiToHz(note);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.07 * vel, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 3000;
    this.osc("square", frequency, time, time + 0.25).connect(filter);
    filter.connect(gain);
    this.connect(gain, out, 0.3, true, true);
  }

  /** A vinyl tick. */
  private crackle(time: number, vel: number, out: VoiceOutputs) {
    const noise = this.noiseSource(this.noise.white, time, 0.012);
    const high = this.ctx.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 2500;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05 * vel, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.01);
    noise.connect(high);
    high.connect(gain);
    this.connect(gain, out, 0);
  }

  /** A raindrop on glass: a short, falling, resonant blip. */
  private drop(note: number, time: number, vel: number, out: VoiceOutputs) {
    const frequency = midiToHz(note);
    const osc = this.osc("sine", frequency, time, time + 0.12);
    osc.frequency.exponentialRampToValueAtTime(frequency * 0.6, time + 0.08);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.05 * vel, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
    osc.connect(gain);
    this.connect(gain, out, 0.5);
  }
}
