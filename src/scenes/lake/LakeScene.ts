/**
 * SCENE 2 — The first-year boat ride across the Black Lake.
 * The camera rides in the stern of a lantern-lit boat. Mirror water reflects
 * the moon and the castle's windows; mist slides past; the castle grows until
 * the boats slip under the cliff into the dark boathouse arch.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { BaseScene } from '../BaseScene';
import type { SceneContext, Section } from '../../core/types';
import { buildCastle, type Castle } from '../../world/castle';
import { buildBoat, type Boat } from '../../world/boat';
import { waterNormals } from '../../core/textures';
import { DriftField } from '../../fx/particles';
import { FogLayer, makeSky } from '../../fx/atmosphere';
import { audio } from '../../core/audio';
import { settings } from '../../core/settings';
import { ui } from '../../ui/ui';
import { isTouch } from '../../core/quality';
import { environment, model, pbr, sky as loadSky, type PbrMaps } from '../../core/assets';
import type { CastleTextures } from '../../world/castle';
import { portfolio } from '../../content/portfolio';

const CASTLE_Z = -340;
const RIDE_SECONDS = 30;
/** Rotates the photographic sky so its moon sits beside the castle. */
const SKY_ROT = 0;

interface LakeAssets {
  castle: CastleTextures;
  wood: PbrMaps;
  sky: THREE.Texture | null;
  env: THREE.Texture | null;
  lantern: THREE.Group | null;
  lanterns: (THREE.Group | null)[];
}

class LakeScene extends BaseScene {
  readonly id = 'lake' as const;
  private water: Water;
  private castle: Castle;
  private boat: Boat;
  private others: { boat: Boat; offset: THREE.Vector3; phase: number }[] = [];
  private path: THREE.CatmullRomCurve3;
  private progress = 0; // 0..1 along the path
  private speed = 1; // multiplier (hold to hurry)
  private targetSpeed = 1;
  private riding = false;
  private arrived = false;
  private sky: ReturnType<typeof makeSky>;
  private mists: FogLayer[] = [];
  private motes: DriftField;
  private moonDir = new THREE.Vector3(0.28, 0.34, -1).normalize();
  private t = 0;
  private lookAt = new THREE.Vector3();

  private captionIdx = 0;

  constructor(ctx: SceneContext, a: LakeAssets) {
    super(ctx);
    const q = ctx.engine.quality;
    this.baseFov = 55;
    this.bloom = { strength: 0.95, radius: 0.7, threshold: 0.7 };
    this.exposure = 0.9;
    this.scene.fog = new THREE.FogExp2(0x081222, 0.0036);
    this.scene.background = new THREE.Color(0x050a16);

    this.sky = makeSky({ top: 0x02060f, horizon: 0x101d33, moonDir: this.moonDir, moonColor: 0xe6eeff, stars: 1.2, clouds: 0.55, radius: 1500 });
    if (a.sky) {
      // photographic moonlit sky; the procedural sky stays as the fallback
      this.scene.background = a.sky;
      this.scene.backgroundIntensity = 0.3;
      this.scene.backgroundRotation.set(0, SKY_ROT, 0);
    } else this.scene.add(this.sky.mesh);
    if (a.env) {
      this.scene.environment = a.env;
      this.scene.environmentIntensity = 0.35;
      this.scene.environmentRotation.set(0, SKY_ROT, 0);
    }
    this.scene.add(new THREE.HemisphereLight(0x3a5280, 0x05070c, 0.5));
    const moon = new THREE.DirectionalLight(0xb4c6ee, 1.1);
    moon.position.copy(this.moonDir).multiplyScalar(300);
    this.scene.add(moon);

    // Water — real planar reflection, resolution scaled by quality tier
    this.water = new Water(new THREE.PlaneGeometry(3000, 3000), {
      textureWidth: q.reflectionSize,
      textureHeight: q.reflectionSize,
      waterNormals: waterNormals(),
      sunDirection: this.moonDir.clone(),
      sunColor: 0x5a6a90,
      waterColor: 0x0a1c3c,
      distortionScale: 1.3,
      fog: true,
      alpha: 1,
    });
    this.water.rotation.x = -Math.PI / 2;
    // Painted look: deeper, darker water with a soft moon glint instead of a hard hotspot.
    const wm = this.water.material as THREE.ShaderMaterial;
    wm.fragmentShader = wm.fragmentShader
      .replace('reflectionSample * 0.9 + reflectionSample * specularLight', 'reflectionSample * 0.5 + reflectionSample * specularLight * 0.25')
      .replace('vec3( 0.1 )', 'vec3( 0.02, 0.04, 0.09 )');
    (this.water.material as THREE.ShaderMaterial).uniforms.size.value = 1.4; // broad, calm ripples
    this.scene.add(this.water);

    // Castle on the far shore
    this.castle = buildCastle(a.castle);
    this.castle.group.position.set(0, 0, CASTLE_Z);
    this.scene.add(this.castle.group);

    // Distant mountains: two smooth, layered ridgelines around the lake
    for (const [r, hMax, col, seed] of [[470, 70, 0x0a0f18, 1.3], [640, 120, 0x0d1420, 4.1]] as const) {
      this.scene.add(ridge(r, hMax, col, seed, a.castle.rock));
    }

    // Path across the lake toward the boathouse arch
    const entrance = this.castle.entrance.clone().add(this.castle.group.position);
    this.path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(30, 0, 120),
      new THREE.Vector3(18, 0, 40),
      new THREE.Vector3(-8, 0, -60),
      new THREE.Vector3(-6, 0, -170),
      new THREE.Vector3(0, 0, entrance.z + 70),
      new THREE.Vector3(0, 0, entrance.z + 4),
    ]);

    // Our boat + the fleet of first-years
    this.boat = buildBoat({ withLight: true, wood: a.wood, lanternModel: a.lantern });
    this.scene.add(this.boat.group);
    const fleet = [new THREE.Vector3(-6, 0, -6), new THREE.Vector3(7, 0, -11), new THREE.Vector3(-11, 0, 9), new THREE.Vector3(12, 0, 6), new THREE.Vector3(2, 0, -20), new THREE.Vector3(-16, 0, -18)];
    for (const off of fleet.slice(0, q.tier === 'low' ? 4 : 6)) {
      const b = buildBoat({ wood: a.wood, lanternModel: a.lanterns[this.others.length] ?? null });
      this.scene.add(b.group);
      this.others.push({ boat: b, offset: off, phase: Math.random() * 10 });
    }

    // Mist banks: low layers and a few vertical veils
    const mk = (y: number, z: number, o: number, s: number) => {
      const f = new FogLayer({ width: 600, depth: 300, color: 0x5a6d90, opacity: o, scale: s, speed: new THREE.Vector2(0.04, 0.012), nearFade: 10 });
      f.position.set(0, y, z);
      this.mists.push(f);
      this.scene.add(f);
    };
    mk(1.6, -60, 0.16, 0.02);
    mk(4, -220, 0.14, 0.015);
    mk(8, -300, 0.12, 0.012);
    const veil = new FogLayer({ width: 700, depth: 60, color: 0x3e4f6e, opacity: 0.14, scale: 0.012, vertical: true, nearFade: 30 });
    veil.position.set(0, 18, CASTLE_Z + 90);
    this.mists.push(veil);
    this.scene.add(veil);

    // Floating golden motes around the boats
    this.motes = new DriftField({ count: Math.round(260 * q.particles), box: new THREE.Vector3(60, 14, 60), center: new THREE.Vector3(), color: 0xffd68a, size: 0.12, speed: 0.4, rise: 0.4, twinkle: 0.9 });
    this.scene.add(this.motes);

    this.placeBoat(0);
    this.camera.position.set(0, 1.3, 1);
  }

  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();

  private placeBoat(p: number) {
    const reduced = settings.get().reducedMotion;
    const pos = this.path.getPointAt(Math.min(1, p), this.tmp);
    const ahead = this.path.getPointAt(Math.min(1, p + 0.01), this.tmp2);
    const g = this.boat.group;
    g.position.copy(pos);
    g.lookAt(ahead.x, pos.y, ahead.z);
    g.rotateY(Math.PI); // model bow is -Z; lookAt points +Z toward target
    const bob = reduced ? 0 : 1;
    g.position.y = 0.05 + Math.sin(this.t * 1.3) * 0.06 * bob;
    g.rotation.z += Math.sin(this.t * 0.9) * 0.025 * bob;
    g.rotateX(Math.sin(this.t * 1.1 + 1) * 0.015 * bob);

    // camera seated in the stern, slightly above the gunwale
    const camLocal = new THREE.Vector3(0.0, 1.45, 1.35);
    this.camera.position.copy(camLocal.applyMatrix4(g.matrixWorld.compose(g.position, g.quaternion, g.scale)));
    // look ahead along the water, tilting up toward the castle near the end
    const castleFocus = this.castle.focus.clone().add(this.castle.group.position);
    const along = this.path.getPointAt(Math.min(1, p + 0.08), new THREE.Vector3()).setY(3);
    const k = THREE.MathUtils.smoothstep(p, 0.15, 0.85);
    this.lookAt.lerpVectors(along, castleFocus, k * 0.85);
    if (p > 0.9) this.lookAt.lerp(this.path.getPointAt(1, new THREE.Vector3()).setY(4), (p - 0.9) * 10);
    const pt = this.ctx.engine.pointer;
    this.lookAt.x += pt.x * 8 * bob;
    this.lookAt.y += pt.y * 4 * bob;
    this.camera.lookAt(this.lookAt);
    this.camera.rotation.z += Math.sin(this.t * 0.9) * 0.01 * bob;

    // fleet keeps formation with a little drift
    for (const o of this.others) {
      const b = o.boat.group;
      const q = Math.max(0, Math.min(1, p + o.offset.z * -0.0008));
      const bp = this.path.getPointAt(q, new THREE.Vector3());
      const bah = this.path.getPointAt(Math.min(1, q + 0.01), new THREE.Vector3());
      b.position.set(bp.x + o.offset.x + Math.sin(this.t * 0.2 + o.phase) * 0.8, 0.05 + Math.sin(this.t * 1.2 + o.phase) * 0.06 * bob, bp.z + o.offset.z);
      b.lookAt(bah.x + o.offset.x, b.position.y, bah.z + o.offset.z);
      b.rotateY(Math.PI);
      b.rotation.z += Math.sin(this.t + o.phase) * 0.03 * bob;
    }
  }

  enter(_section?: Section) {
    audio.ambience('lake');
    this.ctx.director.markVisited('lake');
    this.progress = 0;
    this.riding = true;
    ui.hint(isTouch ? 'Press and hold anywhere to row faster' : 'Hold the mouse button or Shift to row faster');
    const off = gsap.delayedCall(6, () => ui.hint(null));
    this.track(off);
    ui.setSkippable(true, () => this.arrive(true), 'Skip to the castle');
    const down = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== 'Shift') return;
      if (e instanceof PointerEvent && (e.target as HTMLElement).closest('button, a, .panel, .spellbook')) return;
      this.targetSpeed = 3.2;
    };
    const up = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== 'Shift') return;
      this.targetSpeed = 1;
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    this.onDispose(() => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    });
  }

  get cinematic() {
    return this.riding;
  }

  skip() {
    this.arrive(true);
  }

  private arrive(skipped: boolean) {
    if (this.arrived) return;
    this.arrived = true;
    this.riding = !skipped;
    ui.setSkippable(false);
    ui.hint(null);
    ui.clearCaptions();
    this.ctx.director.next('dark');
  }

  update(dt: number, t: number) {
    super.update(dt, t);
    this.t = t;
    this.speed += (this.targetSpeed - this.speed) * Math.min(1, dt * 2.5);
    if (this.riding) {
      const reduced = settings.get().reducedMotion;
      const base = 1 / (reduced ? RIDE_SECONDS * 0.6 : RIDE_SECONDS);
      // ease in at the start, slow down gently near the arch
      const ease = Math.min(1, 0.35 + this.progress * 6) * (this.progress > 0.92 ? 0.6 : 1);
      this.progress = Math.min(1, this.progress + dt * base * this.speed * ease);
      const caps = portfolio.lakeCaptions;
      while (this.captionIdx < caps.length && this.progress >= caps[this.captionIdx].at) {
        ui.caption(caps[this.captionIdx], 4300);
        this.captionIdx++;
      }
      if (this.progress >= 1) this.arrive(false);
      if (this.progress > 0.965 && !this.arrived) this.arrive(false);
    }
    this.placeBoat(this.progress);
    (this.water.material as THREE.ShaderMaterial).uniforms.time.value += dt * 0.35;
    this.sky.update(t);
    for (const m of this.mists) m.update(t);
    this.motes.update(t);
    this.motes.follow(this.camera.position);
    // windows breathe very slightly
    const flick = 4.2 + Math.sin(t * 0.7) * 0.25;
    for (const m of this.castle.windowMats) m.emissiveIntensity = flick;
  }

  dispose() {
    ui.hint(null);
    this.water.material.dispose();
    super.dispose();
  }
}

/** A ring of mountains whose height varies smoothly with angle (layered sines). */
function ridge(radius: number, hMax: number, color: number, seed: number, rock: PbrMaps) {
  const seg = 256;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const centre = new THREE.Vector3(0, 0, -200);
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const n =
      0.5 +
      0.28 * Math.sin(a * 3 + seed) +
      0.14 * Math.sin(a * 7.3 + seed * 2.1) +
      0.07 * Math.sin(a * 17.1 + seed * 0.7) +
      0.03 * Math.sin(a * 41 + seed);
    // keep a lower saddle behind the castle so it stands proud of the skyline
    const behindCastle = Math.exp(-Math.pow(((a - Math.PI + 2 * Math.PI) % (2 * Math.PI)) - Math.PI, 2) * 6);
    const h = Math.max(8, hMax * n * (1 - behindCastle * 0.55));
    const x = centre.x + Math.sin(a) * radius, z = centre.z + Math.cos(a) * radius;
    pos.push(x, -12, z, x, h, z);
    uv.push((i / seg) * 40, 0, (i / seg) * 40, h / 30);
  }
  for (let i = 0; i < seg; i++) {
    const k = i * 2;
    idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide, map: rock.map, normalMap: rock.normalMap });
  return new THREE.Mesh(g, m);
}

export default async (ctx: SceneContext) => {
  const [wall, roof, rock, wood, skyTex, env, lantern, ...lanterns] = await Promise.all([
    pbr('castle_wall_slates'),
    pbr('roof_slates_02'),
    pbr('rock_face_03'),
    pbr('weathered_planks'),
    loadSky('qwantani_moonrise_puresky'),
    environment('qwantani_moonrise_puresky', ctx.engine.renderer),
    model('wooden_lantern_01'),
    ...Array.from({ length: 6 }, () => model('wooden_lantern_01')),
  ]);
  return new LakeScene(ctx, { castle: { wall, roof, rock }, wood, sky: skyTex, env, lantern, lanterns });
};
