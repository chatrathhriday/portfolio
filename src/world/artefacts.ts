/**
 * Enchanted objects that represent projects in the corridor:
 *  - tome    (ProxyProof): a leather spellbook whose cover opens on inspection
 *  - orrery  (Envelope):   a miniature building inside turning brass rings and heat halos
 *  - orb     (OceanNova):  a crystal ball with a living ocean inside
 */
import * as THREE from 'three';
import type { Project } from '../content/portfolio';
import { GLSL_NOISE } from '../core/noise';
import { parchment, softDot } from '../core/textures';

export interface Artefact {
  project: Project;
  group: THREE.Group; // moved by the scene
  body: THREE.Group; // spun by the scene
  hit: THREE.Mesh; // invisible raycast target
  glow: THREE.Sprite;
  /** 0..1 — how "open"/active the artefact is during inspection. */
  setOpen(v: number): void;
  update(dt: number, t: number): void;
}

const brass = () => new THREE.MeshStandardMaterial({ color: 0xc9a14f, metalness: 0.95, roughness: 0.28 });

function coverTexture(p: Project) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 340;
  const g = c.getContext('2d')!;
  g.fillStyle = p.color;
  g.fillRect(0, 0, 256, 340);
  // leather grain
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
    g.fillRect(Math.random() * 256, Math.random() * 340, 2, 2);
  }
  g.strokeStyle = '#d9b35f';
  g.lineWidth = 4;
  g.strokeRect(16, 16, 224, 308);
  g.lineWidth = 1.5;
  g.strokeRect(26, 26, 204, 288);
  // emblem: a stylised beacon (concentric arcs) for the attendance project
  g.lineWidth = 3;
  for (let r = 18; r <= 54; r += 18) {
    g.beginPath();
    g.arc(128, 150, r, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
  }
  g.fillStyle = '#d9b35f';
  g.beginPath();
  g.arc(128, 150, 7, 0, Math.PI * 2);
  g.fill();
  g.font = '600 26px Cinzel, Georgia, serif';
  g.textAlign = 'center';
  g.fillText(p.name.toUpperCase(), 128, 236);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function pageTexture(p: Project) {
  const c = parchment(256, 340, 3);
  const g = c.getContext('2d')!;
  g.fillStyle = '#3a2412';
  g.font = '600 20px Cinzel, Georgia, serif';
  g.textAlign = 'center';
  g.fillText(p.name, 128, 50);
  g.font = 'italic 15px "Cormorant Garamond", Georgia, serif';
  const words = p.tagline.split(' ');
  let line = '', y = 84;
  for (const w of words) {
    if (g.measureText(line + w).width > 200) {
      g.fillText(line, 128, y);
      line = '';
      y += 20;
    }
    line += w + ' ';
  }
  g.fillText(line, 128, y);
  g.strokeStyle = 'rgba(58,36,18,0.4)';
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.moveTo(40, 150 + i * 18);
    g.lineTo(216 - (i % 3) * 30, 150 + i * 18);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeBase(p: Project, body: THREE.Group, radius: number): Omit<Artefact, 'setOpen' | 'update'> {
  const group = new THREE.Group();
  group.add(body);
  const glowMat = new THREE.SpriteMaterial({ map: softDot(), color: new THREE.Color(p.color).lerp(new THREE.Color(0xffd890), 0.6), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(radius * 3.2);
  glow.position.z = -0.15;
  group.add(glow);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.15, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hit.userData.projectId = p.id;
  group.add(hit);
  return { project: p, group, body, hit, glow };
}

/* ── Tome ─────────────────────────────────────────────────────────────── */
function tome(p: Project): Artefact {
  const body = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.6, metalness: 0.05 });
  const coverMat = new THREE.MeshStandardMaterial({ map: coverTexture(p), roughness: 0.55, metalness: 0.1 });
  const pagesMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 });
  const W = 0.5, H = 0.66, T = 0.14;
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.025), leather);
  back.position.z = -T / 2;
  const pages = new THREE.Mesh(new THREE.BoxGeometry(W - 0.03, H - 0.04, T - 0.04), pagesMat);
  pages.position.x = 0.01;
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(T / 2, T / 2, H, 12, 1, false, Math.PI, Math.PI), leather);
  spine.position.x = -W / 2;
  // front cover hinged at the spine
  const hinge = new THREE.Group();
  hinge.position.set(-W / 2, 0, T / 2);
  const front = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.025), [leather, leather, leather, leather, coverMat, leather]);
  front.position.x = W / 2;
  hinge.add(front);
  // inner page revealed when opened
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.05, H - 0.06), new THREE.MeshStandardMaterial({ map: pageTexture(p), roughness: 0.9, emissive: 0xffe0b0, emissiveIntensity: 0.15, emissiveMap: null }));
  inner.position.set(0.01, 0, T / 2 - 0.018);
  for (const y of [-H / 2 + 0.08, H / 2 - 0.08]) {
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.03), brass());
    clasp.position.set(W / 2 + 0.01, y, T / 2);
    hinge.add(clasp);
    clasp.position.x = W;
  }
  body.add(back, pages, spine, inner, hinge);
  const base = makeBase(p, body, 0.45);
  return {
    ...base,
    setOpen(v) {
      hinge.rotation.y = -v * 2.4;
    },
    update() {},
  };
}

/* ── Orrery ───────────────────────────────────────────────────────────── */
function orrery(p: Project): Artefact {
  const body = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x9a9488, roughness: 0.7 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.05, 32), new THREE.MeshStandardMaterial({ color: 0x2f4a3a, roughness: 0.8 }));
  disc.position.y = -0.22;
  // tiny building: storeys with lit windows
  const bld = new THREE.Group();
  const winMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffc070, emissiveIntensity: 1.6 });
  for (let i = 0; i < 6; i++) {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.14), stone);
    floor.position.y = -0.17 + i * 0.058;
    bld.add(floor);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.022, 0.145), winMat);
    band.position.y = -0.17 + i * 0.058 + 0.012;
    bld.add(band);
  }
  // dust / heat / carbon halos (the three impact layers)
  const halo = (color: number, r: number, y: number) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.55, r, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    body.add(m);
    return m;
  };
  const halos = [halo(0xc8a060, 0.3, -0.19), halo(0xe06030, 0.24, -0.185), halo(0x8a6ad0, 0.18, -0.18)];
  // brass rings
  const rings: THREE.Mesh[] = [];
  const b = brass();
  for (const [r, tilt] of [[0.36, 0.3], [0.31, -0.8], [0.26, 1.3]] as const) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 6, 64), b);
    ring.rotation.set(Math.PI / 2 + tilt, tilt, 0);
    body.add(ring);
    rings.push(ring);
  }
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
  body.add(disc, bld, sun);
  const base = makeBase(p, body, 0.42);
  let open = 0;
  return {
    ...base,
    setOpen(v) {
      open = v;
    },
    update(dt, t) {
      rings.forEach((r, i) => (r.rotation.z += dt * (0.4 + i * 0.25) * (1 + open * 1.5)));
      halos.forEach((h, i) => {
        const s = 1 + Math.sin(t * 1.2 + i * 2) * 0.12 + open * 0.4;
        h.scale.set(s, s, s);
      });
      sun.position.set(Math.cos(t * 0.8) * 0.33, 0.12 + Math.sin(t * 0.8) * 0.1, Math.sin(t * 0.8) * 0.33);
    },
  };
}

/* ── Crystal orb ──────────────────────────────────────────────────────── */
function orb(p: Project): Artefact {
  const body = new THREE.Group();
  const oceanMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpen: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE}
      uniform float uTime, uOpen; varying vec3 vN; varying vec3 vP;
      void main(){
        vec2 q = vP.xz * 6.0 + vec2(uTime * 0.15, vP.y * 4.0);
        float n = fbm(q + fbm(q + uTime * 0.1));
        vec3 deep = vec3(0.02, 0.08, 0.18), teal = vec3(0.05, 0.45, 0.55), bloom = vec3(0.35, 0.85, 0.45);
        vec3 c = mix(deep, teal, smoothstep(0.3, 0.7, n));
        c = mix(c, bloom, smoothstep(0.68, 0.8, n) * (0.5 + uOpen));   // the anomaly it looks for
        float rim = pow(1.0 - abs(vN.z), 2.0);
        c += vec3(0.5, 0.75, 1.0) * rim * 0.6;
        gl_FragColor = vec4(c * 1.4, 1.0);
      }`,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.24, 40, 28), oceanMat);
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 40, 28),
    new THREE.MeshStandardMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.2, depthWrite: false }),
  );
  const stand = new THREE.Group();
  const b = brass();
  const cup = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 8, 40), b);
  cup.rotation.x = Math.PI / 2;
  cup.position.y = -0.2;
  stand.add(cup);
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.18), b);
    const a = (i / 3) * Math.PI * 2;
    leg.position.set(Math.cos(a) * 0.14, -0.29, Math.sin(a) * 0.14);
    leg.rotation.z = Math.cos(a) * 0.35;
    leg.rotation.x = -Math.sin(a) * 0.35;
    stand.add(leg);
  }
  body.add(core, shell, stand);
  const base = makeBase(p, body, 0.4);
  base.glow.material.color.set(0x7fd0e0);
  return {
    ...base,
    setOpen(v) {
      oceanMat.uniforms.uOpen.value = v;
    },
    update(_dt, t) {
      oceanMat.uniforms.uTime.value = t;
    },
  };
}

export function buildArtefact(p: Project): Artefact {
  switch (p.artefact) {
    case 'orrery':
      return orrery(p);
    case 'orb':
      return orb(p);
    default:
      return tome(p);
  }
}
