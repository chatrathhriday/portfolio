/**
 * Loads the CC0 Poly Haven assets in public/assets (see scripts/fetch-assets.mjs).
 * Every loader resolves — on failure it logs a warning and returns a fallback,
 * so a missing file degrades the look instead of breaking the journey.
 */
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { stoneBlocks } from './textures';

const BASE = './assets/';
const texLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const rgbeLoader = new RGBELoader();

const texCache = new Map<string, Promise<THREE.Texture | null>>();
function loadTex(url: string, srgb: boolean): Promise<THREE.Texture | null> {
  const key = url + srgb;
  let p = texCache.get(key);
  if (!p) {
    p = texLoader.loadAsync(url).then(
      (t) => {
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = 8;
        return t;
      },
      (e) => {
        console.warn('[assets] texture failed', url, e);
        return null;
      },
    );
    texCache.set(key, p);
  }
  return p;
}

export interface PbrMaps {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  /** Packed AO (R) / roughness (G) / metalness (B). Missing in fallback. */
  arm: THREE.Texture | null;
}

/** A PBR texture set. `repeat` is applied to clones so sets can be shared. */
export async function pbr(id: string): Promise<PbrMaps> {
  const [map, normalMap, arm] = await Promise.all([
    loadTex(`${BASE}tex/${id}/diff.webp`, true),
    loadTex(`${BASE}tex/${id}/nor.webp`, false),
    loadTex(`${BASE}tex/${id}/arm.webp`, false),
  ]);
  if (map && normalMap) return { map, normalMap, arm };
  const f = stoneBlocks('fallback-' + id, { seed: id.length * 7 });
  return { map: f.map, normalMap: f.normalMap, arm: null };
}

/** Build a MeshStandardMaterial from a PBR set with a given tiling. */
export function pbrMaterial(set: PbrMaps, repeat: [number, number], params: THREE.MeshStandardMaterialParameters = {}) {
  const r = (t: THREE.Texture) => {
    const c = t.clone();
    c.repeat.set(repeat[0], repeat[1]);
    c.needsUpdate = true;
    return c;
  };
  const m = new THREE.MeshStandardMaterial({
    map: r(set.map),
    normalMap: r(set.normalMap),
    roughness: 1,
    metalness: 0,
    ...params,
  });
  if (set.arm) {
    const arm = r(set.arm);
    m.aoMap = arm;
    m.roughnessMap = arm;
    m.aoMapIntensity = 1;
  } else {
    m.roughness = params.roughness ?? 0.85;
  }
  return m;
}

/** Image-based lighting from an HDRI (prefiltered for PBR). */
export async function environment(id: string, renderer: THREE.WebGLRenderer): Promise<THREE.Texture | null> {
  try {
    const hdr = await rgbeLoader.loadAsync(`${BASE}hdri/${id}.hdr`);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pm = new THREE.PMREMGenerator(renderer);
    const env = pm.fromEquirectangular(hdr).texture;
    hdr.dispose();
    pm.dispose();
    return env;
  } catch (e) {
    console.warn('[assets] hdri failed', id, e);
    return null;
  }
}

/** Photographic equirectangular sky for scene.background. */
export async function sky(id: string): Promise<THREE.Texture | null> {
  const t = await loadTex(`${BASE}sky/${id}.webp`, true);
  if (t) {
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
  }
  return t;
}

const modelCache = new Map<string, Promise<THREE.Group | null>>();
/** A prop model; each call returns a fresh clone sharing geometry/materials. */
export async function model(id: string): Promise<THREE.Group | null> {
  let p = modelCache.get(id);
  if (!p) {
    p = gltfLoader.loadAsync(`${BASE}models/${id}.glb`).then(
      (g) => g.scene,
      (e) => {
        console.warn('[assets] model failed', id, e);
        return null;
      },
    );
    modelCache.set(id, p);
  }
  const src = await p;
  return src ? (src.clone(true) as THREE.Group) : null;
}

/** Fit a model to a target height and return it (centred on x/z, resting on y=0). */
export function fitHeight(obj: THREE.Object3D, height: number) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const s = height / (size.y || 1);
  obj.scale.multiplyScalar(s);
  const box2 = new THREE.Box3().setFromObject(obj);
  const c = box2.getCenter(new THREE.Vector3());
  obj.position.sub(new THREE.Vector3(c.x, box2.min.y, c.z));
  const wrap = new THREE.Group();
  wrap.add(obj);
  return wrap;
}

/** First mesh's geometry+material in a model — for InstancedMesh reuse. */
export function firstMesh(obj: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  obj.traverse((o) => {
    if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh;
  });
  return found;
}
