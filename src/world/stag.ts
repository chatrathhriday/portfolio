/**
 * Patronus stag made of luminous particles. Points are sampled from a stag
 * built out of primitives; legs carry a pivot so the vertex shader can gallop
 * them. `form` (0..1) gathers the particles from the wand tip into the shape.
 */
import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';
import { GLSL_NOISE } from '../core/noise';
import { pointUniforms } from '../fx/particles';

interface Part {
  geo: THREE.BufferGeometry;
  limb: number; // 0 body, 1..4 legs, 5 head/antlers
  pivot: THREE.Vector3;
  weight?: number;
}

function ellipsoid(c: THREE.Vector3, s: THREE.Vector3, rotZ = 0) {
  const g = new THREE.SphereGeometry(1, 20, 14);
  g.scale(s.x, s.y, s.z);
  g.rotateZ(rotZ);
  g.translate(c.x, c.y, c.z);
  return g;
}

function tube(points: THREE.Vector3[], r0: number, r1 = r0) {
  const curve = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, 16, (r0 + r1) / 2, 8, false);
  return g;
}

function buildParts(): Part[] {
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const body: Part[] = [
    { geo: ellipsoid(v(0, 1.28, 0), v(0.72, 0.36, 0.3)), limb: 0, pivot: v(0, 0, 0), weight: 1.3 },
    { geo: ellipsoid(v(0.42, 1.32, 0), v(0.34, 0.4, 0.3)), limb: 0, pivot: v(0, 0, 0) },
    { geo: ellipsoid(v(-0.5, 1.3, 0), v(0.33, 0.36, 0.3)), limb: 0, pivot: v(0, 0, 0) },
    { geo: tube([v(0.55, 1.45, 0), v(0.75, 1.75, 0), v(0.92, 1.98, 0)], 0.14, 0.1), limb: 5, pivot: v(0.6, 1.5, 0) },
    { geo: ellipsoid(v(1.06, 2.02, 0), v(0.25, 0.12, 0.12), -0.35), limb: 5, pivot: v(0.6, 1.5, 0) },
    { geo: ellipsoid(v(-0.86, 1.42, 0), v(0.08, 0.12, 0.06), 0.6), limb: 0, pivot: v(0, 0, 0), weight: 0.3 },
  ];
  // ears
  for (const z of [-0.08, 0.08]) body.push({ geo: ellipsoid(v(0.94, 2.16, z * 1.6), v(0.04, 0.1, 0.03), 0.5), limb: 5, pivot: v(0.6, 1.5, 0), weight: 0.3 });
  // antlers: a main beam with three tines each side
  for (const s of [-1, 1]) {
    const z = s * 0.06;
    const beam = [v(0.98, 2.12, z), v(0.9, 2.45, s * 0.2), v(0.7, 2.8, s * 0.35), v(0.55, 3.05, s * 0.32)];
    body.push({ geo: tube(beam, 0.035, 0.02), limb: 5, pivot: v(0.6, 1.5, 0), weight: 1.1 });
    const tines: [THREE.Vector3, THREE.Vector3][] = [
      [v(0.93, 2.35, s * 0.15), v(1.15, 2.55, s * 0.22)],
      [v(0.8, 2.62, s * 0.28), v(0.98, 2.95, s * 0.36)],
      [v(0.66, 2.86, s * 0.34), v(0.75, 3.15, s * 0.45)],
    ];
    for (const [a, b] of tines) body.push({ geo: tube([a, a.clone().lerp(b, 0.5).add(v(0.02, 0.03, 0)), b], 0.022, 0.012), limb: 5, pivot: v(0.6, 1.5, 0), weight: 0.5 });
  }
  // legs (upper + lower in one tube)
  const leg = (x: number, z: number, limb: number, front: boolean) => {
    const pts = front
      ? [v(x, 1.15, z), v(x + 0.04, 0.72, z), v(x - 0.02, 0.38, z), v(x + 0.02, 0.04, z)]
      : [v(x, 1.18, z), v(x - 0.1, 0.78, z), v(x + 0.06, 0.42, z), v(x, 0.04, z)];
    return { geo: tube(pts, 0.06, 0.035), limb, pivot: v(x, 1.15, z), weight: 1.1 } as Part;
  };
  body.push(leg(0.45, 0.14, 1, true), leg(0.45, -0.14, 2, true), leg(-0.52, 0.14, 3, false), leg(-0.52, -0.14, 4, false));
  return body;
}

export class Stag {
  readonly points: THREE.Points;
  readonly material: THREE.ShaderMaterial;
  readonly aura: THREE.Sprite;
  readonly group = new THREE.Group();

  constructor(count: number, auraTex: THREE.Texture) {
    const parts = buildParts();
    // area-weighted distribution of points across parts
    const areas = parts.map((p) => {
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
      const pos = g.attributes.position;
      let a = 0;
      const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
      for (let i = 0; i < pos.count; i += 3) {
        A.fromBufferAttribute(pos, i);
        B.fromBufferAttribute(pos, i + 1);
        C.fromBufferAttribute(pos, i + 2);
        a += B.sub(A).cross(C.sub(A)).length() / 2;
      }
      return a * (p.weight ?? 1);
    });
    const total = areas.reduce((s, a) => s + a, 0);
    const target = new Float32Array(count * 3);
    const limb = new Float32Array(count);
    const pivot = new Float32Array(count * 3);
    const rand = new Float32Array(count * 4);
    let k = 0;
    const tmp = new THREE.Vector3();
    parts.forEach((p, i) => {
      const n = i === parts.length - 1 ? count - k : Math.round((areas[i] / total) * count);
      const sampler = new MeshSurfaceSampler(new THREE.Mesh(p.geo.index ? p.geo.toNonIndexed() : p.geo)).build();
      for (let j = 0; j < n && k < count; j++, k++) {
        sampler.sample(tmp);
        target.set([tmp.x, tmp.y, tmp.z], k * 3);
        limb[k] = p.limb;
        pivot.set([p.pivot.x, p.pivot.y, p.pivot.z], k * 3);
      }
      p.geo.dispose();
    });
    for (let i = 0; i < count; i++) rand.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(target, 3));
    geo.setAttribute('aLimb', new THREE.BufferAttribute(limb, 1));
    geo.setAttribute('aPivot', new THREE.BufferAttribute(pivot, 3));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 4));

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uForm: { value: 0 },
        uGait: { value: 0 },
        uSpeed: { value: 9 },
        uFade: { value: 1 },
        uSource: { value: new THREE.Vector3(0, 1.5, 3) },
        uSize: { value: 0.05 },
        uColor: { value: new THREE.Color(0xcfe2ff) },
        ...pointUniforms,
      },
      vertexShader: /* glsl */ `
        ${GLSL_NOISE}
        attribute float aLimb; attribute vec3 aPivot; attribute vec4 aRand;
        uniform float uTime, uForm, uGait, uSpeed, uSize, uPixel, uHeight;
        uniform vec3 uSource;
        varying float vA;
        vec3 rotZ(vec3 p, vec3 o, float a){ vec3 d = p - o; float c = cos(a), s = sin(a); return o + vec3(d.x*c - d.y*s, d.x*s + d.y*c, d.z); }
        void main(){
          vec3 tgt = position;
          float t = uTime * uSpeed;
          // gallop: legs swing about their hip/shoulder, front and hind out of phase
          if (aLimb > 0.5 && aLimb < 4.5) {
            float ph = aLimb < 2.5 ? (aLimb < 1.5 ? 0.0 : 0.5) : (aLimb < 3.5 ? 3.14 : 3.64);
            tgt = rotZ(tgt, aPivot, sin(t + ph) * 0.55 * uGait);
          }
          if (aLimb > 4.5) tgt = rotZ(tgt, aPivot, sin(t * 1.0 + 1.2) * 0.08 * uGait);
          tgt.y += abs(sin(t)) * 0.18 * uGait;
          // shimmer
          tgt += (vec3(vnoise(tgt.xy * 3.0 + uTime), vnoise(tgt.yz * 3.0 - uTime), vnoise(tgt.zx * 3.0 + uTime * 0.7)) - 0.5) * 0.04;
          // trailing wisps while galloping
          tgt.x -= aRand.w * aRand.w * 0.9 * uGait * step(0.85, aRand.z);

          vec3 dir = normalize(aRand.xyz - 0.5 + 0.0001);
          vec3 start = uSource + dir * (0.15 + aRand.w * 0.5);
          float local = clamp((uForm - aRand.x * 0.55) / 0.45, 0.0, 1.0);
          float e = local * local * (3.0 - 2.0 * local);
          // spiral in from the wand tip
          vec3 mid = mix(start, tgt, 0.5) + vec3(0.0, 1.2 * (1.0 - aRand.y), 0.0) + dir * 1.2;
          vec3 p = mix(mix(start, mid, e), mix(mid, tgt, e), e);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          vA = (0.35 + 0.65 * aRand.z) * smoothstep(0.0, 0.15, uForm) * (0.6 + 0.4 * sin(uTime * 3.0 + aRand.y * 40.0));
          gl_PointSize = uSize * (0.6 + aRand.w * 0.9) * uPixel * uHeight * 0.5 * projectionMatrix[1][1] / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uFade; varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(uColor * (0.8 + 0.8 * smoothstep(0.2, 0.0, d)), a * vA * uFade * 0.6); }`,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.group.add(this.points);
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: auraTex, color: 0x9fc0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.aura.position.set(0.2, 1.6, 0);
    this.aura.scale.set(5, 4, 1);
    this.group.add(this.aura);
  }

  update(t: number) {
    this.material.uniforms.uTime.value = t;
    (this.aura.material as THREE.SpriteMaterial).opacity = this.material.uniforms.uForm.value * 0.13 * (1 - this.material.uniforms.uGait.value * 0.6) * this.material.uniforms.uFade.value;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
    (this.aura.material as THREE.Material).dispose();
  }
}
