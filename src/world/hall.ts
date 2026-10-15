/**
 * Gothic stone hall segment along -Z: flagstone floor, ashlar walls, a ribbed
 * barrel vault, pilasters, moonlit lancet windows with light shafts, and
 * torch brackets. Instanced where it repeats.
 */
import * as THREE from 'three';
import { flagstones, stoneBlocks } from '../core/textures';
import { GLSL_NOISE } from '../core/noise';

export interface Hall {
  group: THREE.Group;
  torchPositions: THREE.Vector3[];
  shafts: THREE.ShaderMaterial[];
  windowMat: THREE.MeshStandardMaterial;
  width: number;
  wallH: number;
}

export function buildHall(opts: { zStart: number; length: number; width?: number; wallH?: number; bay?: number; windows?: boolean }): Hall {
  const W = opts.width ?? 8, WH = opts.wallH ?? 6.5, L = opts.length, bay = opts.bay ?? 6;
  const z0 = opts.zStart, zc = z0 - L / 2;
  const group = new THREE.Group();

  const stone = stoneBlocks('hall', { rows: 6, cols: 3, tint: [104, 98, 92], seed: 17 });
  const wallMap = stone.map.clone();
  const wallN = stone.normalMap.clone();
  wallMap.repeat.set(L / 4, WH / 4);
  wallN.repeat.copy(wallMap.repeat);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallMap, normalMap: wallN, roughness: 0.88, color: 0xb4aca2 });
  const flags = flagstones(5);
  const fMap = flags.map.clone();
  const fN = flags.normalMap.clone();
  fMap.repeat.set(W / 3, L / 3);
  fN.repeat.copy(fMap.repeat);
  // polished, slightly reflective floor
  const floorMat = new THREE.MeshStandardMaterial({ map: fMap, normalMap: fN, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.38, metalness: 0.05, color: 0x9a948c });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L).rotateX(-Math.PI / 2), floorMat);
  floor.position.set(0, 0, zc);
  group.add(floor);
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(L, WH), wallMat);
    wall.position.set((side * W) / 2, WH / 2, zc);
    wall.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(wall);
  }
  // barrel vault
  const vMap = stone.map.clone();
  vMap.repeat.set(4, L / 4);
  const vaultMat = new THREE.MeshStandardMaterial({ map: vMap, roughness: 0.92, color: 0x8a847c, side: THREE.BackSide });
  const vaultGeo = new THREE.CylinderGeometry(W / 2, W / 2, L, 24, 1, true, Math.PI / 2, Math.PI);
  vaultGeo.rotateX(Math.PI / 2);
  const vault = new THREE.Mesh(vaultGeo, vaultMat);
  vault.position.set(0, WH, zc);
  group.add(vault);

  // pilasters + ribs (instanced)
  const bays = Math.floor(L / bay) + 1;
  const pilMat = new THREE.MeshStandardMaterial({ map: stone.map, roughness: 0.85, color: 0xa29a90 });
  const pil = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, WH, 0.55), pilMat, bays * 2);
  const ribs = new THREE.InstancedMesh(new THREE.TorusGeometry(W / 2 - 0.05, 0.2, 8, 28, Math.PI), pilMat, bays);
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.85, 0.3, 0.8), pilMat, bays * 2);
  const m = new THREE.Matrix4();
  const torchPositions: THREE.Vector3[] = [];
  for (let i = 0; i < bays; i++) {
    const z = z0 - i * bay;
    for (const [k, side] of [-1, 1].entries()) {
      pil.setMatrixAt(i * 2 + k, m.makeTranslation(side * (W / 2 - 0.3), WH / 2, z));
      caps.setMatrixAt(i * 2 + k, m.makeTranslation(side * (W / 2 - 0.35), WH - 0.1, z));
    }
    ribs.setMatrixAt(i, m.makeTranslation(0, WH, z));
    if (i % 2 === 1) torchPositions.push(new THREE.Vector3(W / 2 - 0.62, 3.25, z), new THREE.Vector3(-W / 2 + 0.62, 3.25, z - bay));
  }
  group.add(pil, ribs, caps);

  // torch brackets (instanced) — flames are added by the scene
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x1d1a18, metalness: 0.7, roughness: 0.5 });
  const sticks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.035, 0.6, 6), ironMat, torchPositions.length);
  const cups = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.06, 0.16, 8), ironMat, torchPositions.length);
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  torchPositions.forEach((p, i) => {
    const tilt = p.x > 0 ? 0.35 : -0.35;
    q.setFromEuler(new THREE.Euler(0, 0, tilt));
    sticks.setMatrixAt(i, m.compose(new THREE.Vector3(p.x + (p.x > 0 ? 0.08 : -0.08), p.y - 0.3, p.z), q, s));
    cups.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, p.y - 0.02, p.z), q, s));
  });
  group.add(sticks, cups);

  // moonlit lancet windows on the left wall + light shafts
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x0a0f18, emissive: 0x5c7cc0, emissiveIntensity: 0.55, roughness: 0.2 });
  const shafts: THREE.ShaderMaterial[] = [];
  if (opts.windows !== false) {
    const wShape = new THREE.Shape();
    const ww = 0.75, wb = 2.4, wt = 5.2;
    wShape.moveTo(-ww, wb);
    wShape.lineTo(ww, wb);
    wShape.lineTo(ww, wt - ww);
    wShape.quadraticCurveTo(ww, wt, 0, wt + 0.5);
    wShape.quadraticCurveTo(-ww, wt, -ww, wt - ww);
    wShape.lineTo(-ww, wb);
    const wGeo = new THREE.ShapeGeometry(wShape, 10);
    const mullion = new THREE.BoxGeometry(0.06, wt - wb + 0.4, 0.06);
    const transom = new THREE.BoxGeometry(ww * 2, 0.06, 0.06);
    for (let i = 0; i < bays - 1; i += 2) {
      const z = z0 - i * bay - bay / 2;
      const win = new THREE.Mesh(wGeo, windowMat);
      win.position.set(-W / 2 + 0.02, 0, z);
      win.rotation.y = Math.PI / 2;
      group.add(win);
      const mu = new THREE.Mesh(mullion, ironMat);
      mu.position.set(-W / 2 + 0.05, (wb + wt) / 2 + 0.2, z);
      const tr = new THREE.Mesh(transom, ironMat);
      tr.rotation.y = Math.PI / 2;
      tr.position.set(-W / 2 + 0.05, 3.9, z);
      group.add(mu, tr);
      // light shaft: a soft quad from the window down across the floor
      const shaftMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Color(0x7d9ad8) }, uOpacity: { value: 0.11 }, uTime: { value: 0 } },
        vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: /* glsl */ `
          ${GLSL_NOISE}
          uniform vec3 uColor; uniform float uOpacity, uTime; varying vec2 vUv; varying vec3 vW;
          void main(){
            float along = vUv.y;               // 1 at window → 0 at floor
            float across = sin(vUv.x * 3.14159);
            float dust = 0.75 + 0.5 * fbm(vW.xy * 1.5 + vec2(0.0, uTime * 0.1));
            float a = across * smoothstep(0.0, 0.35, along) * (0.4 + 0.6 * along) * dust;
            gl_FragColor = vec4(uColor, a * uOpacity);
          }`,
      });
      shafts.push(shaftMat);
      const g = new THREE.BufferGeometry();
      // quad: window bottom/top → floor near/far, uv.x across, uv.y along
      const wx = -W / 2 + 0.05;
      const verts = new Float32Array([
        wx, wb, 0, wx, wt, 0, -W / 2 + 2.6, 0, 0, W / 2 - 1.4, 0, 0,
      ]);
      g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]), 2));
      g.setIndex([0, 2, 1, 1, 2, 3]);
      for (const dz of [-0.45, 0.45]) {
        const shaft = new THREE.Mesh(g, shaftMat);
        shaft.position.z = z + dz;
        shaft.renderOrder = 3;
        group.add(shaft);
      }
    }
  }
  return { group, torchPositions, shafts, windowMat, width: W, wallH: WH };
}
