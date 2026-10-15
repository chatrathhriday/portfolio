/** Sky dome, drifting fog layers and flame sprites — shared across scenes. */
import * as THREE from 'three';
import { GLSL_NOISE } from '../core/noise';
import { pointUniforms } from './particles';

/* ── Sky ──────────────────────────────────────────────────────────────── */

export interface SkyOptions {
  top: THREE.ColorRepresentation;
  horizon: THREE.ColorRepresentation;
  moonDir?: THREE.Vector3;
  moonColor?: THREE.ColorRepresentation;
  stars?: number; // 0..1 density
  clouds?: number; // 0..1
  radius?: number;
}

export function makeSky(o: SkyOptions) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(o.top) },
      uHorizon: { value: new THREE.Color(o.horizon) },
      uMoonDir: { value: (o.moonDir ?? new THREE.Vector3(0.3, 0.5, -1)).clone().normalize() },
      uMoonColor: { value: new THREE.Color(o.moonColor ?? 0xdfe8ff) },
      uStars: { value: o.stars ?? 1 },
      uClouds: { value: o.clouds ?? 0.5 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE}
      uniform vec3 uTop, uHorizon, uMoonDir, uMoonColor; uniform float uStars, uClouds, uTime;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 col = mix(uHorizon, uTop, pow(smoothstep(-0.05, 0.75, h), 0.7));
        // stars: hashed cells on the sphere, fading near the horizon
        vec3 sd = d * 220.0; vec3 cell = floor(sd); vec3 f = fract(sd) - 0.5;
        float r = hash13(cell);
        float star = step(1.0 - 0.012 * uStars, r) * smoothstep(0.08, 0.0, length(f)) * smoothstep(0.02, 0.3, h);
        star *= 0.6 + 0.4 * sin(uTime * (1.0 + r * 4.0) + r * 50.0);
        col += vec3(0.85, 0.9, 1.0) * star * 1.6;
        // moon disc + halo
        float m = max(dot(d, uMoonDir), 0.0);
        col += uMoonColor * (smoothstep(0.9993, 0.9996, m) * 2.2 + pow(m, 200.0) * 0.25 + pow(m, 12.0) * 0.035);
        // thin moving clouds, lit by the moon
        vec2 cuv = d.xz / max(0.12, d.y + 0.1) * 0.8 + vec2(uTime * 0.004, 0.0);
        float c = smoothstep(0.5, 0.85, fbm(cuv * 1.3)) * uClouds * smoothstep(0.0, 0.25, h);
        col = mix(col, uHorizon * 1.3 + uMoonColor * pow(m, 6.0) * 0.25, c * 0.7);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(o.radius ?? 900, 32, 16), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { mesh, update: (t: number) => (mat.uniforms.uTime.value = t), material: mat };
}

/* ── Fog layer ─────────────────────────────────────────────────────────── */

export interface FogLayerOptions {
  width: number;
  depth: number;
  color: THREE.ColorRepresentation;
  opacity: number;
  scale?: number;
  speed?: THREE.Vector2;
  /** Fade the layer out within this distance of the camera (avoids flat cutoff). */
  nearFade?: number;
  vertical?: boolean;
}

export class FogLayer extends THREE.Mesh {
  declare material: THREE.ShaderMaterial;
  constructor(o: FogLayerOptions) {
    const geo = new THREE.PlaneGeometry(o.width, o.depth, 1, 1);
    if (!o.vertical) geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Color(o.color) },
        uOpacity: { value: o.opacity },
        uScale: { value: o.scale ?? 0.05 },
        uSpeed: { value: o.speed ?? new THREE.Vector2(0.02, 0.01) },
        uTime: { value: 0 },
        uNear: { value: o.nearFade ?? 4 },
        uSize: { value: new THREE.Vector2(o.width, o.depth) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld; varying vec2 vUv; varying float vDepth;
        void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz;
          vec4 mv = viewMatrix * w; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        ${GLSL_NOISE}
        uniform vec3 uColor; uniform float uOpacity, uScale, uTime, uNear; uniform vec2 uSpeed;
        varying vec3 vWorld; varying vec2 vUv; varying float vDepth;
        void main(){
          vec2 p = (vWorld.xz + vWorld.y * 0.7) * uScale;
          float n = fbm(p + uSpeed * uTime) * 0.65 + fbm(p * 2.3 - uSpeed * uTime * 1.7) * 0.35;
          float a = smoothstep(0.35, 0.85, n);
          vec2 e = min(vUv, 1.0 - vUv);
          a *= smoothstep(0.0, 0.18, min(e.x, e.y));
          a *= smoothstep(0.5, uNear, vDepth);
          gl_FragColor = vec4(uColor, a * uOpacity);
        }`,
    });
    super(geo, mat);
    this.renderOrder = 2;
  }
  update(t: number) {
    this.material.uniforms.uTime.value = t;
  }
}

/* ── Flames (candles, torches, lanterns) as one Points draw call ──────── */

export class Flames extends THREE.Points {
  declare material: THREE.ShaderMaterial;
  private litAttr: THREE.BufferAttribute;
  readonly seeds: Float32Array;
  constructor(positions: THREE.Vector3[], size: number, color: THREE.ColorRepresentation = 0xffa040, lit = 1) {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(positions.length * 3);
    const seed = new Float32Array(positions.length);
    const litArr = new Float32Array(positions.length).fill(lit);
    positions.forEach((v, i) => {
      p.set([v.x, v.y, v.z], i * 3);
      seed[i] = Math.random() * 100;
    });
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const litAttr = new THREE.BufferAttribute(litArr, 1);
    g.setAttribute('aLit', litAttr);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: size },
        uColor: { value: new THREE.Color(color) },
        uGlobal: { value: 1 },
        uBob: { value: 0 },
        ...pointUniforms,
      },
      vertexShader: /* glsl */ `
        attribute float aSeed; attribute float aLit;
        uniform float uTime, uSize, uPixel, uHeight, uBob, uGlobal;
        varying float vSeed; varying float vLit;
        void main(){
          vec3 p = position; p.y += sin(uTime * 0.8 + aSeed) * uBob;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          vLit = aLit * uGlobal; vSeed = aSeed;
          gl_PointSize = uSize * uPixel * uHeight * 0.5 * projectionMatrix[1][1] / -mv.z * (0.6 + 0.4 * vLit);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uColor; varying float vSeed; varying float vLit;
        void main(){
          if (vLit < 0.01) discard;
          vec2 uv = gl_PointCoord; uv.y = 1.0 - uv.y;
          float flick = sin(uTime * 13.0 + vSeed) * 0.04 + sin(uTime * 7.3 + vSeed * 2.0) * 0.05;
          vec2 c = uv - vec2(0.5 + flick * uv.y, 0.32);
          // teardrop: narrow toward the top
          float w = mix(0.17, 0.02, clamp(c.y / 0.55, 0.0, 1.0));
          float body = smoothstep(w, w * 0.25, abs(c.x)) * smoothstep(-0.14, 0.0, c.y) * smoothstep(0.6, 0.15, c.y);
          float core = smoothstep(0.09, 0.0, length(c * vec2(1.6, 0.9)));
          float halo = smoothstep(0.5, 0.0, length(c)) * 0.22;
          vec3 col = uColor * body * 1.7 + vec3(1.0, 0.95, 0.85) * core * 2.4 + uColor * halo;
          float a = clamp(body + core + halo, 0.0, 1.0) * vLit;
          gl_FragColor = vec4(col * vLit, a);
        }`,
    });
    super(g, mat);
    this.litAttr = litAttr;
    this.seeds = seed;
    this.frustumCulled = false;
  }
  setLit(i: number, v: number) {
    this.litAttr.setX(i, v);
    this.litAttr.needsUpdate = true;
  }
  setAll(v: number) {
    (this.litAttr.array as Float32Array).fill(v);
    this.litAttr.needsUpdate = true;
  }
  get count() {
    return this.litAttr.count;
  }
  update(t: number) {
    this.material.uniforms.uTime.value = t;
  }
}

/** A flickering point light helper. */
export class FlickerLight extends THREE.PointLight {
  base: number;
  private seed = Math.random() * 100;
  constructor(color: THREE.ColorRepresentation, intensity: number, distance: number, decay = 2) {
    super(color, intensity, distance, decay);
    this.base = intensity;
  }
  update(t: number) {
    const f = 0.88 + Math.sin(t * 9 + this.seed) * 0.05 + Math.sin(t * 23.7 + this.seed * 2) * 0.04 + Math.sin(t * 3.1 + this.seed) * 0.03;
    this.intensity = this.base * f;
  }
}
