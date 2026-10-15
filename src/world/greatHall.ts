/**
 * The Great Hall: photo-textured stone and oak, four long house tables set
 * with real goblets and plates, the head table on its dais, rippling banners,
 * moonlit lancet windows with light shafts, a rose window, and hundreds of
 * floating candles under an open, enchanted sky.
 */
import * as THREE from 'three';
import { pbrMaterial, type PbrMaps, firstMesh } from '../core/assets';
import { GLSL_NOISE } from '../core/noise';
import { mulberry32 } from '../core/noise';
import { Flames } from '../fx/atmosphere';
import type { QualityProfile } from '../core/quality';

export const HALL = { W: 24, WALL_H: 15, FRONT_Z: 8, BACK_Z: -60, DAIS_Z: -54, TABLE_X: [-7.5, -2.5, 2.5, 7.5], TABLE_Z0: -6, TABLE_Z1: -46 };

export interface HallAssets {
  brick: PbrMaps;
  floor: PbrMaps;
  wood: PbrMaps;
  blocks: PbrMaps;
  goblet: THREE.Group | null;
  plate: THREE.Group | null;
}

export interface GreatHall {
  group: THREE.Group;
  /** Floating candles above the tables. */
  candles: { mesh: THREE.InstancedMesh; flames: Flames; pos: THREE.Vector3[] };
  /** Candelabra on the tables. */
  tableFlames: Flames;
  /** Wall sconces. */
  sconceFlames: Flames;
  sconcePos: THREE.Vector3[];
  windowMat: THREE.MeshStandardMaterial;
  roseMat: THREE.MeshStandardMaterial;
  shafts: THREE.ShaderMaterial[];
  bannerUniforms: { uTime: { value: number } };
  update(t: number, bob: number): void;
}

/* ── helpers ──────────────────────────────────────────────────────────── */

/** Merge non-indexed copies of simple primitives (position/normal/uv only). */
function mergeSimple(geos: THREE.BufferGeometry[]) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv'] as const) {
    const size = parts[0].attributes[name].itemSize;
    const arr = new Float32Array(total * size);
    let o = 0;
    for (const g of parts) {
      arr.set(g.attributes[name].array as Float32Array, o);
      o += g.attributes[name].count * size;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  return out;
}

function lancetShape(w: number, h: number) {
  const s = new THREE.Shape();
  const hw = w / 2;
  s.moveTo(-hw, 0);
  s.lineTo(hw, 0);
  s.lineTo(hw, h - w * 0.9);
  s.quadraticCurveTo(hw, h - w * 0.15, 0, h);
  s.quadraticCurveTo(-hw, h - w * 0.15, -hw, h - w * 0.9);
  s.lineTo(-hw, 0);
  return s;
}

/** Leaded glass: diamond quarries + a tracery border, used as map and emissive map. */
function leadedGlass(seed: number) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 1024;
  const g = c.getContext('2d')!;
  const rnd = mulberry32(seed);
  for (let y = 0; y < 1024; y += 32)
    for (let x = 0; x < 256; x += 32) {
      const k = 0.55 + rnd() * 0.45;
      g.fillStyle = `rgb(${120 * k}, ${150 * k}, ${210 * k})`;
      g.fillRect(x, y, 32, 32);
    }
  g.strokeStyle = 'rgba(10,12,20,0.95)';
  g.lineWidth = 3;
  for (let i = -40; i < 40; i++) {
    g.beginPath();
    g.moveTo(i * 32, 0);
    g.lineTo(i * 32 + 1024, 1024);
    g.stroke();
    g.beginPath();
    g.moveTo(i * 32 + 1024, 0);
    g.lineTo(i * 32, 1024);
    g.stroke();
  }
  g.lineWidth = 14;
  g.strokeRect(0, 0, 256, 1024);
  g.fillStyle = 'rgba(10,12,20,0.95)';
  g.fillRect(124, 0, 8, 1024);
  for (const y of [340, 680]) g.fillRect(0, y, 256, 10);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roseWindow() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d')!;
  g.translate(512, 512);
  const petals = 16;
  const cols = ['#c8463a', '#3a62b8', '#d8a940', '#3f8a5a', '#8a4ab0'];
  for (let ring = 4; ring >= 1; ring--) {
    for (let i = 0; i < petals; i++) {
      g.save();
      g.rotate((i / petals) * Math.PI * 2 + ring * 0.2);
      g.fillStyle = cols[(i + ring) % cols.length];
      g.beginPath();
      g.ellipse(0, -ring * 110, 46, 70, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }
  g.fillStyle = '#f1d68a';
  g.beginPath();
  g.arc(0, 0, 70, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#0a0b10';
  g.lineWidth = 12;
  for (let r = 70; r <= 500; r += 110) {
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
  }
  for (let i = 0; i < petals; i++) {
    g.save();
    g.rotate((i / petals) * Math.PI * 2);
    g.fillRect(-5, 70, 10, 430);
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function bannerTexture(base: string, trim: string, sym: number) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 768;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 256, 0);
  grd.addColorStop(0, base);
  grd.addColorStop(0.5, shade(base, 1.25));
  grd.addColorStop(1, base);
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 768);
  // swallow-tail cut is done in geometry; here: trim, a shield and a motif
  g.strokeStyle = trim;
  g.lineWidth = 10;
  g.strokeRect(14, 10, 228, 740);
  g.lineWidth = 3;
  g.strokeRect(28, 24, 200, 712);
  g.fillStyle = trim;
  g.beginPath();
  g.moveTo(70, 220);
  g.lineTo(186, 220);
  g.lineTo(186, 330);
  g.quadraticCurveTo(186, 400, 128, 430);
  g.quadraticCurveTo(70, 400, 70, 330);
  g.closePath();
  g.fill();
  g.fillStyle = base;
  g.font = '700 80px Cinzel, Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(['✦', '❖', '✧', '❂'][sym], 128, 320);
  for (let i = 0; i < 6; i++) {
    g.fillStyle = trim;
    g.globalAlpha = 0.4;
    g.fillRect(40, 500 + i * 34, 176, 3);
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function shade(hex: string, k: number) {
  const c = new THREE.Color(hex).multiplyScalar(k);
  return '#' + c.getHexString();
}

/** One InstancedMesh per mesh in a model, placed with the given matrices. */
function instanceModel(model: THREE.Object3D, mats: THREE.Matrix4[]) {
  const out: THREE.InstancedMesh[] = [];
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const im = new THREE.InstancedMesh(m.geometry, m.material, mats.length);
    const local = m.matrixWorld.clone();
    mats.forEach((w, i) => im.setMatrixAt(i, w.clone().multiply(local)));
    im.castShadow = false;
    im.receiveShadow = true;
    out.push(im);
  });
  return out;
}

/* ── build ────────────────────────────────────────────────────────────── */

export function buildGreatHall(a: HallAssets, q: QualityProfile): GreatHall {
  const { W, WALL_H, FRONT_Z, BACK_Z, DAIS_Z } = HALL;
  const L = FRONT_Z - BACK_Z;
  const zc = (FRONT_Z + BACK_Z) / 2;
  const group = new THREE.Group();
  const rnd = mulberry32(7);

  const wallMat = pbrMaterial(a.brick, [L / 3.2, WALL_H / 3.2], { color: 0xb8aca0 });
  const floorMat = pbrMaterial(a.floor, [W / 3, L / 3], { color: 0x9a9088, roughness: 0.75 });
  const woodMat = pbrMaterial(a.wood, [1, 12], { color: 0x8a6448 });
  const woodSmall = pbrMaterial(a.wood, [1, 1], { color: 0x6a4a34 });
  const stoneTrim = pbrMaterial(a.blocks, [1, 4], { color: 0xa09486 });

  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L).rotateX(-Math.PI / 2), floorMat);
  floor.position.set(0, 0, zc);
  floor.receiveShadow = true;
  group.add(floor);
  // side walls
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(L, WALL_H), wallMat);
    w.position.set((side * W) / 2, WALL_H / 2, zc);
    w.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    w.receiveShadow = true;
    group.add(w);
  }
  // back wall + front wall (front has the entrance arch)
  const backMat = pbrMaterial(a.brick, [W / 3.2, (WALL_H + 6) / 3.2], { color: 0xb8aca0 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, WALL_H + 6), backMat);
  back.position.set(0, (WALL_H + 6) / 2, BACK_Z);
  group.add(back);
  const front = new THREE.Shape();
  front.moveTo(-W / 2, 0);
  front.lineTo(W / 2, 0);
  front.lineTo(W / 2, WALL_H);
  front.lineTo(-W / 2, WALL_H);
  front.lineTo(-W / 2, 0);
  const hole = new THREE.Path();
  hole.moveTo(-2.2, 0);
  hole.lineTo(-2.2, 4.2);
  hole.absarc(0, 4.2, 2.2, Math.PI, 0, true);
  hole.lineTo(2.2, 0);
  hole.lineTo(-2.2, 0);
  front.holes.push(hole);
  const frontGeo = new THREE.ShapeGeometry(front, 24);
  // planar UVs in metres so the brick tiles correctly
  const fp = frontGeo.attributes.position, fuv = frontGeo.attributes.uv;
  for (let i = 0; i < fp.count; i++) fuv.setXY(i, fp.getX(i) / W, fp.getY(i) / WALL_H);
  const frontMat = pbrMaterial(a.brick, [W / 3.2, WALL_H / 3.2], { color: 0xb8aca0, side: THREE.DoubleSide });
  const frontWall = new THREE.Mesh(frontGeo, frontMat);
  frontWall.position.z = FRONT_Z;
  group.add(frontWall);

  // cornice along the top of the walls
  for (const side of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, L), stoneTrim);
    c.position.set(side * (W / 2 - 0.3), WALL_H - 0.2, zc);
    group.add(c);
  }

  // buttress pilasters (instanced) + sconces
  const bay = 8;
  const bays = Math.floor(L / bay);
  const pil = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, WALL_H, 0.9), stoneTrim, (bays + 1) * 2);
  const m4 = new THREE.Matrix4();
  const sconcePos: THREE.Vector3[] = [];
  let k = 0;
  for (let i = 0; i <= bays; i++) {
    const z = FRONT_Z - 2 - i * bay;
    for (const side of [-1, 1]) {
      pil.setMatrixAt(k++, m4.makeTranslation(side * (W / 2 - 0.45), WALL_H / 2, z));
      if (z < FRONT_Z - 4 && z > BACK_Z + 2) sconcePos.push(new THREE.Vector3(side * (W / 2 - 1.15), 6.4, z));
    }
  }
  pil.receiveShadow = true;
  group.add(pil);
  const iron = new THREE.MeshStandardMaterial({ color: 0x1b1a1a, metalness: 0.8, roughness: 0.45 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a14f, metalness: 1, roughness: 0.28 });
  const cup = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.1, 0.3, 12), iron, sconcePos.length);
  const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.08, 0.7), iron, sconcePos.length);
  const q4 = new THREE.Quaternion();
  sconcePos.forEach((p, i) => {
    cup.setMatrixAt(i, m4.makeTranslation(p.x, p.y - 0.15, p.z));
    q4.setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
    arm.setMatrixAt(i, m4.compose(new THREE.Vector3(p.x + (p.x > 0 ? 0.35 : -0.35), p.y - 0.3, p.z), q4, new THREE.Vector3(1, 1, 1)));
  });
  group.add(cup, arm);
  const sconceFlames = new Flames(sconcePos.map((p) => p.clone().add(new THREE.Vector3(0, 0.15, 0))), 0.9, 0xff9a40, 0);

  // lancet windows between the pilasters, both walls
  const glass = leadedGlass(3);
  const windowMat = new THREE.MeshStandardMaterial({ map: glass, emissive: 0xffffff, emissiveMap: glass, emissiveIntensity: 0.55, roughness: 0.2, color: 0x222222 });
  const lancet = new THREE.ShapeGeometry(lancetShape(2.6, 9), 12);
  // remap UVs to the shape's bounds
  const lp = lancet.attributes.position, luv = lancet.attributes.uv;
  for (let i = 0; i < lp.count; i++) luv.setXY(i, lp.getX(i) / 2.6 + 0.5, lp.getY(i) / 9);
  const shafts: THREE.ShaderMaterial[] = [];
  const shaftMat = () =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(0x7d9ad8) }, uOpacity: { value: 0.09 }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        ${GLSL_NOISE}
        uniform vec3 uColor; uniform float uOpacity, uTime; varying vec2 vUv; varying vec3 vW;
        void main(){
          float across = sin(vUv.x * 3.14159);
          float dust = 0.7 + 0.6 * fbm(vW.xy * 0.6 + vec2(0.0, uTime * 0.05));
          float a = across * smoothstep(0.0, 0.3, vUv.y) * (0.35 + 0.65 * vUv.y) * dust;
          gl_FragColor = vec4(uColor, a * uOpacity);
        }`,
    });
  for (let i = 0; i < bays; i++) {
    const z = FRONT_Z - 2 - i * bay - bay / 2;
    if (z < DAIS_Z + 2) continue;
    for (const side of [-1, 1]) {
      const win = new THREE.Mesh(lancet, windowMat);
      win.position.set(side * (W / 2 - 0.02), 4, z);
      win.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(win);
      // deep stone reveal around the window
      const reveal = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 3.1), stoneTrim);
      reveal.position.set(side * (W / 2 - 0.2), 3.9, z);
      group.add(reveal);
      if (side < 0) {
        // moonlight falls in from the left (moon side)
        const mat = shaftMat();
        shafts.push(mat);
        const g = new THREE.BufferGeometry();
        const wx = -W / 2 + 0.05;
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([wx, 4, 0, wx, 12.4, 0, -W / 2 + 7, 0, 0, W / 2 - 6, 0, 0]), 3));
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]), 2));
        g.setIndex([0, 2, 1, 1, 2, 3]);
        for (const dz of [-0.7, 0.7]) {
          const s = new THREE.Mesh(g, mat);
          s.position.z = z + dz;
          s.renderOrder = 3;
          group.add(s);
        }
      }
    }
  }

  // rose window + twin lancets behind the head table
  const rose = roseWindow();
  const roseMat = new THREE.MeshStandardMaterial({ map: rose, emissive: 0xffffff, emissiveMap: rose, emissiveIntensity: 0.6, roughness: 0.2, color: 0x222222 });
  const roseMesh = new THREE.Mesh(new THREE.CircleGeometry(4.2, 64), roseMat);
  roseMesh.position.set(0, 13.5, BACK_Z + 0.05);
  group.add(roseMesh);
  const roseRing = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.35, 12, 64), stoneTrim);
  roseRing.position.copy(roseMesh.position);
  group.add(roseRing);
  for (const x of [-5.5, 5.5]) {
    const w = new THREE.Mesh(lancet, windowMat);
    w.position.set(x, 3.2, BACK_Z + 0.05);
    group.add(w);
  }

  // dais + steps
  const dais = new THREE.Mesh(new THREE.BoxGeometry(W, 0.6, 8), pbrMaterial(a.floor, [W / 3, 8 / 3], { color: 0x8a8078 }));
  dais.position.set(0, 0.3, DAIS_Z - 2);
  dais.receiveShadow = true;
  group.add(dais);
  const step = new THREE.Mesh(new THREE.BoxGeometry(W - 2, 0.3, 0.8), stoneTrim);
  step.position.set(0, 0.15, DAIS_Z + 2.4);
  group.add(step);

  // head table + high-backed chairs
  const headTop = new THREE.Mesh(new THREE.BoxGeometry(15, 0.1, 1.6), woodMat);
  headTop.position.set(0, 1.45, DAIS_Z - 1);
  headTop.castShadow = headTop.receiveShadow = true;
  group.add(headTop);
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(15.05, 0.75, 1.62), new THREE.MeshStandardMaterial({ color: 0x3a0f12, roughness: 0.9 }));
  cloth.position.set(0, 1.05, DAIS_Z - 1);
  group.add(cloth);
  const chairBack = new THREE.Shape();
  chairBack.moveTo(-0.32, 0);
  chairBack.lineTo(0.32, 0);
  chairBack.lineTo(0.32, 1.5);
  chairBack.quadraticCurveTo(0.32, 1.95, 0, 2.1);
  chairBack.quadraticCurveTo(-0.32, 1.95, -0.32, 1.5);
  chairBack.lineTo(-0.32, 0);
  const backGeo = new THREE.ExtrudeGeometry(chairBack, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
  for (let i = -4; i <= 4; i++) {
    const big = i === 0;
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.6), woodSmall);
    seat.position.y = 1.1;
    const bk = new THREE.Mesh(backGeo, woodSmall);
    bk.position.set(0, 1.1, -0.32);
    if (big) bk.scale.set(1.3, 1.35, 1);
    chair.add(seat, bk);
    if (big) {
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), brass);
      crown.position.set(0, 1.1 + 2.1 * 1.35 + 0.05, -0.3);
      chair.add(crown);
    }
    chair.position.set(i * 1.6, 0, DAIS_Z - 2.2);
    group.add(chair);
  }
  // golden lectern in front of the dais
  const lectern = new THREE.Group();
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 1.2, 16), brass);
  col.position.y = 0.6;
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.5), brass);
  top.position.y = 1.25;
  top.rotation.x = -0.35;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.08, 20), brass);
  for (const sx of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 4), brass);
    wing.position.set(sx * 0.3, 1.1, 0.1);
    wing.rotation.z = sx * 1.1;
    lectern.add(wing);
  }
  lectern.add(col, top, base);
  lectern.position.set(0, 0.6, DAIS_Z + 1.6);
  group.add(lectern);

  // house tables + benches (shared geometry, separate meshes keep it simple)
  const tableLen = HALL.TABLE_Z0 - HALL.TABLE_Z1;
  const tzc = (HALL.TABLE_Z0 + HALL.TABLE_Z1) / 2;
  const topGeo = new THREE.BoxGeometry(1.6, 0.09, tableLen);
  const benchGeo = new THREE.BoxGeometry(0.42, 0.07, tableLen);
  const legGeo = new THREE.BoxGeometry(0.12, 0.74, 0.12);
  const legCount = HALL.TABLE_X.length * 2 * 9 + HALL.TABLE_X.length * 4 * 9;
  const legs = new THREE.InstancedMesh(legGeo, woodSmall, legCount);
  let li = 0;
  for (const x of HALL.TABLE_X) {
    const t = new THREE.Mesh(topGeo, woodMat);
    t.position.set(x, 0.78, tzc);
    t.castShadow = t.receiveShadow = true;
    group.add(t);
    for (const bx of [-1.05, 1.05]) {
      const b = new THREE.Mesh(benchGeo, woodMat);
      b.position.set(x + bx, 0.45, tzc);
      b.receiveShadow = true;
      group.add(b);
    }
    for (let i = 0; i < 9; i++) {
      const z = HALL.TABLE_Z0 - 1 - i * ((tableLen - 2) / 8);
      for (const lx of [-0.65, 0.65]) legs.setMatrixAt(li++, m4.makeTranslation(x + lx, 0.37, z));
      for (const lx of [-1.2, -0.9, 0.9, 1.2]) {
        const s = new THREE.Matrix4().makeScale(0.7, 0.57, 0.7);
        legs.setMatrixAt(li++, m4.makeTranslation(x + lx, 0.21, z).multiply(s));
      }
    }
  }
  legs.count = li;
  group.add(legs);

  // table settings: plates + goblets along both sides of every table
  if (q.tier !== 'low') {
    const plateMats: THREE.Matrix4[] = [];
    const gobletMats: THREE.Matrix4[] = [];
    const spacing = q.tier === 'high' ? 1.8 : 2.6;
    for (const x of HALL.TABLE_X)
      for (let z = HALL.TABLE_Z0 - 1.2; z > HALL.TABLE_Z1 + 1; z -= spacing)
        for (const sx of [-0.45, 0.45]) {
          const rot = new THREE.Matrix4().makeRotationY(rnd() * Math.PI * 2);
          plateMats.push(new THREE.Matrix4().makeTranslation(x + sx, 0.83, z).multiply(rot));
          gobletMats.push(new THREE.Matrix4().makeTranslation(x + sx * 0.5, 0.83, z - 0.35).multiply(rot));
        }
    const place = (src: THREE.Group | null, mats: THREE.Matrix4[], height: number) => {
      if (!src) return;
      const box = new THREE.Box3().setFromObject(src);
      const size = box.getSize(new THREE.Vector3());
      const s = height / (size.y || 1);
      const norm = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2));
      const wrap = new THREE.Group();
      src.applyMatrix4(norm);
      wrap.add(src);
      for (const im of instanceModel(wrap, mats)) group.add(im);
    };
    place(a.plate, plateMats, 0.03);
    // the goblet model is a set; use only its first mesh as a single goblet
    if (a.goblet) {
      const mesh = firstMesh(a.goblet);
      if (mesh) {
        const single = new THREE.Group();
        const clone = new THREE.Mesh(mesh.geometry, mesh.material);
        clone.geometry.computeBoundingBox();
        single.add(clone);
        place(single, gobletMats, 0.2);
      }
    }
  }

  // candelabra down the middle of each table
  const tableFlamePos: THREE.Vector3[] = [];
  const stands: THREE.Matrix4[] = [];
  for (const x of HALL.TABLE_X)
    for (let z = HALL.TABLE_Z0 - 3; z > HALL.TABLE_Z1 + 2; z -= 6) {
      stands.push(new THREE.Matrix4().makeTranslation(x, 0.83, z));
      for (const dx of [-0.18, 0, 0.18]) tableFlamePos.push(new THREE.Vector3(x + dx, 1.42 + (dx === 0 ? 0.08 : 0), z));
    }
  const standGeo = mergeSimple([
    new THREE.CylinderGeometry(0.11, 0.13, 0.03, 20).translate(0, 0.015, 0),
    new THREE.CylinderGeometry(0.018, 0.026, 0.44, 10).translate(0, 0.24, 0),
    new THREE.SphereGeometry(0.035, 12, 8).translate(0, 0.2, 0),
  ]);
  const standMesh = new THREE.InstancedMesh(standGeo, brass, stands.length);
  const armMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.025, 0.025).translate(0, 0.42, 0), brass, stands.length);
  const tCandle = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.028, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0xf2e6cc, emissive: 0x302010, emissiveIntensity: 0.4 }), tableFlamePos.length);
  stands.forEach((s, i) => {
    standMesh.setMatrixAt(i, s);
    armMesh.setMatrixAt(i, s);
  });
  tableFlamePos.forEach((p, i) => tCandle.setMatrixAt(i, m4.makeTranslation(p.x, p.y - 0.1, p.z)));
  group.add(standMesh, armMesh, tCandle);
  const tableFlames = new Flames(tableFlamePos, 0.22, 0xffb050, 0);

  // floating candles
  const nCandles = Math.round(q.candles * 3);
  const cpos: THREE.Vector3[] = [];
  for (let i = 0; i < nCandles; i++) cpos.push(new THREE.Vector3((rnd() - 0.5) * (W - 4), 7 + rnd() * 6.5, FRONT_Z - 6 - rnd() * (L - 12)));
  const cGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.42, 8);
  cGeo.translate(0, -0.21, 0);
  const cMesh = new THREE.InstancedMesh(cGeo, new THREE.MeshStandardMaterial({ color: 0xf4e8d0, roughness: 0.55, emissive: 0x4a3018, emissiveIntensity: 0.25 }), nCandles);
  group.add(cMesh);
  const cFlames = new Flames(cpos.map((p) => p.clone().add(new THREE.Vector3(0, 0.1, 0))), 0.46, 0xffb050, 0);

  // house banners with a cloth ripple (vertex shader)
  const bannerUniforms = { uTime: { value: 0 } };
  const houses = [
    ['#6e0f16', '#d6a44a'],
    ['#0e4a2c', '#c0c8c8'],
    ['#14285e', '#b88a4a'],
    ['#8a6a14', '#1a1a1a'],
  ];
  const bannerGeo = new THREE.PlaneGeometry(2.2, 7, 8, 24);
  // swallow-tail bottom
  const bp = bannerGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const y = bp.getY(i), x = bp.getX(i);
    if (y < -3.2) bp.setY(i, y + (1 - Math.abs(x) / 1.1) * 0.6);
  }
  HALL.TABLE_X.forEach((x, hi) => {
    const tex = bannerTexture(houses[hi][0], houses[hi][1], hi);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = bannerUniforms.uTime;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float hang = (3.5 - position.y) / 7.0;
           transformed.z += sin(position.y * 0.9 + uTime * 1.1 + position.x * 0.6) * 0.18 * hang + sin(uTime * 0.6 + position.y * 0.3) * 0.08 * hang;
           transformed.x += sin(uTime * 0.8 + position.y * 0.5) * 0.04 * hang;`,
        );
    };
    for (const z of [-14, -28, -42]) {
      const b = new THREE.Mesh(bannerGeo, mat);
      b.position.set(x, WALL_H - 3.3, z + hi * 0.7);
      b.rotation.y = rnd() * 0.3 - 0.15;
      group.add(b);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 8).rotateZ(Math.PI / 2), brass);
      rod.position.set(x, WALL_H + 0.25, z + hi * 0.7);
      group.add(rod);
    }
  });

  return {
    group,
    candles: { mesh: cMesh, flames: cFlames, pos: cpos },
    tableFlames,
    sconceFlames,
    sconcePos,
    windowMat,
    roseMat,
    shafts,
    bannerUniforms,
    update(t, bob) {
      bannerUniforms.uTime.value = t;
      for (const s of shafts) s.uniforms.uTime.value = t;
      const seeds = cFlames.seeds;
      for (let i = 0; i < cpos.length; i++) {
        const p = cpos[i];
        m4.makeTranslation(p.x, p.y + Math.sin(t * 0.8 + seeds[i]) * bob, p.z);
        cMesh.setMatrixAt(i, m4);
      }
      cMesh.instanceMatrix.needsUpdate = true;
      cFlames.update(t);
      tableFlames.update(t);
      sconceFlames.update(t);
    },
  };
}
