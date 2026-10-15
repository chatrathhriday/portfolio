/** Quality tiers chosen from device hints, then adjusted by a live FPS monitor. */

export type Tier = 'high' | 'medium' | 'low';

export interface QualityProfile {
  tier: Tier;
  pixelRatio: number;
  bloom: boolean;
  bloomScale: number;
  particles: number; // multiplier for particle counts
  reflectionSize: number;
  maxLights: number;
  candles: number;
}

const nav = navigator as Navigator & { deviceMemory?: number };

export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
export const isMobile = isTouch && Math.min(screen.width, screen.height) < 820;

export function detectTier(): Tier {
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory || 4;
  if (isMobile) return cores >= 8 && mem >= 6 ? 'medium' : 'low';
  if (cores <= 4 || mem <= 4) return 'medium';
  return 'high';
}

export function profileFor(tier: Tier): QualityProfile {
  const dpr = window.devicePixelRatio || 1;
  switch (tier) {
    case 'high':
      return { tier, pixelRatio: Math.min(dpr, 1.75), bloom: true, bloomScale: 0.5, particles: 1, reflectionSize: 1024, maxLights: 6, candles: 70 };
    case 'medium':
      return { tier, pixelRatio: Math.min(dpr, 1.25), bloom: true, bloomScale: 0.4, particles: 0.6, reflectionSize: 512, maxLights: 5, candles: 45 };
    default:
      return { tier, pixelRatio: Math.min(dpr, 1), bloom: true, bloomScale: 0.3, particles: 0.35, reflectionSize: 256, maxLights: 4, candles: 26 };
  }
}

/** Probe whether WebGL2 (or WebGL1) is usable at all. */
export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Watches frame time; calls `onSlow` once if the average stays poor. */
export class FpsMonitor {
  private acc = 0;
  private frames = 0;
  private slowStreak = 0;
  constructor(private onSlow: () => void) {}
  sample(dt: number) {
    this.acc += dt;
    this.frames++;
    if (this.acc >= 1) {
      const fps = this.frames / this.acc;
      this.slowStreak = fps < 38 ? this.slowStreak + 1 : 0;
      if (this.slowStreak >= 3) {
        this.slowStreak = -6; // cool-down before another downgrade
        this.onSlow();
      }
      this.acc = 0;
      this.frames = 0;
    }
  }
}
