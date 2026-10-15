/** Open wooden rowing boat with a bow lantern. Bow points to -Z. */
import * as THREE from 'three';
import { woodPlanks } from '../core/textures';

export interface Boat {
  group: THREE.Group;
  lantern: THREE.Object3D;
  lanternMat: THREE.MeshStandardMaterial;
  length: number;
}

export function buildBoat(opts: { length?: number; width?: number; withLight?: boolean } = {}): Boat {
  const L = opts.length ?? 3.8;
  const W = opts.width ?? 0.75; // half-width
  const D = 0.55;
  const N = 18, M = 10;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const hw = (t: number) => (t < 0.55 ? W * (0.74 + 0.26 * Math.sin((t / 0.55) * (Math.PI / 2))) : W * Math.pow(Math.cos(((t - 0.55) / 0.45) * (Math.PI / 2)), 0.75));
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const z = L / 2 - t * L;
    const sheer = 0.28 * Math.pow(t, 3);
    const depth = D * (1 - 0.25 * t);
    for (let j = 0; j <= M; j++) {
      const a = (j / M) * Math.PI;
      const x = -hw(t) * Math.cos(a);
      const y = sheer - depth * Math.pow(Math.sin(a), 0.6);
      pos.push(x, y, z);
      uv.push(j / M, t * 3);
    }
  }
  for (let i = 0; i < N; i++)
    for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j, b = a + M + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const wood = woodPlanks([86, 54, 32], 3);
  const map = wood.map.clone();
  map.repeat.set(1, 1);
  const mat = new THREE.MeshStandardMaterial({ map, normalMap: wood.normalMap, roughness: 0.75, side: THREE.DoubleSide, color: 0xb08a6a });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, mat));

  // gunwale rails
  const rail = new THREE.MeshStandardMaterial({ color: 0x3a2214, roughness: 0.6 });
  for (const side of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      pts.push(new THREE.Vector3(side * hw(t), 0.28 * Math.pow(t, 3), L / 2 - t * L));
    }
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.035, 5), rail));
  }
  // transom
  const transom = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.48, D * 0.95), mat);
  transom.position.set(0, -D * 0.47, L / 2);
  group.add(transom);
  // seats
  for (const z of [0.9, -0.2]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(W * 1.8, 0.05, 0.28), rail);
    seat.position.set(0, -0.12, z);
    group.add(seat);
  }

  // lantern on a pole at the bow
  const lantern = new THREE.Group();
  const poleZ = -L / 2 + 0.45;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.3), rail);
  pole.position.set(0, 0.5, poleZ);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.35), rail);
  arm.position.set(0, 1.12, poleZ - 0.16);
  group.add(pole, arm);
  lantern.position.set(0, 0.93, poleZ - 0.32);
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xffd38a, emissive: 0xffa040, emissiveIntensity: 5 });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.18, 6), lanternMat);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.08, 6), rail);
  cap.position.y = 0.13;
  lantern.add(glass, cap);
  group.add(lantern);
  if (opts.withLight) {
    const l = new THREE.PointLight(0xffa850, 6, 9, 1.8);
    lantern.add(l);
  }
  return { group, lantern, lanternMat, length: L };
}
