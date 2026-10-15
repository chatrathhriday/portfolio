/**
 * A stylised red steam locomotive, tender and coaches built from primitives.
 * Faces +X. Exposes wheel groups and emitter points for animation.
 */
import * as THREE from 'three';
import { textTexture } from '../core/textures';

export interface Train {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  rods: THREE.Object3D[];
  chimneyTop: THREE.Object3D;
  cylinderVents: THREE.Object3D[];
  headlamp: THREE.Object3D;
  windowMats: THREE.MeshStandardMaterial[];
  length: number;
}

const RED = 0x7d1414;

export function buildTrain(coaches = 3): Train {
  const group = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: RED, roughness: 0.32, metalness: 0.35 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.55, metalness: 0.5 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc8a050, roughness: 0.25, metalness: 0.95 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x55565a, roughness: 0.35, metalness: 0.9 });
  const wheels: THREE.Object3D[] = [];
  const rods: THREE.Object3D[] = [];
  const windowMats: THREE.MeshStandardMaterial[] = [];

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z = 0, parent: THREE.Object3D = loco) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const cylX = (r: number, l: number, seg = 24, r2 = r) => new THREE.CylinderGeometry(r2, r, l, seg).rotateZ(Math.PI / 2);

  /* ── Locomotive ── */
  const loco = new THREE.Group();
  group.add(loco);
  add(new THREE.BoxGeometry(11.2, 0.45, 2.3), black, 0, 0.95); // frame
  add(new THREE.BoxGeometry(0.35, 0.7, 2.7), red, 5.6, 1.0); // buffer beam
  for (const z of [-0.85, 0.85]) {
    const b = add(cylX(0.13, 0.5), steel, 5.95, 1.05, z);
    add(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 20).rotateZ(Math.PI / 2), steel, 0.27, 0, 0, b);
  }
  // running boards
  add(new THREE.BoxGeometry(9.5, 0.08, 2.95), black, 0.4, 1.95);
  // boiler
  const boiler = add(cylX(1.02, 6.2, 36), red, 1.0, 2.95);
  boiler.castShadow = true;
  for (const x of [-1.8, -0.2, 1.4, 3.0]) add(cylX(1.04, 0.07, 36), brass, x, 2.95);
  // smokebox + door
  add(cylX(1.08, 1.3, 36), black, 4.65, 2.95);
  add(new THREE.SphereGeometry(1.0, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2).scale(0.22, 1, 1), black, 5.3, 2.95);
  add(cylX(0.06, 0.12), brass, 5.52, 2.95); // door handle
  // number plate
  const plate = new THREE.MeshStandardMaterial({
    map: textTexture([{ text: '5972', font: 'bold 70px Cinzel, serif', color: '#e6c77a', y: 50 }], { w: 256, h: 100, bg: '#1a0d0a', border: '#c8a050', borderWidth: 6 }),
    roughness: 0.4,
    metalness: 0.6,
  });
  const np = add(new THREE.PlaneGeometry(0.6, 0.24), plate, 5.33, 3.65);
  np.rotation.y = Math.PI / 2;
  // chimney
  add(new THREE.CylinderGeometry(0.32, 0.27, 1.0, 24), black, 4.55, 4.35);
  add(new THREE.CylinderGeometry(0.42, 0.34, 0.16, 24), black, 4.55, 4.88);
  const chimneyTop = new THREE.Object3D();
  chimneyTop.position.set(4.55, 5.05, 0);
  loco.add(chimneyTop);
  // dome & safety valve (brass)
  add(new THREE.CylinderGeometry(0.42, 0.5, 0.55, 24), red, 1.6, 4.1);
  add(new THREE.SphereGeometry(0.43, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), brass, 1.6, 4.37);
  add(new THREE.CylinderGeometry(0.22, 0.32, 0.5, 20), brass, -0.9, 4.1);
  // whistle
  add(new THREE.CylinderGeometry(0.06, 0.08, 0.35, 12), brass, -1.95, 4.25);
  // headlamp
  const lamp = add(new THREE.CylinderGeometry(0.16, 0.18, 0.32, 16), black, 5.45, 2.0, 0.85);
  const lampLens = new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffc870, emissiveIntensity: 5 });
  const lens = add(new THREE.CircleGeometry(0.13, 20), lampLens, 0.17, 0.0, 0, lamp);
  lens.rotation.y = Math.PI / 2;
  const headlamp = lens;
  // cylinders (steam chests) either side, front
  const cylinderVents: THREE.Object3D[] = [];
  for (const z of [-1.2, 1.2]) {
    add(cylX(0.42, 1.5, 20), red, 4.1, 1.55, z);
    add(cylX(0.44, 0.06, 20), brass, 4.85, 1.55, z);
    const v = new THREE.Object3D();
    v.position.set(4.6, 1.15, z * 1.15);
    loco.add(v);
    cylinderVents.push(v);
  }
  // cab
  const cabX = -3.2;
  add(new THREE.BoxGeometry(2.0, 2.5, 2.9), red, cabX, 3.15);
  const roof = add(cylX(1.62, 2.4, 28), black, cabX, 4.42);
  roof.scale.set(1, 0.2, 1);
  const cabWin = new THREE.MeshStandardMaterial({ color: 0x331a08, emissive: 0xffa040, emissiveIntensity: 1.6 });
  windowMats.push(cabWin);
  for (const z of [-1.46, 1.46]) {
    const w = add(new THREE.PlaneGeometry(0.75, 0.75), cabWin, cabX + 0.25, 3.7, z);
    w.rotation.y = z > 0 ? 0 : Math.PI;
  }
  const front = add(new THREE.CircleGeometry(0.28, 20), cabWin, cabX + 1.01, 3.85, 0.75);
  front.rotation.y = Math.PI / 2;
  const front2 = front.clone();
  front2.position.z = -0.75;
  loco.add(front2);
  // name plate on the side of the cab
  const namePlate = new THREE.MeshStandardMaterial({
    map: textTexture([{ text: 'HOGWARTS CASTLE', font: 'bold 52px Cinzel, serif', color: '#e6c77a', y: 46 }], { w: 600, h: 92, bg: '#14090a', border: '#c8a050', borderWidth: 5 }),
    roughness: 0.4,
    metalness: 0.6,
  });
  for (const z of [-1.52, 1.52]) {
    const n = add(new THREE.PlaneGeometry(1.6, 0.25), namePlate, 1.0, 2.1, z);
    n.rotation.y = z > 0 ? 0 : Math.PI;
  }
  // wheels
  const wheelGeo = (r: number) => {
    const g = new THREE.CylinderGeometry(r, r, 0.14, 28).rotateX(Math.PI / 2);
    return g;
  };
  const makeWheel = (r: number, x: number, z: number, spokes = 10) => {
    const w = new THREE.Group();
    w.position.set(x, r + 0.02, z);
    w.add(new THREE.Mesh(wheelGeo(r), red));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 8, 32), steel);
    rim.position.z = Math.sign(z) * 0.07;
    w.add(rim);
    for (let i = 0; i < spokes; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, r * 1.9, 0.05), black);
      s.rotation.z = (i / spokes) * Math.PI;
      s.position.z = Math.sign(z) * 0.08;
      w.add(s);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.2, 16).rotateX(Math.PI / 2), brass);
    hub.position.z = Math.sign(z) * 0.09;
    w.add(hub);
    w.userData.r = r;
    loco.add(w);
    wheels.push(w);
    return w;
  };
  for (const z of [-1.18, 1.18]) {
    for (const x of [-1.6, 0.4, 2.4]) makeWheel(0.92, x, z);
    for (const x of [4.0, 5.0]) makeWheel(0.48, x, z, 8);
    // coupling rod
    const rod = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 0.06), steel);
    rod.position.set(0.4, 0.94, z * 1.12);
    rod.userData.baseY = 0.94;
    rod.userData.baseX = 0.4;
    loco.add(rod);
    rods.push(rod);
  }

  /* ── Tender ── */
  const tender = new THREE.Group();
  tender.position.x = -6.4;
  group.add(tender);
  const tb = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.1, 2.9), red);
  tb.position.y = 2.25;
  tender.add(tb);
  const coal = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.5, 2.6), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95 }));
  coal.position.y = 3.35;
  tender.add(coal);
  const tf = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.4, 2.3), black);
  tf.position.y = 0.95;
  tender.add(tf);
  for (const z of [-1.18, 1.18]) for (const x of [-1.3, 0, 1.3]) {
    const w = makeWheel(0.55, 0, z, 8);
    loco.remove(w);
    w.position.x = x;
    tender.add(w);
  }
  const brassLine = new THREE.Mesh(new THREE.BoxGeometry(4.22, 0.05, 2.92), brass);
  brassLine.position.y = 2.6;
  tender.add(brassLine);

  /* ── Coaches ── */
  const coachLen = 13;
  const winTex = coachWindowTexture();
  for (let c = 0; c < coaches; c++) {
    const coach = new THREE.Group();
    coach.position.x = -6.4 - 2.1 - 0.6 - coachLen / 2 - c * (coachLen + 0.8);
    group.add(coach);
    const body = new THREE.Mesh(new THREE.BoxGeometry(coachLen, 2.6, 2.9), red);
    body.position.y = 2.6;
    coach.add(body);
    const lower = new THREE.Mesh(new THREE.BoxGeometry(coachLen + 0.02, 0.9, 2.92), new THREE.MeshStandardMaterial({ color: 0x4a0b0b, roughness: 0.4, metalness: 0.3 }));
    lower.position.y = 1.75;
    coach.add(lower);
    const roofM = new THREE.Mesh(cylX(1.6, coachLen + 0.3, 28), black);
    roofM.position.y = 3.9;
    roofM.scale.set(1, 0.26, 1);
    coach.add(roofM);
    const brassStrip = new THREE.Mesh(new THREE.BoxGeometry(coachLen + 0.04, 0.05, 2.94), brass);
    brassStrip.position.y = 2.2;
    coach.add(brassStrip);
    // window band (emissive canvas)
    const wm = new THREE.MeshStandardMaterial({ map: winTex, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.1 });
    windowMats.push(wm);
    for (const z of [-1.46, 1.46]) {
      const band = new THREE.Mesh(new THREE.PlaneGeometry(coachLen - 0.6, 1.0), wm);
      band.position.set(0, 3.0, z);
      band.rotation.y = z > 0 ? 0 : Math.PI;
      coach.add(band);
    }
    const under = new THREE.Mesh(new THREE.BoxGeometry(coachLen - 1, 0.4, 2.2), black);
    under.position.y = 1.05;
    coach.add(under);
    for (const z of [-1.1, 1.1]) for (const x of [-coachLen / 2 + 1.6, -coachLen / 2 + 3.0, coachLen / 2 - 3.0, coachLen / 2 - 1.6]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.12, 20).rotateX(Math.PI / 2), black);
      w.position.set(x, 0.5, z);
      w.userData.r = 0.48;
      coach.add(w);
      wheels.push(w);
    }
  }

  const len = 12 + 4.2 + coaches * (coachLen + 0.8);
  return { group, wheels, rods, chimneyTop, cylinderVents, headlamp, windowMats, length: len };
}

/** Warm coach windows with mullions and the odd passenger silhouette. */
function coachWindowTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 80;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5a0f0f';
  g.fillRect(0, 0, 1024, 80);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const x = 18 + i * (1024 / n);
    const w = 1024 / n - 36;
    const grd = g.createLinearGradient(0, 8, 0, 72);
    grd.addColorStop(0, '#ffcf7a');
    grd.addColorStop(1, '#d9822e');
    g.fillStyle = grd;
    g.fillRect(x, 8, w, 64);
    // silhouettes
    if (i % 3 !== 1) {
      g.fillStyle = 'rgba(40,14,6,0.75)';
      const sx = x + w * (0.3 + ((i * 37) % 10) / 25);
      g.beginPath();
      g.arc(sx, 40, 9, 0, Math.PI * 2);
      g.fill();
      g.fillRect(sx - 15, 50, 30, 22);
    }
    g.fillStyle = '#3a0a0a';
    g.fillRect(x + w / 2 - 2, 8, 4, 64);
    g.fillRect(x, 30, w, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
