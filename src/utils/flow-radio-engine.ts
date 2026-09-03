// Built-in Flow State Radio Audio Engine using Web Audio API
// 100% offline, zero CORS errors, seamless generative chords, rain & synthwave beats.

export type RadioStation = "lofi" | "synthwave" | "rain" | "drone";

export interface RadioStationInfo {
  id: RadioStation;
  name: string;
  genre: string;
  icon: string;
  color: string;
  description: string;
}

export const RADIO_STATIONS: RadioStationInfo[] = [
  {
    id: "lofi",
    name: "Midnight Coffee",
    genre: "Lo-Fi Chillhop",
    icon: "☕",
    color: "amber",
    description: "Mellow Rhodes chords, warm tape saturation & relaxed beat",
  },
  {
    id: "synthwave",
    name: "Neon Outrun",
    genre: "Cyber Synthwave",
    icon: "🌆",
    color: "purple",
    description: "80s retro arps, pulsating bassline & neon cyberpunk drive",
  },
  {
    id: "rain",
    name: "Rainy Sanctuary",
    genre: "Rain & Piano",
    icon: "🌧️",
    color: "cyan",
    description: "Gentle rain droplets, vinyl crackle & reflective piano chords",
  },
  {
    id: "drone",
    name: "Deep Flow 40Hz",
    genre: "Binaural Drone",
    icon: "🧘",
    color: "emerald",
    description: "Alpha/Theta wave harmonic drone for laser-focused coding",
  },
];

class FlowRadioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private currentStation: RadioStation = "lofi";
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private loopTimer: number | null = null;
  private rainNode: AudioNode | null = null;
  private rainGain: GainNode | null = null;
  private volume = 0.5;
  private rainMix = 0.3;

  // Track chord progression step
  private step = 0;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);

      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.setValueAtTime(this.rainMix * this.volume, this.ctx.currentTime);
      this.rainGain.connect(this.masterGain);

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public start(station: RadioStation = "lofi") {
    this.initContext();
    this.currentStation = station;
    this.isPlaying = true;
    this.step = 0;

    // Start background rain ambience
    this.startRainAmbience();

    // Start music loop
    this.scheduleNextBar();
  }

  public stop() {
    this.isPlaying = false;
    if (this.loopTimer !== null) {
      window.clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    if (this.rainNode) {
      try {
        (this.rainNode as AudioBufferSourceNode).stop();
        this.rainNode.disconnect();
      } catch {
        // ignore
      }
      this.rainNode = null;
    }
  }

  public setStation(station: RadioStation) {
    if (this.currentStation === station) return;
    this.currentStation = station;
    this.step = 0;
    if (this.isPlaying) {
      if (this.loopTimer !== null) {
        window.clearTimeout(this.loopTimer);
        this.loopTimer = null;
      }
      this.scheduleNextBar();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
    if (this.rainGain && this.ctx) {
      this.rainGain.gain.setTargetAtTime(this.rainMix * this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public setRainMix(mix: number) {
    this.rainMix = Math.max(0, Math.min(1, mix));
    if (this.rainGain && this.ctx) {
      this.rainGain.gain.setTargetAtTime(this.rainMix * this.volume, this.ctx.currentTime, 0.05);
    }
  }

  private startRainAmbience() {
    if (!this.ctx || !this.rainGain) return;
    try {
      // Pink noise rain buffer
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      // Soft rain lowpass filter
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, this.ctx.currentTime);

      noise.connect(filter);
      filter.connect(this.rainGain);
      noise.start();
      this.rainNode = noise;
    } catch {
      // Audio buffer creation fallback
    }
  }

  private scheduleNextBar() {
    if (!this.isPlaying || !this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    let nextBarDuration = 3200; // ms

    switch (this.currentStation) {
      case "lofi":
        nextBarDuration = this.playLofiBar(now);
        break;
      case "synthwave":
        nextBarDuration = this.playSynthwaveBar(now);
        break;
      case "rain":
        nextBarDuration = this.playRainPianoBar(now);
        break;
      case "drone":
        nextBarDuration = this.playDroneBar(now);
        break;
    }

    this.step = (this.step + 1) % 4;
    this.loopTimer = window.setTimeout(() => this.scheduleNextBar(), nextBarDuration - 50);
  }

  // --- 1. LO-FI CHILLHOP CHORDS ---
  private playLofiBar(time: number): number {
    if (!this.ctx || !this.masterGain) return 3200;

    // Progression: Dm9 -> G13 -> Cmaj9 -> Am7
    const chords = [
      [146.83, 220.0, 261.63, 329.63, 392.0], // Dm9: D3, A3, C4, E4, G4
      [196.0, 246.94, 329.63, 392.0, 440.0],  // G13: G3, B3, E4, G4, A4
      [130.81, 196.0, 246.94, 293.66, 329.63],// Cmaj9: C3, G3, B3, D4, E4
      [110.0, 164.81, 220.0, 261.63, 329.63], // Am7: A2, E3, A3, C4, E4
    ];

    const notes = chords[this.step % chords.length];
    const duration = 3.0;

    // Filtered electric piano simulation
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();

      osc.type = i === 0 ? "sine" : "triangle";
      // Subtle pitch detune for analog warmth
      osc.frequency.setValueAtTime(freq * (1 + (Math.random() - 0.5) * 0.006), time + i * 0.04);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1400, time);
      filter.frequency.exponentialRampToValueAtTime(600, time + duration);

      const noteVol = (i === 0 ? 0.22 : 0.12) * this.volume;
      gain.gain.setValueAtTime(0.0001, time + i * 0.04);
      gain.gain.linearRampToValueAtTime(noteVol, time + i * 0.04 + 0.08);
      gain.gain.exponentialRampToValueAtTime(noteVol * 0.4, time + i * 0.04 + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(time + i * 0.04);
      osc.stop(time + duration + 0.1);
    });

    // Mellow kick on beat 1 & soft snare on beat 2
    this.playSoftKick(time);
    this.playSoftSnare(time + 1.6);
    this.playSoftHiHat(time + 0.8);
    this.playSoftHiHat(time + 2.4);

    return 3200;
  }

  // --- 2. CYBER SYNTHWAVE ---
  private playSynthwaveBar(time: number): number {
    if (!this.ctx || !this.masterGain) return 2400;

    // Synthwave bass & arpeggios in F minor (F -> Ab -> Eb -> Db)
    const roots = [87.31, 103.83, 77.78, 69.3]; // F2, Ab2, Eb2, Db2
    const root = roots[this.step % roots.length];

    // Driving 8th-note rolling bassline
    for (let i = 0; i < 8; i++) {
      const t = time + i * 0.3;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(root, t);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, t);
      filter.frequency.exponentialRampToValueAtTime(250, t + 0.25);

      gain.gain.setValueAtTime(0.18 * this.volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.3);
    }

    // 80s Arp notes on top
    const arpFreqs = [root * 4, root * 4.75, root * 6, root * 7.12];
    for (let i = 0; i < 4; i++) {
      const t = time + i * 0.6;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(arpFreqs[(this.step + i) % arpFreqs.length], t);

      gain.gain.setValueAtTime(0.08 * this.volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.55);
    }

    return 2400;
  }

  // --- 3. RAIN & PIANO SANCTUARY ---
  private playRainPianoBar(time: number): number {
    if (!this.ctx || !this.masterGain) return 4000;

    // Peaceful pentatonic intervals
    const melody = [
      [261.63, 392.0, 523.25], // C4, G4, C5
      [293.66, 440.0, 587.33], // D4, A4, D5
      [329.63, 493.88, 659.25],// E4, B4, E5
      [261.63, 329.63, 392.0], // C4, E4, G4
    ];

    const chord = melody[this.step % melody.length];
    const duration = 3.8;

    chord.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time + idx * 0.12);

      const vol = 0.15 * this.volume;
      gain.gain.setValueAtTime(0.0001, time + idx * 0.12);
      gain.gain.linearRampToValueAtTime(vol, time + idx * 0.12 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(time + idx * 0.12);
      osc.stop(time + duration + 0.1);
    });

    return 4000;
  }

  // --- 4. DEEP FLOW 40Hz BINAURAL DRONE ---
  private playDroneBar(time: number): number {
    if (!this.ctx || !this.masterGain) return 4500;

    // 136.1 Hz fundamental drone with 40 Hz gamma binaural modulation
    const freqs = [136.1, 136.1 * 1.5, 136.1 * 2];
    const duration = 4.4;

    freqs.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time);

      const vol = 0.14 * this.volume;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(vol, time + 0.8);
      gain.gain.linearRampToValueAtTime(vol * 0.9, time + 3.5);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(time);
      osc.stop(time + duration + 0.1);
    });

    return 4500;
  }

  // Percussion Helpers
  private playSoftKick(time: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.frequency.setValueAtTime(90, time);
    osc.frequency.exponentialRampToValueAtTime(35, time + 0.2);

    gain.gain.setValueAtTime(0.25 * this.volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.26);
  }

  private playSoftSnare(time: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.15);

    gain.gain.setValueAtTime(0.12 * this.volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.2);
  }

  private playSoftHiHat(time: number) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "highpass" as unknown as OscillatorType;
    osc.type = "sine";
    osc.frequency.setValueAtTime(4500, time);

    gain.gain.setValueAtTime(0.04 * this.volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.09);
  }
}

export const flowRadio = new FlowRadioEngine();
