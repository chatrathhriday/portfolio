/**
 * The great arched double door. Used as the entrance to the Great Hall; it
 * also carries an optional rune-lock ring (hidden there).
 */
import * as THREE from 'three';
import { stoneBlocks, woodPlanks } from '../core/textures';

export interface Door {
  group: THREE.Group;
  leaves: THREE.Group[]; // [left, right] hinge pivots
  ring: THREE.Mesh;
  ringMat: THREE.ShaderMaterial;
  leak: THREE.Mesh;
  leakMat: THREE.MeshBasicMaterial;
  /** 0..1 rune illumination (clockwise). */
  setRunes(v: number, color?: THREE.ColorRepresentation): void;
  /** 0..1 open amount. */
  setOpen(v: number): void;
  width: number;
  height: number;
}

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';

function runeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.translate(256, 256);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(0, 0, 236, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, 0, 176, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(0, 0, 70, 0, Math.PI * 2);
  g.stroke();
  g.font = '44px serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const n = 20;
  for (let i = 0; i < n; i++) {
    g.save();
    g.rotate((i / n) * Math.PI * 2);
    g.fillText(RUNES[i % RUNES.length], 0, -206);
    g.restore();
  }
  // keyhole star
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? 22 : 60;
    const a = (i / 16) * Math.PI * 2;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  for (let i = 0; i < 8; i++) {
    g.save();
    g.rotate((i / 8) * Math.PI * 2);
    g.fillRect(-2, -172, 4, 96);
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}

export function buildDoor(): Door {
  const W = 4.4, H = 6.4, springH = H - W / 2; // straight part height
  const group = new THREE.Group();
  const stone = stoneBlocks('door-frame', { rows: 6, cols: 3, tint: [96, 92, 88], seed: 77, size: 256 });
  const frameMat = new THREE.MeshStandardMaterial({ map: stone.map, normalMap: stone.normalMap, roughness: 0.85, color: 0xb0aaa0 });

  // arched stone frame (shape with arch hole)
  const outer = new THREE.Shape();
  outer.moveTo(-W / 2 - 1.1, 0);
  outer.lineTo(W / 2 + 1.1, 0);
  outer.lineTo(W / 2 + 1.1, springH);
  outer.absarc(0, springH, W / 2 + 1.1, 0, Math.PI, false);
  outer.lineTo(-W / 2 - 1.1, 0);
  const hole = new THREE.Path();
  hole.moveTo(-W / 2, 0);
  hole.lineTo(-W / 2, springH);
  hole.absarc(0, springH, W / 2, Math.PI, 0, true);
  hole.lineTo(W / 2, 0);
  hole.lineTo(-W / 2, 0);
  outer.holes.push(hole);
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.8, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2, curveSegments: 24 }), frameMat);
  frame.position.z = -0.4;
  group.add(frame);

  // light leaking from beyond (seen as the leaves open)
  const leakMat = new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0 });
  const leakShape = new THREE.Shape();
  leakShape.moveTo(-W / 2, 0);
  leakShape.lineTo(-W / 2, springH);
  leakShape.absarc(0, springH, W / 2, Math.PI, 0, true);
  leakShape.lineTo(W / 2, 0);
  const leak = new THREE.Mesh(new THREE.ShapeGeometry(leakShape, 24), leakMat);
  leak.position.z = -0.6;
  group.add(leak);

  // leaves: wood with iron bands and studs; arched tops
  const wood = woodPlanks([74, 46, 28], 21);
  const woodMap = wood.map.clone();
  woodMap.rotation = Math.PI / 2;
  woodMap.repeat.set(2, 1);
  const woodMat = new THREE.MeshStandardMaterial({ map: woodMap, normalMap: wood.normalMap, roughness: 0.7, color: 0xc0a080 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x1b1b1e, metalness: 0.8, roughness: 0.45 });
  const leaves: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set((side * W) / 2, 0, 0);
    const s = new THREE.Shape();
    // leaf spans from hinge (x=0) inward to the centre line (x = -side*W/2)
    const inner = -side * (W / 2);
    s.moveTo(0, 0);
    s.lineTo(inner, 0);
    s.lineTo(inner, H);
    const steps = 16;
    // quarter arch from the apex (door centre) back down to the spring point at the hinge
    for (let i = 0; i <= steps; i++) {
      const a = Math.PI / 2 + (i / steps) * (side < 0 ? Math.PI / 2 : -Math.PI / 2);
      s.lineTo(inner + (W / 2) * Math.cos(a), springH + (W / 2) * Math.sin(a));
    }
    s.lineTo(0, 0);
    const leafGeo = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: false, curveSegments: 16 });
    leafGeo.translate(0, 0, -0.09);
    const leaf = new THREE.Mesh(leafGeo, woodMat);
    pivot.add(leaf);
    for (const y of [0.8, 2.6, 4.2]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(W / 2 - 0.1, 0.16, 0.06), iron);
      band.position.set(inner / 2, y, 0.11);
      pivot.add(band);
      for (let k = 0; k < 5; k++) {
        const stud = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), iron);
        stud.position.set(inner * (0.12 + k * 0.19), y, 0.15);
        pivot.add(stud);
      }
    }
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 20), iron);
    handle.position.set(inner * 0.88, 2.3, 0.2);
    pivot.add(handle);
    group.add(pivot);
    leaves.push(pivot);
  }

  // rune lock ring across the seam
  const ringMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uMap: { value: runeTexture() }, uProgress: { value: 0 }, uColor: { value: new THREE.Color(0xffc870) }, uTime: { value: 0 }, uBase: { value: 0.12 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform float uProgress, uTime, uBase; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        vec4 t = texture2D(uMap, vUv);
        vec2 d = vUv - 0.5;
        float ang = fract(atan(d.x, d.y) / 6.28318 + 1.0);
        float lit = smoothstep(uProgress, uProgress - 0.04, ang);
        float centre = smoothstep(0.16, 0.0, length(d)) * smoothstep(0.6, 1.0, uProgress);
        float a = t.a * (uBase + lit * 1.6 + centre) * (0.9 + 0.1 * sin(uTime * 3.0));
        gl_FragColor = vec4(uColor * (1.0 + lit * 1.5 + centre * 2.0), a);
      }`,
  });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), ringMat);
  ring.position.set(0, 3.1, 0.2);
  group.add(ring);

  return {
    group,
    leaves,
    ring,
    ringMat,
    leak,
    leakMat,
    width: W,
    height: H,
    setRunes(v, color) {
      ringMat.uniforms.uProgress.value = v;
      if (color !== undefined) ringMat.uniforms.uColor.value.set(color);
    },
    setOpen(v) {
      leaves[0].rotation.y = v * 1.75;
      leaves[1].rotation.y = -v * 1.75;
      leakMat.opacity = Math.min(1, v * 3);
    },
  };
}
