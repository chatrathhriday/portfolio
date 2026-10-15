/**
 * Procedural sound: every ambience and spell is synthesised with Web Audio,
 * so there are no audio files to download or fail. Audio starts only after
 * the first user gesture (browser autoplay rules).
 */
import { settings } from './settings';

type Ambience = 'station' | 'lake' | 'hall' | 'none';

/** Seconds per bar (~64 bpm in 4/4). */
const BAR = 3.75;
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
/** Original modal progression in D minor: i – VI – III – VII – iv – VI – sus – V. Root first. */
const PROGRESSION: number[][] = [
  [50, 62, 65, 69], // Dm
  [46, 62, 65, 70], // Bb
  [53, 60, 65, 69], // F
  [48, 60, 64, 67], // C
  [43, 62, 67, 70], // Gm
  [46, 62, 65, 70], // Bb
  [45, 62, 64, 69], // Asus4
  [45, 61, 64, 69], // A
];
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private ambBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private reverb!: ConvolverNode;
  private ambNodes: { stop: () => void } | null = null;
  private current: Ambience = 'none';

  constructor() {
    settings.on(() => this.applyMute());
  }

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
    } catch {
      return; // no audio support: everything below becomes a no-op
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.8, 2.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.reverb.connect(wet).connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);
    this.sfxBus.connect(this.reverb);
    this.ambBus = ctx.createGain();
    this.ambBus.gain.value = 0.55;
    this.ambBus.connect(this.master);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.5;
    this.musicBus.connect(this.master);
    const send = ctx.createGain();
    send.gain.value = 0.7;
    this.musicBus.connect(send).connect(this.reverb);
    this.applyMute();
    if (this.current !== 'none') {
      const a = this.current;
      this.current = 'none';
      this.ambience(a);
    }
  }

  private applyMute() {
    if (!this.ctx) return;
    const on = settings.get().sound;
    this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.25);
    if (on) this.startMusic();
    else this.stopMusic();
  }

  /* ── Original procedural score ─────────────────────────────────────────
     Slow string chords under a celesta-like bell line. The progression and
     melody are generated here (seeded, evolving each cycle) — not a cover of
     any existing theme. */

  private musicBus!: GainNode;
  private musicTimer = 0;
  private musicNext = 0;
  private musicBar = 0;
  private mood = { density: 0.3, brightness: 0.6 };

  /** Scene mood: how busy and bright the score is. */
  setMood(kind: 'station' | 'lake' | 'hall') {
    this.mood = kind === 'station' ? { density: 0.22, brightness: 0.5 } : kind === 'lake' ? { density: 0.32, brightness: 0.6 } : { density: 0.42, brightness: 0.8 };
  }

  private startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.musicNext = this.ctx.currentTime + 0.3;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 120);
  }

  private stopMusic() {
    clearInterval(this.musicTimer);
    this.musicTimer = 0;
  }

  private scheduleMusic() {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.musicNext < ctx.currentTime + 0.8) {
      this.playBar(this.musicBar, this.musicNext);
      this.musicNext += BAR;
      this.musicBar++;
    }
  }

  private playBar(bar: number, t: number) {
    const chord = PROGRESSION[bar % PROGRESSION.length];
    const cycle = Math.floor(bar / PROGRESSION.length);
    // strings: root in the bass, the rest voiced close in the middle register
    this.stringNote(midi(chord[0] - 12), t, BAR * 1.05, 0.05);
    for (const n of chord.slice(1)) this.stringNote(midi(n), t, BAR * 1.05, 0.03);
    if (this.mood.brightness > 0.7) this.stringNote(midi(chord[1] + 12), t + BAR * 0.25, BAR * 0.8, 0.012);
    // celesta: 8 eighth-note slots, stepwise motion over a chord-tone scale
    const rnd = seeded(bar * 7919 + cycle * 104729);
    const scale = [...chord.slice(1), ...chord.slice(1).map((n) => n + 12)].sort((a, b) => a - b);
    let idx = Math.floor(rnd() * scale.length);
    for (let i = 0; i < 8; i++) {
      const strong = i === 0 || i === 4;
      if (rnd() > this.mood.density + (strong ? 0.25 : 0)) continue;
      idx = Math.max(0, Math.min(scale.length - 1, idx + Math.round((rnd() - 0.5) * 3)));
      const note = scale[idx] + 12;
      this.celesta(midi(note), t + i * (BAR / 8) + (rnd() - 0.5) * 0.02, strong ? 0.07 : 0.05);
    }
  }

  private stringNote(f: number, t: number, len: number, vol: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 1.4);
    g.gain.setValueAtTime(vol, t + len - 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700 + this.mood.brightness * 900;
    lp.Q.value = 0.4;
    lp.connect(g).connect(this.musicBus);
    for (const det of [-6, 5]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      const vib = ctx.createOscillator();
      vib.frequency.value = 4.6 + Math.random();
      const vg = ctx.createGain();
      vg.gain.value = 3;
      vib.connect(vg).connect(o.detune);
      o.connect(lp);
      o.start(t);
      vib.start(t);
      o.stop(t + len + 0.8);
      vib.stop(t + len + 0.8);
    }
  }

  /** Bell-like FM tone in the spirit of a celesta. */
  private celesta(f: number, t: number, vol: number) {
    const ctx = this.ctx!;
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f * 3.5;
    const idx = ctx.createGain();
    idx.gain.setValueAtTime(f * 1.6, t);
    idx.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.5);
    mod.connect(idx).connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    const oct = ctx.createOscillator();
    oct.frequency.value = f * 2;
    const og = ctx.createGain();
    og.gain.setValueAtTime(vol * 0.25, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    car.connect(g).connect(this.musicBus);
    oct.connect(og).connect(this.musicBus);
    for (const o of [car, mod, oct]) {
      o.start(t);
      o.stop(t + 2.3);
    }
  }

  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  private noise(loop = true) {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = loop;
    return s;
  }

  private env(g: GainNode, t: number, a: number, peak: number, release: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + release);
  }

  /** Crossfade to a scene's ambience bed. */
  ambience(kind: Ambience) {
    if (kind === this.current) return;
    this.current = kind;
    if (kind !== 'none') this.setMood(kind);
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (this.ambNodes) {
      this.ambNodes.stop();
      this.ambNodes = null;
    }
    if (kind === 'none') return;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 2.5);
    out.connect(this.ambBus);
    const stops: (() => void)[] = [];
    const bed = (freq: number, q: number, gain: number, lfoRate = 0.07) => {
      const n = this.noise();
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = lfoRate;
      const lg = ctx.createGain();
      lg.gain.value = gain * 0.6;
      lfo.connect(lg).connect(g.gain);
      n.connect(f).connect(g).connect(out);
      n.start();
      lfo.start();
      stops.push(() => {
        n.stop();
        lfo.stop();
      });
    };
    const drone = (freqs: number[], gain: number) => {
      for (const fr of freqs) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = fr;
        const g = ctx.createGain();
        g.gain.value = gain;
        o.connect(g).connect(out);
        o.start();
        stops.push(() => o.stop());
      }
    };
    let timer = 0;
    const crackle = (rate: number, freq: number, vol: number) => {
      const tick = () => {
        if (!this.ctx) return;
        const t = ctx.currentTime;
        const n = this.noise(false);
        const f = ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = freq;
        const g = ctx.createGain();
        this.env(g, t, 0.003, vol * (0.3 + Math.random()), 0.05 + Math.random() * 0.08);
        n.connect(f).connect(g).connect(out);
        n.start(t, Math.random(), 0.2);
        timer = window.setTimeout(tick, (Math.random() * 2 + 0.2) * (1000 / rate));
      };
      tick();
      stops.push(() => clearTimeout(timer));
    };
    switch (kind) {
      case 'station':
        bed(380, 0.6, 0.18, 0.05); // wind across the platform
        bed(2600, 1.5, 0.05, 0.11); // idle steam hiss
        drone([55, 82.5], 0.025); // engine idling
        break;
      case 'lake':
        bed(520, 0.9, 0.2, 0.18); // water lapping
        bed(240, 0.5, 0.1, 0.04); // wind over open water
        drone([110, 164.8, 220], 0.012);
        break;
      case 'hall':
        bed(300, 0.7, 0.07, 0.03); // air moving through a vast stone room
        bed(900, 0.4, 0.025, 0.02);
        drone([73.4, 110, 146.8, 220], 0.013);
        crackle(5, 2500, 0.045); // torches and candles
        break;
    }
    this.ambNodes = {
      stop: () => {
        out.gain.cancelScheduledValues(ctx.currentTime);
        out.gain.setValueAtTime(out.gain.value, ctx.currentTime);
        out.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
        window.setTimeout(() => stops.forEach((s) => s()), 1600);
      },
    };
  }

  /* ── One-shots ─────────────────────────────────────────────────────── */

  private tone(freq: number, t: number, dur: number, type: OscillatorType, vol: number, glideTo?: number, attack = 0.01) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    const g = ctx.createGain();
    this.env(g, t, attack, vol, dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  private whoosh(t: number, dur: number, from: number, to: number, vol: number, q = 2) {
    const ctx = this.ctx!;
    const n = this.noise(false);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    this.env(g, t, dur * 0.35, vol, dur * 0.65);
    n.connect(f).connect(g).connect(this.sfxBus);
    n.start(t, Math.random(), dur + 0.1);
  }

  private ready() {
    return !!this.ctx && settings.get().sound;
  }

  ui() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    this.tone(1320, t, 0.12, 'sine', 0.05);
    this.tone(1980, t + 0.03, 0.1, 'sine', 0.025);
  }

  page() {
    if (!this.ready()) return;
    this.whoosh(this.ctx!.currentTime, 0.35, 3000, 1200, 0.12, 0.8);
  }

  ticketPunch() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    this.whoosh(t, 0.08, 4000, 2000, 0.5, 1);
    this.tone(180, t, 0.08, 'square', 0.06, 90);
  }

  /** Original two-chime steam whistle — chord glides up, holds, and drops. */
  whistle() {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    for (const [f, v] of [[587, 0.05], [740, 0.04], [880, 0.03]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.92, t);
      o.frequency.linearRampToValueAtTime(f, t + 0.25);
      o.frequency.setValueAtTime(f, t + 1.4);
      o.frequency.linearRampToValueAtTime(f * 0.94, t + 1.9);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * 2;
      bp.Q.value = 3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.2);
      g.gain.setValueAtTime(v, t + 1.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.1);
      o.connect(bp).connect(g).connect(this.sfxBus);
      o.start(t);
      o.stop(t + 2.2);
    }
    this.whoosh(t, 2, 3500, 2500, 0.08, 0.6);
  }

  /** Accelerating chuffs as the locomotive pulls away. */
  departure() {
    if (!this.ready()) return;
    const t0 = this.ctx!.currentTime + 0.6;
    let t = t0, gap = 0.75;
    for (let i = 0; i < 14; i++) {
      this.whoosh(t, 0.3, 900, 300, 0.35 - i * 0.015, 0.7);
      t += gap;
      gap *= 0.86;
    }
  }

  steamBurst() {
    if (!this.ready()) return;
    this.whoosh(this.ctx!.currentTime, 1.6, 5000, 1500, 0.25, 0.5);
  }

  lumos() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    this.whoosh(t, 0.5, 600, 4000, 0.15, 1.5);
    [523, 784, 1047, 1568].forEach((f, i) => this.tone(f, t + 0.08 + i * 0.07, 1.6, 'sine', 0.06, undefined, 0.02));
  }

  accio() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    this.whoosh(t, 0.9, 200, 3000, 0.3, 1.2);
    this.whoosh(t + 0.6, 1.2, 3000, 400, 0.25, 1.2);
    [392, 494, 587].forEach((f, i) => this.tone(f, t + 0.1 + i * 0.12, 0.9, 'triangle', 0.04));
  }

  arrive() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    this.tone(880 + Math.random() * 200, t, 0.5, 'sine', 0.04);
  }

  patronus() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    // slow choir-like swell built from detuned sines
    [220, 277.2, 329.6, 440, 554.4, 659.3].forEach((f, i) => {
      this.tone(f, t + i * 0.18, 4.5, 'sine', 0.035, undefined, 1.4);
      this.tone(f * 1.004, t + i * 0.18, 4.5, 'sine', 0.025, undefined, 1.6);
    });
    this.whoosh(t, 3, 300, 6000, 0.12, 0.7);
  }

  gallop() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    for (let i = 0; i < 6; i++) this.tone(1200 + i * 90, t + i * 0.22, 0.4, 'sine', 0.025);
  }

  alohomora() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    // lock tumblers
    for (let i = 0; i < 5; i++) {
      this.tone(320 - i * 20, t + i * 0.16, 0.06, 'square', 0.05, 200);
      this.whoosh(t + i * 0.16, 0.05, 3000, 2000, 0.2, 4);
    }
    // deep boom + bright burst
    this.tone(70, t + 0.95, 2.5, 'sine', 0.35, 38);
    this.whoosh(t + 0.95, 2.4, 6000, 300, 0.3, 0.4);
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, t + 1 + i * 0.05, 3, 'sine', 0.04, undefined, 0.05));
  }

  /** Lumos Maxima: a long rising swell that breaks into a bright, ringing chord. */
  maxima() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    this.whoosh(t, 1.6, 200, 5000, 0.22, 0.9);
    [130.8, 196, 261.6].forEach((f) => this.tone(f, t, 1.6, 'sine', 0.05, f * 2, 1.2));
    this.tone(65, t + 1.5, 3, 'sine', 0.3, 40);
    this.whoosh(t + 1.5, 3, 7000, 400, 0.25, 0.4);
    [523.3, 659.3, 784, 1046.5, 1318.5, 1568].forEach((f, i) => this.tone(f, t + 1.55 + i * 0.06, 4, 'sine', 0.045, undefined, 0.04));
  }

  /** Paper flutter for the descending letter. */
  flutter() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    for (let i = 0; i < 6; i++) this.whoosh(t + i * 0.28, 0.2, 2500, 900, 0.06, 1.2);
  }

  door() {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t);
    o.frequency.linearRampToValueAtTime(52, t + 2.4);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 400;
    f.Q.value = 8;
    const g = ctx.createGain();
    this.env(g, t, 0.3, 0.06, 2.2);
    o.connect(f).connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + 2.6);
  }
}

export const audio = new AudioEngine();
