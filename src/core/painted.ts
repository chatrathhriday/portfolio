/**
 * Hand-painted-style textures for the anime look: flat tones, soft painted
 * bevels and clean lines — no per-pixel noise, so surfaces stay calm and
 * never shimmer. Everything is drawn on canvas at runtime.
 */
import * as THREE from 'three';
import { mulberry32 } from './noise';

export type PaintKind = 'blocks' | 'flagstones' | 'bricks' | 'planks' | 'shingles' | 'rock';

export interface PaintOptions {
  kind: PaintKind;
  /** Base colour; tones are derived from it. */
  base: string;
  /** Mortar / line colour. */
  line?: string;
  rows?: number;
  cols?: number;
  seed?: number;
  size?: number;
}

const cache = new Map<string, THREE.CanvasTexture>();

const mix = (c: THREE.Color, k: number) => {
  const o = c.clone();
  if (k >= 1) o.lerp(new THREE.Color(1, 0.97, 0.9), Math.min(1, k - 1));
  else o.multiplyScalar(k);
  return '#' + o.getHexString();
};

/** Soft painted block: flat fill, lighter top-left edge, darker bottom-right edge. */
function paintBlock(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, base: THREE.Color, tone: number, r: number) {
  g.fillStyle = mix(base, tone);
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
  const hi = g.createLinearGradient(x, y, x, y + h);
  hi.addColorStop(0, 'rgba(255,248,230,0.22)');
  hi.addColorStop(0.18, 'rgba(255,248,230,0)');
  hi.addColorStop(0.8, 'rgba(0,0,0,0)');
  hi.addColorStop(1, 'rgba(20,10,30,0.22)');
  g.fillStyle = hi;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
}

export function painted(o: PaintOptions): THREE.CanvasTexture {
  const key = JSON.stringify(o);
  const hit = cache.get(key);
  if (hit) return hit;
  const size = o.size ?? 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const rnd = mulberry32(o.seed ?? 3);
  const base = new THREE.Color(o.base);
  g.fillStyle = o.line ?? mix(base, 0.55);
  g.fillRect(0, 0, size, size);
  const tone = () => 0.86 + rnd() * 0.28;

  if (o.kind === 'blocks' || o.kind === 'bricks') {
    const rows = o.rows ?? (o.kind === 'bricks' ? 10 : 5);
    const cols = o.cols ?? (o.kind === 'bricks' ? 4 : 3);
    const gap = size * (o.kind === 'bricks' ? 0.012 : 0.014);
    const bh = size / rows, bw = size / cols;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * bw * 0.5;
      for (let k = -1; k <= cols; k++) {
        const x = k * bw + off;
        paintBlock(g, x + gap / 2, r * bh + gap / 2, bw - gap, bh - gap, base, tone(), size * 0.008);
      }
    }
  } else if (o.kind === 'flagstones') {
    const rows = o.rows ?? 4;
    const bh = size / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rnd() * size * 0.2;
      while (x < size) {
        const w = size * (0.18 + rnd() * 0.22);
        paintBlock(g, x + 3, r * bh + 3, w - 6, bh - 6, base, tone(), size * 0.01);
        // wrap the tile across the seam so the texture still tiles
        if (x + w > size) paintBlock(g, x - size + 3, r * bh + 3, w - 6, bh - 6, base, tone(), size * 0.01);
        x += w;
      }
    }
  } else if (o.kind === 'planks') {
    const rows = o.rows ?? 5;
    const bh = size / rows;
    for (let r = 0; r < rows; r++) {
      const t = tone();
      g.fillStyle = mix(base, t);
      g.fillRect(0, r * bh + 2, size, bh - 4);
      // a few long, calm grain strokes
      g.strokeStyle = mix(base, t * 0.82);
      g.lineWidth = size * 0.004;
      for (let k = 0; k < 3; k++) {
        const y = r * bh + bh * (0.25 + k * 0.25) + (rnd() - 0.5) * bh * 0.1;
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(size * 0.3, y + (rnd() - 0.5) * 8, size * 0.7, y + (rnd() - 0.5) * 8, size, y);
        g.stroke();
      }
      const hi = g.createLinearGradient(0, r * bh, 0, (r + 1) * bh);
      hi.addColorStop(0, 'rgba(255,240,210,0.18)');
      hi.addColorStop(0.3, 'rgba(255,240,210,0)');
      hi.addColorStop(1, 'rgba(20,10,0,0.18)');
      g.fillStyle = hi;
      g.fillRect(0, r * bh + 2, size, bh - 4);
      // plank joints
      g.fillStyle = mix(base, 0.5);
      const jx = rnd() * size;
      g.fillRect(jx, r * bh, 3, bh);
    }
  } else if (o.kind === 'shingles') {
    const rows = o.rows ?? 8, cols = o.cols ?? 6;
    const bh = size / rows, bw = size / cols;
    for (let r = rows; r >= -1; r--) {
      const off = (r % 2) * bw * 0.5;
      for (let k = -1; k <= cols; k++) {
        const x = k * bw + off, y = r * bh;
        g.fillStyle = mix(base, tone());
        g.beginPath();
        g.moveTo(x + 2, y);
        g.lineTo(x + bw - 2, y);
        g.lineTo(x + bw - 2, y + bh * 1.2);
        g.quadraticCurveTo(x + bw / 2, y + bh * 1.55, x + 2, y + bh * 1.2);
        g.closePath();
        g.fill();
        g.strokeStyle = mix(base, 0.6);
        g.lineWidth = 2;
        g.stroke();
      }
    }
  } else if (o.kind === 'rock') {
    // soft painted strata and boulders
    g.fillStyle = mix(base, 0.9);
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < 60; i++) {
      const x = rnd() * size, y = rnd() * size, r = size * (0.05 + rnd() * 0.12);
      for (const [dx, dy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
        const grd = g.createRadialGradient(x + dx - r * 0.3, y + dy - r * 0.3, r * 0.1, x + dx, y + dy, r);
        grd.addColorStop(0, mix(base, 1.12 + rnd() * 0.05));
        grd.addColorStop(0.7, mix(base, 0.95));
        grd.addColorStop(1, mix(base, 0.72));
        g.fillStyle = grd;
        g.beginPath();
        g.ellipse(x + dx, y + dy, r * 1.4, r, rnd() * 0.5, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

/** Painted stand-ins for the (former) photo texture ids used by the scenes. */
export const PAINTED_SETS: Record<string, PaintOptions> = {
  castle_brick_07: { kind: 'blocks', base: '#b49c86', line: '#6e5a4c', rows: 5, cols: 3, seed: 7 },
  medieval_blocks_02: { kind: 'blocks', base: '#a8988a', line: '#5e5048', rows: 4, cols: 2, seed: 9 },
  castle_wall_slates: { kind: 'blocks', base: '#8c94a8', line: '#4a5064', rows: 6, cols: 3, seed: 13 },
  stone_tiles_02: { kind: 'flagstones', base: '#a69a8e', line: '#5e544c', rows: 3, seed: 21 },
  stone_pavers: { kind: 'flagstones', base: '#8e8e96', line: '#4c4c58', rows: 3, seed: 5 },
  brick_wall_02: { kind: 'bricks', base: '#a4523e', line: '#5c3a30', seed: 4 },
  wood_table_worn: { kind: 'planks', base: '#9a6a44', rows: 4, seed: 6 },
  weathered_planks: { kind: 'planks', base: '#8a6448', rows: 5, seed: 8 },
  roof_slates_02: { kind: 'shingles', base: '#4c5a7a', seed: 10 },
  rock_face_03: { kind: 'rock', base: '#5a6278', seed: 12 },
};
