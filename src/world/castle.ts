/**
 * Hogwarts-inspired castle silhouette on a cliff: towers, halls, spires and
 * hundreds of warm windows (emissive canvas texture). Low-poly by design —
 * it reads through silhouette, moonlight and bloom.
 */
import * as THREE from 'three';
import { castleWindows, stoneBlocks } from '../core/textures';
import { mulberry32 } from '../core/noise';

export interface Castle {
  group: THREE.Group;
  /** Point the camera aims at during the approach. */
  focus: THREE.Vector3;
  /** Where the boats pass under the cliff (local). */
  entrance: THREE.Vector3;
  windowMats: THREE.MeshStandardMaterial[];
}

export function buildCastle(): Castle {
  const group = new THREE.Group();
  const rnd = mulberry32(42);
  const stone = stoneBlocks('castle', { rows: 8, cols: 4, tint: [70, 72, 82], seed: 31, size: 256 });
  const winTex = castleWindows(5, 0.55);
  const winTex2 = castleWindows(9, 0.38);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x141a26, roughness: 0.6, metalness: 0.2 });
  const windowMats: THREE.MeshStandardMaterial[] = [];

  const wallMat = (w: number, h: number, dense = true) => {
    const map = stone.map.clone();
    map.repeat.set(w / 10, h / 10);
    const em = (dense ? winTex : winTex2).clone();
    em.repeat.set(Math.max(1, Math.round(w / 22)), Math.max(1, Math.round(h / 22)));
    em.offset.set(rnd(), rnd());
    const m = new THREE.MeshStandardMaterial({
      map,
      color: 0x8a90a0,
      roughness: 0.92,
      emissive: 0xffb060,
      emissiveMap: em,
      emissiveIntensity: 2.4,
    });
    windowMats.push(m);
    return m;
  };

  /* ── Cliff ── */
  const rock = new THREE.MeshStandardMaterial({ color: 0x1a1e26, roughness: 1, flatShading: true });
  const cliffGeo = new THREE.IcosahedronGeometry(1, 3);
  const pos = cliffGeo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = 1 + (Math.sin(v.x * 5.1) * Math.cos(v.z * 4.3) + Math.sin(v.y * 7.7)) * 0.08 + (rnd() - 0.5) * 0.06;
    v.multiplyScalar(n);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  cliffGeo.computeVertexNormals();
  const cliffs: [number, number, number, number, number, number][] = [
    // x, y, z, sx, sy, sz
    [0, 4, 0, 95, 42, 55],
    [-70, -2, 18, 60, 30, 45],
    [70, -2, 10, 70, 34, 50],
    [-30, 10, -30, 80, 40, 50],
    [35, 12, -25, 70, 38, 45],
    [-130, -6, 30, 70, 22, 50],
    [140, -6, 25, 80, 24, 50],
  ];
  for (const [x, y, z, sx, sy, sz] of cliffs) {
    const m = new THREE.Mesh(cliffGeo, rock);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.rotation.y = rnd() * Math.PI;
    group.add(m);
  }

  const base = 40; // height of the cliff top where buildings stand

  /* ── Towers ── */
  const tower = (x: number, z: number, r: number, h: number, roofH: number, y = base) => {
    const t = new THREE.Group();
    t.position.set(x, y, z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 10), wallMat(r * 6.3, h, h > 30));
    body.position.y = h / 2;
    t.add(body);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.15, r * 1.15, 1.2, 10), roofMat);
    ring.position.y = h;
    t.add(ring);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.2, roofH, 10), roofMat);
    roof.position.y = h + roofH / 2 + 0.5;
    t.add(roof);
    if (roofH > 14) {
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.25, 6, 4), roofMat);
      spire.position.y = h + roofH + 2.5;
      t.add(spire);
    }
    group.add(t);
    return t;
  };

  /* ── Halls (box + gable roof) ── */
  const hall = (x: number, z: number, w: number, d: number, h: number, ry = 0, y = base) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat(w, h));
    body.position.y = h / 2;
    g.add(body);
    const roofGeo = new THREE.CylinderGeometry(d * 0.62, d * 0.62, w, 3, 1);
    roofGeo.rotateZ(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = h + d * 0.31;
    roof.rotation.x = -Math.PI / 2;
    g.add(roof);
    group.add(g);
    return g;
  };

  // Great hall with tall windows, facing the lake
  const gh = hall(-8, 8, 46, 16, 22, 0.05);
  // tall lancet windows on the lake-facing side (brighter strips)
  const lancetMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffc070, emissiveIntensity: 3.2 });
  windowMats.push(lancetMat);
  for (let i = 0; i < 8; i++) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(2, 10), lancetMat);
    w.position.set(-19 + i * 5.4, 11, 8.05);
    gh.add(w);
  }
  hall(26, 0, 30, 14, 18, -0.25);
  hall(-40, -6, 28, 12, 16, 0.3);
  hall(4, -22, 36, 14, 26, 0.0);
  hall(-22, -30, 20, 12, 30, 0.5);

  tower(-34, 14, 5, 34, 16);
  tower(16, 16, 4.2, 30, 14);
  tower(44, 8, 5.5, 40, 18);
  tower(-58, 4, 4.5, 26, 12);
  tower(-6, -12, 6.5, 58, 24); // tall central tower
  tower(28, -28, 4, 52, 20); // astronomy-like
  tower(-38, -26, 5, 44, 18);
  tower(60, -12, 4, 30, 13);
  tower(-70, -16, 3.6, 22, 10);
  tower(12, -40, 3.2, 40, 15);
  // small turrets
  for (let i = 0; i < 10; i++) tower(-60 + rnd() * 120, -10 + rnd() * 30, 1.6 + rnd() * 1.2, 10 + rnd() * 14, 6 + rnd() * 5, base + 12 + rnd() * 6);

  // Covered bridge reaching to a lone tower
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(40, 5, 5), wallMat(40, 5));
  bridge.position.set(85, base - 4, 12);
  bridge.rotation.y = -0.15;
  group.add(bridge);
  tower(108, 16, 4, 34, 13, base - 18);

  // Boathouse arch at the waterline (where the boats go in)
  const archShape = new THREE.Shape();
  archShape.moveTo(-14, -2);
  archShape.lineTo(14, -2);
  archShape.lineTo(14, 18);
  archShape.lineTo(-14, 18);
  archShape.lineTo(-14, -2);
  const hole = new THREE.Path();
  hole.moveTo(-7, -2);
  hole.lineTo(-7, 6);
  hole.absarc(0, 6, 7, Math.PI, 0, true);
  hole.lineTo(7, -2);
  archShape.holes.push(hole);
  const archMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(archShape, { depth: 6, bevelEnabled: false }), new THREE.MeshStandardMaterial({ map: stone.map, color: 0x5a6070, roughness: 0.95 }));
  archMesh.position.set(0, 0, 52);
  group.add(archMesh);
  const caveDark = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: 0x010204 }));
  caveDark.position.set(0, 5, 51);
  group.add(caveDark);
  const caveGlow = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), new THREE.MeshBasicMaterial({ color: 0xffa040 }));
  caveGlow.position.set(0, 2, 50.5);
  group.add(caveGlow);

  return { group, focus: new THREE.Vector3(0, 70, 0), entrance: new THREE.Vector3(0, 0, 58), windowMats };
}
