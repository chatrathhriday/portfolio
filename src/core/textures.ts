/**
 * Runtime-generated textures. Everything is painted on canvas, so nothing can
 * fail to download and the initial payload stays tiny.
 */
import * as THREE from 'three';
import { makeFbm, mulberry32 } from './noise';
import { painted } from './painted';

const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d')! };
}

function finish(tex: THREE.Texture, repeat = true, srgb = true) {
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Build a normal map from a greyscale height canvas. */
function heightToNormal(h: Float32Array, w: number, hh: number, strength: number) {
  const { c, g } = canvas(w, hh);
  const img = g.createImageData(w, hh);
  const at = (x: number, y: number) => h[((y + hh) % hh) * w + ((x + w) % w)];
  for (let y = 0; y < hh; y++)
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return finish(new THREE.CanvasTexture(c), true, false);
}

export interface PbrSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap?: THREE.Texture;
}

/**
 * Ashlar stone blocks with mortar, chips and grime.
 * `rows` × `cols` blocks per tile, running bond.
 */
export function stoneBlocks(key: string, opts: { size?: number; rows?: number; cols?: number; tint?: [number, number, number]; seed?: number } = {}): PbrSet {
  // Painted style: flat tones and soft bevels instead of per-pixel noise (see core/painted.ts).
  const t = opts.tint ?? [92, 88, 84];
  const base = '#' + new THREE.Color(Math.min(1, (t[0] / 255) * 1.6), Math.min(1, (t[1] / 255) * 1.6), Math.min(1, (t[2] / 255) * 1.6)).getHexString();
  const rows = opts.rows ?? 6, cols = opts.cols ?? 3;
  const map = painted({ kind: rows >= 12 ? 'flagstones' : 'blocks', base, rows: Math.min(rows, 8), cols, seed: opts.seed ?? key.length, size: opts.size ?? 512 });
  return { map, normalMap: flatNormal() };
}

/** Paving flagstones (square slabs, irregular shading). */
export function flagstones(seed = 21): PbrSet {
  return { map: painted({ kind: 'flagstones', base: '#8e8a86', rows: 4, seed }), normalMap: flatNormal() };
}

/** Wood planks with a few calm grain strokes. */
export function woodPlanks(tint: [number, number, number] = [92, 58, 34], seed = 5): PbrSet {
  const base = '#' + new THREE.Color(Math.min(1, (tint[0] / 255) * 1.5), Math.min(1, (tint[1] / 255) * 1.5), Math.min(1, (tint[2] / 255) * 1.5)).getHexString();
  return { map: painted({ kind: 'planks', base, rows: 4, seed, size: 256 }), normalMap: flatNormal() };
}

/** 1×1 flat normal map (kept for API compatibility; toon shading ignores it). */
function flatNormal() {
  if (cache.has('flatN')) return cache.get('flatN')!;
  const t = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  t.needsUpdate = true;
  cache.set('flatN', t);
  return t;
}

/** Tileable water normal map for three's Water shader. */
export function waterNormals(): THREE.Texture {
  if (cache.has('water')) return cache.get('water')!;
  const size = 256;
  const fbm = makeFbm(4, 5, 99);
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = fbm(x / size, y / size);
  const t = heightToNormal(h, size, size, 9);
  cache.set('water', t);
  return t;
}

/** Soft radial sprite used by most particle systems. */
export function softDot(): THREE.Texture {
  if (cache.has('dot')) return cache.get('dot')!;
  const { c, g } = canvas(64);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = finish(new THREE.CanvasTexture(c), false);
  cache.set('dot', t);
  return t;
}

/** Wispy puff for steam and mist sprites. */
export function smokePuff(): THREE.Texture {
  if (cache.has('smoke')) return cache.get('smoke')!;
  const size = 128;
  const fbm = makeFbm(3, 4, 41);
  const { c, g } = canvas(size);
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = x / size - 0.5, dy = y / size - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      const fall = Math.max(0, 1 - r);
      const a = Math.pow(fall, 1.6) * (0.45 + fbm(x / size, y / size) * 0.9);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.min(255, a * 255);
    }
  g.putImageData(img, 0, 0);
  const t = finish(new THREE.CanvasTexture(c), false);
  cache.set('smoke', t);
  return t;
}

/** Emissive window grid for castle walls: dark wall, a fraction of warm lit windows. */
export function castleWindows(seed = 1, litRatio = 0.45): THREE.Texture {
  const key = 'win' + seed + litRatio;
  if (cache.has(key)) return cache.get(key)!;
  const rnd = mulberry32(seed);
  const { c, g } = canvas(256);
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  const cols = 8, rows = 8;
  for (let r = 0; r < rows; r++)
    for (let q = 0; q < cols; q++) {
      if (rnd() > litRatio) continue;
      const x = q * 32 + 11, y = r * 32 + 7;
      const warm = 0.7 + rnd() * 0.3;
      g.fillStyle = `rgb(${255 * warm}, ${170 * warm}, ${80 * warm})`;
      g.beginPath();
      g.moveTo(x, y + 18);
      g.lineTo(x, y + 6);
      g.quadraticCurveTo(x + 5, y - 1, x + 10, y + 6);
      g.lineTo(x + 10, y + 18);
      g.fill();
    }
  const t = finish(new THREE.CanvasTexture(c));
  cache.set(key, t);
  return t;
}

/** Text drawn on a canvas — signs, plates, labels. */
export function textTexture(
  lines: { text: string; font: string; color: string; y: number }[],
  opts: { w: number; h: number; bg?: string; border?: string; borderWidth?: number },
): THREE.CanvasTexture {
  const { c, g } = canvas(opts.w, opts.h);
  if (opts.bg) {
    g.fillStyle = opts.bg;
    g.fillRect(0, 0, opts.w, opts.h);
  }
  if (opts.border) {
    g.strokeStyle = opts.border;
    g.lineWidth = opts.borderWidth ?? 8;
    const b = g.lineWidth;
    g.strokeRect(b, b, opts.w - b * 2, opts.h - b * 2);
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const l of lines) {
    g.font = l.font;
    g.fillStyle = l.color;
    g.fillText(l.text, opts.w / 2, l.y);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Aged parchment background, used for the in-world parchments. */
export function parchment(w = 512, h = 640, seed = 9): HTMLCanvasElement {
  const fbm = makeFbm(3, 5, seed);
  const { c, g } = canvas(w, h);
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const n = fbm(x / w, y / h);
      const ex = Math.min(x, w - x) / w, ey = Math.min(y, h - y) / h;
      const edge = Math.min(1, Math.min(ex, ey) * 9);
      const k = (0.86 + n * 0.14) * (0.72 + edge * 0.28);
      const i = (y * w + x) * 4;
      img.data[i] = 236 * k;
      img.data[i + 1] = 218 * k;
      img.data[i + 2] = 180 * k;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return c;
}

export function disposeTextureCache() {
  cache.forEach((t) => t.dispose());
  cache.clear();
}
