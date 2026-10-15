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

/** Unmasked GPU name, read once from a throwaway context (empty if hidden). */
export const gpuName: string = (() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return '';
  }
})();

/** Full detail only on GPUs that are clearly discrete / high-end. */
const strongGpu = /nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|apple m\d (pro|max|ultra)/i.test(gpuName);
const weakGpu = /intel|uhd|iris|mali|adreno|powervr|swiftshader|llvmpipe|radeon\(tm\) graphics|vega \d/i.test(gpuName);

export function detectTier(): Tier {
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory || 4;
  if (isMobile) return cores >= 8 && mem >= 6 && !weakGpu ? 'medium' : 'low';
  if (strongGpu && cores > 4 && mem > 4) return 'high';
  return 'medium';
}

export function profileFor(tier: Tier): QualityProfile {
  const dpr = window.devicePixelRatio || 1;
  switch (tier) {
    case 'high':
      return { tier, pixelRatio: Math.min(dpr, 1.75), bloom: true, bloomScale: 0.5, particles: 1, reflectionSize: 1024, maxLights: 6, candles: 70 };
    case 'medium':
      // tuned for Intel UHD-class laptops: native-ish resolution, lighter effects
      return { tier, pixelRatio: Math.min(dpr, 1), bloom: true, bloomScale: 0.33, particles: 0.5, reflectionSize: 512, maxLights: 5, candles: 38 };
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
      this.slowStreak = fps < 44 ? this.slowStreak + 1 : 0;
      if (this.slowStreak >= 3) {
        this.slowStreak = -6; // cool-down before another downgrade
        this.onSlow();
      }
      this.acc = 0;
      this.frames = 0;
    }
  }
}
