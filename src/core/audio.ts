/**
 * Procedural sound: every ambience and spell is synthesised with Web Audio,
 * so there are no audio files to download or fail. Audio starts only after
 * the first user gesture (browser autoplay rules).
 */
import { settings } from './settings';

type Ambience = 'station' | 'lake' | 'corridor' | 'chamber' | 'none';

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
      case 'corridor':
        bed(300, 0.7, 0.07, 0.03); // air moving through stone
        drone([73.4, 110, 146.8], 0.016);
        crackle(4, 2500, 0.05); // torches
        break;
      case 'chamber':
        bed(420, 0.6, 0.06, 0.03);
        drone([98, 146.8, 196, 293.7], 0.014);
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
