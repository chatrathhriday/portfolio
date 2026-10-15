/**
 * SCENE 1 — Platform 9¾ at night.
 * The camera drifts in over a wet platform toward the Hogwarts Express.
 * Punching the ticket sounds the whistle; the train pulls away and the camera
 * is swallowed by steam, which becomes the veil into the Black Lake.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { BaseScene } from '../BaseScene';
import type { SceneContext, Section } from '../../core/types';
import { buildTrain, type Train } from '../../world/train';
import { flagstones, stoneBlocks, smokePuff, textTexture, woodPlanks } from '../../core/textures';
import { DriftField, ParticlePool } from '../../fx/particles';
import { FlickerLight, FogLayer, makeSky } from '../../fx/atmosphere';
import { audio } from '../../core/audio';
import { settings, dur } from '../../core/settings';
import { ui } from '../../ui/ui';
import { showTicket, hideTicket } from '../../ui/ticket';

class StationScene extends BaseScene {
  readonly id = 'station' as const;
  private train!: Train;
  private steam: ParticlePool;
  private sparks: ParticlePool;
  private lamps: FlickerLight[] = [];
  private lookTarget = new THREE.Vector3(3, 2.6, 0);
  private camBase = new THREE.Vector3();
  private trainSpeed = 0;
  private trainDist = 0;
  private steamRate = 1;
  private departing = false;
  private idle = 0;
  private sky: ReturnType<typeof makeSky>;
  private fogs: FogLayer[] = [];
  private dust: DriftField;

  constructor(ctx: SceneContext) {
    super(ctx);
    const q = ctx.engine.quality;
    this.bloom = { strength: 0.9, radius: 0.65, threshold: 0.8 };
    this.exposure = 1.05;
    this.scene.fog = new THREE.FogExp2(0x0c1626, 0.02);
    this.scene.background = new THREE.Color(0x070c18);

    this.sky = makeSky({ top: 0x050a18, horizon: 0x1a2a44, moonDir: new THREE.Vector3(-0.35, 0.55, -0.75), stars: 1, clouds: 0.6 });
    this.scene.add(this.sky.mesh);

    // Lighting: cool moonlight + warm lanterns
    this.scene.add(new THREE.HemisphereLight(0x2a3b5c, 0x0a0806, 0.55));
    const moon = new THREE.DirectionalLight(0x9fb4e0, 0.7);
    moon.position.set(-30, 40, -25);
    this.scene.add(moon);

    this.buildGround();
    this.buildPlatform(q.maxLights);
    this.buildShed();

    this.train = buildTrain(3);
    this.scene.add(this.train.group);
    const windowGlow = new THREE.PointLight(0xffa850, 18, 16, 2);
    windowGlow.position.set(-14, 3, 2.5);
    this.scene.add(windowGlow);

    this.steam = new ParticlePool(Math.round(420 * Math.max(0.5, q.particles)), { texture: smokePuff(), additive: false, fadeIn: 0.12 });
    this.scene.add(this.steam.points);
    this.sparks = new ParticlePool(80);
    this.scene.add(this.sparks.points);
    this.steam.wind.set(0.25, 0.05, 0.15);

    this.dust = new DriftField({
      count: Math.round(500 * q.particles),
      box: new THREE.Vector3(40, 8, 14),
      center: new THREE.Vector3(-4, 4, 4),
      color: 0xffd9a0,
      size: 0.045,
      speed: 0.35,
      rise: 0.2,
      opacity: 0.8,
    });
    this.scene.add(this.dust);

    // Low fog over the tracks and in the distance
    const f1 = new FogLayer({ width: 160, depth: 30, color: 0x7f93b4, opacity: 0.24, scale: 0.06, speed: new THREE.Vector2(0.05, 0.01), nearFade: 6 });
    f1.position.set(0, 0.6, -6);
    const f2 = new FogLayer({ width: 160, depth: 40, color: 0x34445e, opacity: 0.22, scale: 0.04, vertical: true, speed: new THREE.Vector2(0.03, 0.0) });
    f2.position.set(0, 4, -22);
    const f3 = new FogLayer({ width: 160, depth: 12, color: 0x9aaccc, opacity: 0.18, scale: 0.08, speed: new THREE.Vector2(-0.04, 0.02), nearFade: 3 });
    f3.position.set(0, 1.4, 5);
    this.fogs.push(f1, f2, f3);
    this.scene.add(f1, f2, f3);

    this.camera.position.set(-18, 9, 22);
    this.camera.lookAt(this.lookTarget);
  }

  /* ── Construction ──────────────────────────────────────────────────── */

  private buildGround() {
    const ballast = stoneBlocks('ballast', { rows: 16, cols: 16, tint: [52, 50, 50], seed: 4, size: 256 });
    ballast.map.repeat.set(30, 4);
    ballast.normalMap.repeat.set(30, 4);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 60).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: ballast.map, normalMap: ballast.normalMap, roughness: 0.9, color: 0x777777 }),
    );
    ground.position.z = -10;
    this.scene.add(ground);
    // rails
    const railMat = new THREE.MeshStandardMaterial({ color: 0x8a8d94, roughness: 0.25, metalness: 0.95 });
    for (const z of [-0.72, 0.72, -5.28, -6.72]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(240, 0.14, 0.08), railMat);
      r.position.set(0, 0.2, z);
      this.scene.add(r);
    }
    // sleepers (instanced)
    const sleeperGeo = new THREE.BoxGeometry(0.28, 0.14, 2.5);
    const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.95 });
    const count = 2 * 200;
    const inst = new THREE.InstancedMesh(sleeperGeo, sleeperMat, count);
    const m = new THREE.Matrix4();
    let i = 0;
    for (const z of [0, -6]) for (let k = 0; k < 200; k++) inst.setMatrixAt(i++, m.makeTranslation(-120 + k * 1.2, 0.07, z));
    this.scene.add(inst);
  }

  private buildPlatform(maxLights: number) {
    const flags = flagstones(21);
    flags.map.repeat.set(30, 2);
    flags.normalMap.repeat.set(30, 2);
    // Wet stone: low roughness picks up lamp reflections.
    const top = new THREE.MeshStandardMaterial({ map: flags.map, normalMap: flags.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.3, metalness: 0.1, color: 0x9a9a9a });
    const side = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.8 });
    const plat = new THREE.Mesh(new THREE.BoxGeometry(160, 1.05, 8), [side, side, top, side, side, side]);
    plat.position.set(0, 0.525, 6);
    this.scene.add(plat);
    const coping = new THREE.Mesh(new THREE.BoxGeometry(160, 0.08, 0.4), new THREE.MeshStandardMaterial({ color: 0xb8ab88, roughness: 0.5 }));
    coping.position.set(0, 1.08, 2.2);
    this.scene.add(coping);

    // back wall with arched windows
    const brick = stoneBlocks('brick', { rows: 16, cols: 6, tint: [96, 58, 44], seed: 8 });
    brick.map.repeat.set(24, 2);
    brick.normalMap.repeat.set(24, 2);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(160, 9), new THREE.MeshStandardMaterial({ map: brick.map, normalMap: brick.normalMap, roughness: 0.85 }));
    wall.position.set(0, 5.5, 10);
    wall.rotation.y = Math.PI;
    this.scene.add(wall);
    const winMat = new THREE.MeshStandardMaterial({ color: 0x1a1208, emissive: 0xff9a40, emissiveIntensity: 0.55, roughness: 0.3 });
    const archShape = new THREE.Shape();
    archShape.moveTo(-0.8, 0);
    archShape.lineTo(-0.8, 2.2);
    archShape.absarc(0, 2.2, 0.8, Math.PI, 0, true);
    archShape.lineTo(0.8, 0);
    const archGeo = new THREE.ShapeGeometry(archShape, 12);
    for (let x = -44; x <= 44; x += 8) {
      const w = new THREE.Mesh(archGeo, winMat);
      w.position.set(x + 4, 3.0, 9.95);
      w.rotation.y = Math.PI;
      this.scene.add(w);
    }

    // cast-iron columns with lanterns
    const iron = new THREE.MeshStandardMaterial({ color: 0x1c2a26, roughness: 0.45, metalness: 0.7 });
    const glass = new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xffa040, emissiveIntensity: 4.5 });
    const lightXs = [-12, -4, 4, 12, -20, 20].slice(0, Math.max(2, maxLights - 2));
    for (let x = -44; x <= 44; x += 8) {
      const col = new THREE.Group();
      col.position.set(x, 1.05, 5.2);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.6, 12), iron);
      shaft.position.y = 2.8;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.6, 12), iron);
      base.position.y = 0.3;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.14, 0.4, 12), iron);
      cap.position.y = 5.7;
      col.add(shaft, base, cap);
      // bracket + lantern
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.9), iron);
      arm.position.set(0, 3.6, -0.45);
      const lantern = new THREE.Group();
      lantern.position.set(0, 3.2, -0.9);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.5, 6), glass);
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.24, 6), iron);
      hood.position.y = 0.36;
      lantern.add(body, hood);
      col.add(arm, lantern);
      this.scene.add(col);
      if (lightXs.includes(x)) {
        const l = new FlickerLight(0xffa54a, 9, 16, 1.8);
        l.position.set(x, 4.1, 4.2);
        this.scene.add(l);
        this.lamps.push(l);
      }
    }

    // signs
    const signTex = textTexture(
      [
        { text: 'PLATFORM', font: '600 54px Cinzel, Georgia, serif', color: '#f1e3c0', y: 62 },
        { text: '9¾', font: '700 120px Cinzel, Georgia, serif', color: '#f1e3c0', y: 160 },
      ],
      { w: 512, h: 240, bg: '#5a1212', border: '#d1b26a', borderWidth: 10 },
    );
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.12), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.25 }));
    sign.position.set(-2, 5.4, 5.05);
    this.scene.add(sign);
    for (const dx of [-1, 1]) {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1), iron);
      chain.position.set(-2 + dx * 1.0, 6.5, 5.05);
      this.scene.add(chain);
    }
    const destTex = textTexture(
      [
        { text: 'HOGWARTS EXPRESS', font: '600 46px Cinzel, Georgia, serif', color: '#e9d7a7', y: 46 },
        { text: '11 o’clock · King’s Cross → Hogsmeade', font: 'italic 28px Georgia, serif', color: '#c8b48a', y: 96 },
      ],
      { w: 640, h: 132, bg: '#121a24', border: '#9c8450', borderWidth: 6 },
    );
    const dest = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.74), new THREE.MeshStandardMaterial({ map: destTex, emissive: 0xffffff, emissiveMap: destTex, emissiveIntensity: 0.3 }));
    dest.position.set(9, 5.3, 5.05);
    this.scene.add(dest);

    // clock
    const clockTex = clockFace();
    const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.14, 32).rotateX(Math.PI / 2), [iron, new THREE.MeshStandardMaterial({ map: clockTex, emissive: 0xfff0d0, emissiveMap: clockTex, emissiveIntensity: 0.45 }), iron]);
    clock.position.set(4, 5.6, 4.9);
    this.scene.add(clock);

    // luggage, owl cage, bench
    const leather = woodPlanks([70, 40, 26], 12);
    const trunkMat = new THREE.MeshStandardMaterial({ map: leather.map, roughness: 0.6 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 0.9, roughness: 0.3 });
    const trunk = (x: number, z: number, y: number, s: number, r: number) => {
      const t = new THREE.Mesh(new THREE.BoxGeometry(1.0 * s, 0.6 * s, 0.6 * s), trunkMat);
      t.position.set(x, 1.05 + y + 0.3 * s, z);
      t.rotation.y = r;
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.02 * s, 0.06, 0.62 * s), brass);
      band.position.y = 0.12 * s;
      t.add(band);
      this.scene.add(t);
    };
    trunk(-6.5, 3.6, 0, 1, 0.2);
    trunk(-6.4, 3.6, 0.6, 0.85, -0.1);
    trunk(-5.4, 3.2, 0, 0.8, 0.5);
    trunk(7.5, 4.2, 0, 1.1, -0.3);
    const cage = new THREE.Group();
    cage.position.set(-6.4, 2.3, 3.6);
    const wire = new THREE.MeshStandardMaterial({ color: 0xb08a40, metalness: 0.9, roughness: 0.35, wireframe: true });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), wire);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.4, 10, 1, true), wire);
    dome.position.y = 0.4;
    cyl.position.y = 0.2;
    const owl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.9 }));
    owl.scale.set(1, 1.3, 1);
    owl.position.y = 0.2;
    cage.add(dome, cyl, owl);
    this.scene.add(cage);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.6), new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.7 }));
    bench.position.set(14, 1.6, 7.5);
    this.scene.add(bench);
  }

  private buildShed() {
    // Arched iron ribs of a Victorian train shed, open to the night sky.
    const iron = new THREE.MeshStandardMaterial({ color: 0x16201e, roughness: 0.5, metalness: 0.7 });
    const ribGeo = new THREE.TorusGeometry(11, 0.14, 6, 40, Math.PI);
    for (let x = -48; x <= 48; x += 8) {
      const rib = new THREE.Mesh(ribGeo, iron);
      rib.rotation.y = Math.PI / 2;
      rib.position.set(x, 5.5, 0);
      this.scene.add(rib);
    }
    const purlin = new THREE.BoxGeometry(100, 0.1, 0.1);
    for (let a = 0.25; a < Math.PI; a += 0.32) {
      const p = new THREE.Mesh(purlin, iron);
      p.position.set(0, 5.5 + Math.sin(a) * 11, Math.cos(a) * 11);
      this.scene.add(p);
    }
  }

  /* ── Lifecycle ─────────────────────────────────────────────────────── */

  enter(section?: Section) {
    audio.ambience('station');
    this.ctx.director.markVisited('station');
    const reduced = settings.get().reducedMotion;
    const end = new THREE.Vector3(-13.5, 2.5, 9.3);
    const look = new THREE.Vector3(2, 3.0, 0);
    if (section === 'station' || reduced) {
      this.camera.position.copy(end);
      this.lookTarget.copy(look);
      this.camBase.copy(end);
      this.ready();
      return;
    }
    const tl = gsap.timeline();
    const from = { t: 0 };
    const start = this.camera.position.clone();
    const startLook = new THREE.Vector3(-10, 4, 0);
    const curve = new THREE.CatmullRomCurve3([start, new THREE.Vector3(-20, 5.5, 15), new THREE.Vector3(-16, 3.2, 11), end]);
    tl.to(from, {
      t: 1,
      duration: 7.5,
      ease: 'power2.inOut',
      onUpdate: () => {
        curve.getPoint(from.t, this.camera.position);
        this.lookTarget.lerpVectors(startLook, look, Math.min(1, from.t * 1.3));
      },
    });
    tl.call(() => showTicketOnce(), [], 2.6);
    const showTicketOnce = () => {
      if (!this.ticketShown) this.ready();
    };
    this.playCinematic(tl, () => {
      this.camera.position.copy(end);
      this.lookTarget.copy(look);
      this.camBase.copy(end);
      if (!this.ticketShown) this.ready();
    });
    ui.hint(null);
  }

  private ticketShown = false;

  private ready() {
    this.ticketShown = true;
    if (!this.camBase.lengthSq()) this.camBase.copy(this.camera.position);
        showTicket(() => this.depart());
  }

  primary() {
    /* ticket handles its own key */
  }

  private depart() {
    if (this.departing) return;
    this.departing = true;
    this.cine?.kill();
    this.cine = null;
    this.camBase.copy(this.camera.position);
    ui.hint(null);
    audio.whistle();
    audio.steamBurst();
    // big burst from the chimney and cylinders
    for (let i = 0; i < 40; i++) this.emitSteam(1.6, true);
    const reduced = settings.get().reducedMotion;
    const tl = gsap.timeline();
    tl.call(() => audio.departure(), [], 0.9);
    tl.to(this, { trainSpeed: 18, duration: dur(6.5, 1.2), ease: 'power2.in' }, 0.9);
    tl.to(this, { steamRate: 3, duration: 1 }, 0.9);
    // camera turns to watch the train go, steps toward the edge, then the steam swallows it
    const camEnd = new THREE.Vector3(-1.5, 2.4, 4.4);
    tl.to(this.camBase, { x: camEnd.x, y: camEnd.y, z: camEnd.z, duration: dur(5.5, 1), ease: 'power1.inOut' }, 0.6);
    tl.to(this.lookTarget, { x: 30, y: 3, z: -1, duration: dur(5.5, 1), ease: 'power1.inOut' }, 0.6);
    tl.call(() => this.engulf(), [], reduced ? 1.4 : 4.8);
    tl.to({}, { duration: reduced ? 0.4 : 1.3 });
    this.playCinematic(tl, () => {
      hideTicket(true);
      this.ctx.director.next('steam');
    });
  }

  /** Fill the view with steam just before the veil. */
  private engulf() {
    const p = this.camera.position;
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    for (let i = 0; i < 60; i++) {
      this.steam.emit({
        position: p.clone().addScaledVector(fwd, 2 + Math.random() * 6).add(new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 4)),
        velocity: new THREE.Vector3(0.5, 0.3, 0),
        spread: 0.6,
        life: [2.5, 4],
        size: [3, 9],
        color: 0xc8d2e2,
        color2: 0xffe0b8,
        alpha: 0.5,
        drag: 0.6,
      });
    }
  }

  private emitSteam(scale = 1, burst = false) {
    const top = this.train.chimneyTop.getWorldPosition(new THREE.Vector3());
    this.steam.emit({
      position: top,
      velocity: new THREE.Vector3(-this.trainSpeed * 0.3, 2.4 * scale + Math.random(), 0),
      spread: 0.5 * scale,
      posJitter: 0.3,
      life: [2.5, 4.5],
      size: [0.8 * scale, 5.5 * scale],
      color: 0xb9c3d4,
      color2: 0xe8d4b8,
      alpha: burst ? 0.55 : 0.4,
      drag: 0.4,
      gravity: -0.25,
    });
    if (burst || Math.random() < 0.35) {
      for (const v of this.train.cylinderVents) {
        const vp = v.getWorldPosition(new THREE.Vector3());
        this.steam.emit({
          position: vp,
          velocity: new THREE.Vector3(0.6 - this.trainSpeed * 0.2, 0.1, Math.sign(vp.z) * (1.2 + Math.random())),
          spread: 0.4,
          life: [1.5, 3],
          size: [0.5, burst ? 4 : 2.6],
          color: 0xd6deea,
          alpha: burst ? 0.5 : 0.28,
          drag: 0.9,
          gravity: -0.15,
        });
      }
    }
  }

  private steamAcc = 0;

  update(dt: number, t: number) {
    super.update(dt, t);
    this.idle += dt;
    this.sky.update(t);
    for (const f of this.fogs) f.update(t);
    this.dust.update(t);
    for (const l of this.lamps) l.update(t);

    // train motion
    if (this.trainSpeed > 0) {
      const d = this.trainSpeed * dt;
      this.trainDist += d;
      this.train.group.position.x += d;
      for (const w of this.train.wheels) w.rotation.z -= d / (w.userData.r as number);
      const ang = -this.trainDist / 0.92;
      for (const r of this.train.rods) {
        r.position.x = (r.userData.baseX as number) + Math.cos(ang) * 0.32;
        r.position.y = (r.userData.baseY as number) + Math.sin(ang) * 0.32;
      }
    }
    // steam: idle puffs, faster once departing (chuffs)
    this.steamAcc += dt * this.steamRate * (settings.get().reducedMotion ? 0.5 : 1);
    const interval = this.departing ? Math.max(0.05, 0.5 - this.trainSpeed * 0.025) : 0.45;
    while (this.steamAcc > interval) {
      this.steamAcc -= interval;
      this.emitSteam(this.departing ? 1.2 : 0.8);
    }
    this.steam.update(dt);
    this.sparks.update(dt);

    // camera: gentle breathing drift when idle
    if (!this.cine || this.departing) {
      const sway = settings.get().reducedMotion ? 0 : 1;
      this.camera.position.set(
        this.camBase.x + Math.sin(this.idle * 0.21) * 0.25 * sway,
        this.camBase.y + Math.sin(this.idle * 0.33) * 0.06 * sway,
        this.camBase.z + Math.cos(this.idle * 0.17) * 0.18 * sway,
      );
      // parallax toward the pointer
      const p = this.ctx.engine.pointer;
      this.camera.position.x += p.x * 0.35 * sway;
      this.camera.position.y += p.y * 0.15 * sway;
    }
    this.camera.lookAt(this.lookTarget);
  }

  dispose() {
    hideTicket(true);
    ui.hint(null);
    this.steam.dispose();
    this.sparks.dispose();
    super.dispose();
  }
}

function clockFace() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#efe4c8';
  g.beginPath();
  g.arc(128, 128, 124, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#2a2016';
  g.lineWidth = 4;
  g.stroke();
  g.fillStyle = '#2a2016';
  g.font = '600 26px Cinzel, Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const numerals = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  numerals.forEach((n, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    g.fillText(n, 128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96);
  });
  // 10:58 — two minutes to departure
  const hand = (a: number, len: number, w: number) => {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(128, 128);
    g.lineTo(128 + Math.cos(a) * len, 128 + Math.sin(a) * len);
    g.stroke();
  };
  hand(((10 + 58 / 60) / 12) * Math.PI * 2 - Math.PI / 2, 55, 7);
  hand((58 / 60) * Math.PI * 2 - Math.PI / 2, 85, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default (ctx: SceneContext) => new StationScene(ctx);
