/**
 * Two particle systems:
 *  - DriftField: GPU-only ambient motes (dust, fireflies, embers). No CPU cost per frame.
 *  - ParticlePool: small CPU-simulated pool for emitted effects (steam, sparks, spell trails).
 */
import * as THREE from 'three';
import { softDot } from '../core/textures';

/** Shared by every point material; the engine keeps these current. */
export const pointUniforms = {
  uPixel: { value: 1 },
  uHeight: { value: window.innerHeight },
};

/* ── DriftField ───────────────────────────────────────────────────────── */

export interface DriftOptions {
  count: number;
  box: THREE.Vector3; // full size of the volume
  center: THREE.Vector3;
  color: THREE.ColorRepresentation;
  size: number; // world size
  speed?: number;
  rise?: number; // upward drift
  opacity?: number;
  twinkle?: number;
  additive?: boolean;
}

export class DriftField extends THREE.Points {
  declare material: THREE.ShaderMaterial;
  constructor(o: DriftOptions) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(o.count * 3);
    const rnd = new Float32Array(o.count * 4);
    for (let i = 0; i < o.count; i++) {
      pos[i * 3] = Math.random();
      pos[i * 3 + 1] = Math.random();
      pos[i * 3 + 2] = Math.random();
      rnd.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBox: { value: o.box.clone() },
        uCenter: { value: o.center.clone() },
        uScroll: { value: new THREE.Vector3() },
        uColor: { value: new THREE.Color(o.color) },
        uSize: { value: o.size },
        uSpeed: { value: o.speed ?? 0.15 },
        uRise: { value: o.rise ?? 0 },
        uOpacity: { value: o.opacity ?? 1 },
        uTwinkle: { value: o.twinkle ?? 0.5 },
        uMap: { value: softDot() },
        ...pointUniforms,
      },
      vertexShader: /* glsl */ `
        attribute vec4 aRand;
        uniform float uTime, uSize, uSpeed, uRise, uTwinkle, uPixel, uHeight;
        uniform vec3 uBox, uCenter, uScroll;
        varying float vAlpha;
        void main(){
          vec3 p = position - uScroll / uBox;
          float t = uTime * uSpeed;
          p.x += sin(t * (0.6 + aRand.x) + aRand.y * 6.28) * 0.04 + t * 0.01 * (aRand.z - 0.5);
          p.z += cos(t * (0.5 + aRand.y) + aRand.x * 6.28) * 0.04;
          p.y += t * uRise * (0.5 + aRand.w) * 0.05 + sin(t * (0.4 + aRand.z) + aRand.w * 6.0) * 0.03;
          p = fract(p);
          vec3 world = uCenter + (p - 0.5) * uBox;
          vec4 mv = modelViewMatrix * vec4(world, 1.0);
          gl_Position = projectionMatrix * mv;
          float edge = smoothstep(0.0, 0.08, p.y) * smoothstep(1.0, 0.92, p.y) * smoothstep(0.0,0.08,p.x)*smoothstep(1.0,0.92,p.x)*smoothstep(0.0,0.08,p.z)*smoothstep(1.0,0.92,p.z);
          float tw = mix(1.0, 0.5 + 0.5 * sin(uTime * (1.0 + aRand.x * 3.0) + aRand.y * 30.0), uTwinkle);
          vAlpha = edge * tw * (0.4 + aRand.z * 0.6);
          gl_PointSize = uSize * (0.5 + aRand.w) * uPixel * uHeight * 0.5 * projectionMatrix[1][1] / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity; varying float vAlpha;
        void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(uColor, t.a * vAlpha * uOpacity); }`,
      transparent: true,
      depthWrite: false,
      blending: o.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    super(g, mat);
    this.frustumCulled = false;
  }
  update(t: number) {
    this.material.uniforms.uTime.value = t;
  }
  /** Keep the volume around a moving point while particles stay fixed in the world. */
  follow(p: THREE.Vector3) {
    this.material.uniforms.uCenter.value.copy(p);
    this.material.uniforms.uScroll.value.copy(p);
  }
}

/* ── ParticlePool ─────────────────────────────────────────────────────── */

export interface EmitOptions {
  position: THREE.Vector3;
  velocity?: THREE.Vector3;
  spread?: number; // random velocity magnitude
  posJitter?: number;
  life?: [number, number];
  size?: [number, number]; // start,end world size
  color?: THREE.ColorRepresentation;
  color2?: THREE.ColorRepresentation; // random mix
  alpha?: number;
  drag?: number;
  gravity?: number; // negative = rises
  count?: number;
}

export class ParticlePool {
  readonly points: THREE.Points;
  private n: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private s0: Float32Array;
  private s1: Float32Array;
  private a0: Float32Array;
  private drag: Float32Array;
  private grav: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private col: Float32Array;
  private cursor = 0;
  private geo: THREE.BufferGeometry;
  /** Wind applied to every live particle. */
  wind = new THREE.Vector3();

  constructor(max: number, opts: { texture?: THREE.Texture; additive?: boolean; fadeIn?: number } = {}) {
    this.n = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max).fill(0);
    this.maxLife = new Float32Array(max).fill(1);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.col = new Float32Array(max * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: opts.texture ?? softDot() },
        ...pointUniforms,
      },
      vertexShader: /* glsl */ `
        attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
        uniform float uPixel, uHeight; varying float vAlpha; varying vec3 vColor; varying float vRot;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPixel * uHeight * 0.5 * projectionMatrix[1][1] / max(0.1, -mv.z);
          vAlpha = aAlpha; vColor = aColor; vRot = position.x * 3.1 + position.z * 1.7;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; varying float vAlpha; varying vec3 vColor; varying float vRot;
        void main(){
          vec2 c = gl_PointCoord - 0.5; float s = sin(vRot), co = cos(vRot);
          vec2 uv = vec2(c.x*co - c.y*s, c.x*s + c.y*co) + 0.5;
          vec4 t = texture2D(uMap, uv);
          gl_FragColor = vec4(vColor, t.a * vAlpha);
        }`,
      transparent: true,
      depthWrite: false,
      blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.fadeIn = opts.fadeIn ?? 0.15;
  }
  private fadeIn: number;
  private tmpC = new THREE.Color();
  private tmpC2 = new THREE.Color();

  emit(o: EmitOptions) {
    const count = o.count ?? 1;
    const c1 = this.tmpC.set(o.color ?? 0xffffff);
    const c2 = this.tmpC2.set(o.color2 ?? o.color ?? 0xffffff);
    for (let k = 0; k < count; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.n;
      const j = o.posJitter ?? 0;
      this.pos[i * 3] = o.position.x + (Math.random() - 0.5) * j;
      this.pos[i * 3 + 1] = o.position.y + (Math.random() - 0.5) * j;
      this.pos[i * 3 + 2] = o.position.z + (Math.random() - 0.5) * j;
      const sp = o.spread ?? 0;
      const v = o.velocity;
      this.vel[i * 3] = (v?.x ?? 0) + (Math.random() - 0.5) * 2 * sp;
      this.vel[i * 3 + 1] = (v?.y ?? 0) + (Math.random() - 0.5) * 2 * sp;
      this.vel[i * 3 + 2] = (v?.z ?? 0) + (Math.random() - 0.5) * 2 * sp;
      const [l0, l1] = o.life ?? [1, 2];
      this.maxLife[i] = l0 + Math.random() * (l1 - l0);
      this.life[i] = this.maxLife[i];
      const [sa, sb] = o.size ?? [0.1, 0.1];
      this.s0[i] = sa * (0.7 + Math.random() * 0.6);
      this.s1[i] = sb * (0.7 + Math.random() * 0.6);
      this.a0[i] = o.alpha ?? 1;
      this.drag[i] = o.drag ?? 0;
      this.grav[i] = o.gravity ?? 0;
      const m = Math.random();
      this.col[i * 3] = c1.r + (c2.r - c1.r) * m;
      this.col[i * 3 + 1] = c1.g + (c2.g - c1.g) * m;
      this.col[i * 3 + 2] = c1.b + (c2.b - c1.b) * m;
    }
  }

  update(dt: number) {
    const w = this.wind;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = 1 - Math.max(0, this.life[i]) / this.maxLife[i]; // 0→1
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] = this.vel[i * 3] * d + w.x * dt;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt + w.y * dt;
      this.vel[i * 3 + 2] = this.vel[i * 3 + 2] * d + w.z * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k;
      const fin = Math.min(1, k / this.fadeIn);
      this.alpha[i] = this.a0[i] * fin * (1 - k) * (1 - k * 0.3);
    }
    const a = this.geo.attributes;
    a.position.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = a.aColor.needsUpdate = true;
  }

  dispose() {
    this.geo.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
