/**
 * SCENE 3 — The Great Hall. The visitor walks in through the great doors and
 * stays in the hall; four spells are cast one after another, each changing
 * the whole room:
 *   LUMOS            — a light rises from the wand and bursts; a wave of flame
 *                      ignites hundreds of floating candles and the clouds part.  → About
 *   ACCIO            — three artefacts stream down from the rose window and
 *                      hover in the aisle; each can be inspected.                  → Projects
 *   EXPECTO PATRONUM — silver light gathers into a stag that gallops the length
 *                      of the hall and turns to face you.                          → Aspirations
 *   LUMOS MAXIMA     — a column of light to the enchanted ceiling; stars blaze,
 *                      and a sealed letter floats down and opens.                  → Contact
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { BaseScene } from '../BaseScene';
import type { SceneContext, Section } from '../../core/types';
import { buildGreatHall, HALL, type GreatHall, type HallAssets } from '../../world/greatHall';
import { buildDoor, type Door } from '../../world/door';
import { buildArtefact, type Artefact } from '../../world/artefacts';
import { buildLetter, type Letter } from '../../world/letter';
import { Stag } from '../../world/stag';
import { Wand } from '../../fx/wand';
import { CameraRig } from '../../fx/cameraRig';
import { DriftField, ParticlePool } from '../../fx/particles';
import { FlickerLight, makeSky } from '../../fx/atmosphere';
import { parchment, softDot } from '../../core/textures';
import { environment, model, pbr, pbrMaterial, type PbrMaps } from '../../core/assets';
import { audio } from '../../core/audio';
import { settings, dur } from '../../core/settings';
import { isMobile } from '../../core/quality';
import { ui, onArrow, $ } from '../../ui/ui';
import { aboutBody, aspirationsBody, contactBody, projectBody } from '../../ui/content';
import { portfolio } from '../../content/portfolio';
import { icons } from '../../ui/icons';

const EYE = 1.75;
const HOME = new THREE.Vector3(0, EYE, -4);
const HOME_LOOK = new THREE.Vector3(0, 3.4, -40);
/** The entrance hall floor sits this far below the Great Hall. */
const STAIR_DROP = -3.5;
const ENTRY = new THREE.Vector3(0, STAIR_DROP + EYE, 25);
/** Where the Patronus comes to rest: three-quarter view, left of the panel. */
const STAG_REST = new THREE.Vector3(-2.1, 0, -17.5);
const STAG_FACING = -0.72;

const portrait = () => window.innerHeight > window.innerWidth || isMobile;

class GreatHallScene extends BaseScene {
  readonly id = 'hall' as const;
  private hall: GreatHall;
  private rig: CameraRig;
  private wand: Wand;
  private door: Door;
  private sky: ReturnType<typeof makeSky>;
  private hemi: THREE.HemisphereLight;
  private sconceLights: FlickerLight[] = [];
  private headLight: THREE.PointLight;
  private magicLight: THREE.PointLight;
  private sparks: ParticlePool;
  private motes: DriftField;
  private orb: THREE.Sprite;
  private beam: THREE.Mesh;
  private aboutScroll: THREE.Group;
  private aboutMat: THREE.MeshStandardMaterial;
  private artefacts: Artefact[] = [];
  private labelsEl: HTMLElement;
  private labelBtns: HTMLButtonElement[] = [];
  private stag: Stag;
  private letter: Letter;
  private raycaster = new THREE.Raycaster();

  // state
  private lit = false;
  private summoned = false;
  private artefactsDown = false;
  private patronusDone = false;
  private maximaDone = false;
  private busy = false;
  private pendingCast: (() => void) | null = null;
  private inspecting: Artefact | null = null;
  private hovered: Artefact | null = null;
  private flying = new Set<Artefact>();
  private igniteR = -1; // radius of the Lumos ignition wave (−1 = idle)
  private igniteCentre = new THREE.Vector3();
  private candleLit: Float32Array;
  private tableLit: Float32Array;
  private stagFollow = false;

  constructor(ctx: SceneContext, a: HallAssets & { env: THREE.Texture | null; blocks: PbrMaps }) {
    super(ctx);
    const q = ctx.engine.quality;
    this.baseFov = 56;
    this.bloom = { strength: 0.8, radius: 0.55, threshold: 0.82 };
    this.exposure = 0.85;
    this.scene.background = new THREE.Color(0x03050b);
    this.scene.fog = new THREE.FogExp2(0x07080d, 0.016);
    if (a.env) {
      this.scene.environment = a.env;
      this.scene.environmentIntensity = 0.12;
    }

    // enchanted ceiling = the real sky, starting overcast
    this.sky = makeSky({ top: 0x050a1c, horizon: 0x141c30, moonDir: new THREE.Vector3(-0.4, 0.75, -0.5), stars: 0.35, clouds: 0.95 });
    this.scene.add(this.sky.mesh);

    this.hall = buildGreatHall(a, q);
    this.scene.add(this.hall.group);
    this.scene.add(this.hall.candles.flames, this.hall.tableFlames, this.hall.sconceFlames);
    this.hall.sconceFlames.setAll(1);
    this.candleLit = new Float32Array(this.hall.candles.pos.length);
    this.tableLit = new Float32Array(this.hall.tableFlames.count);

    // entrance vestibule beyond the great doors
    this.buildVestibule(a.blocks);
    this.door = buildDoor();
    this.door.ring.visible = false;
    this.door.leak.visible = false; // the hall itself is what lies beyond
    this.door.group.position.set(0, 0, HALL.FRONT_Z + 0.4);
    this.door.group.scale.setScalar(1.0);
    this.scene.add(this.door.group);

    // lights (fixed count so shaders never recompile mid-scene)
    this.hemi = new THREE.HemisphereLight(0x8a7a6a, 0x120c08, 0.1);
    this.scene.add(this.hemi);
    const moon = new THREE.DirectionalLight(0x8ea6dc, 0.35);
    moon.position.set(-40, 50, -10);
    moon.target.position.set(0, 0, -26);
    if (ctx.engine.renderer.shadowMap.enabled && q.tier === 'high') {
      moon.castShadow = true;
      moon.shadow.mapSize.set(2048, 2048);
      const sc = moon.shadow.camera;
      sc.left = -30;
      sc.right = 30;
      sc.top = 40;
      sc.bottom = -40;
      sc.far = 140;
      moon.shadow.bias = -0.0004;
      moon.shadow.normalBias = 0.04;
    }
    this.scene.add(moon, moon.target);
    for (const x of [-10.4, 10.4]) {
      const l = new FlickerLight(0xff9a48, 5, 26, 1.6);
      l.position.set(x, 6.4, -14);
      this.scene.add(l);
      this.sconceLights.push(l);
    }
    if (q.tier !== 'low') {
      const v = new FlickerLight(0xff9a48, 30, 16, 1.6);
      v.position.set(0, 3.5, HALL.FRONT_Z + 8);
      this.scene.add(v);
      this.sconceLights.push(v);
    }
    this.headLight = new THREE.PointLight(0xffc27a, 0, 30, 1.5);
    this.headLight.position.set(0, 6, HALL.DAIS_Z + 2);
    this.scene.add(this.headLight);
    this.magicLight = new THREE.PointLight(0xffe2b0, 0, 24, 1.4);
    this.scene.add(this.magicLight);

    this.sparks = new ParticlePool(Math.round(1400 * Math.max(0.5, q.particles)));
    this.scene.add(this.sparks.points);
    this.motes = new DriftField({ count: Math.round(600 * q.particles), box: new THREE.Vector3(22, 12, 40), center: new THREE.Vector3(0, 6, -20), color: 0xffd9a8, size: 0.04, speed: 0.25, rise: 0.25, opacity: 0.25 });
    this.scene.add(this.motes);

    this.orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xfff1d6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.orb.scale.setScalar(1.2);
    this.scene.add(this.orb);

    const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, map: beamTexture() });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.6, 1, 24, 1, true).translate(0, 0.5, 0), beamMat);
    this.beam.visible = false;
    this.scene.add(this.beam);

    const scroll = this.buildAboutScroll();
    this.aboutScroll = scroll.group;
    this.aboutMat = scroll.mat;
    this.scene.add(this.aboutScroll);

    for (const p of portfolio.projects) {
      const art = buildArtefact(p);
      art.group.visible = false;
      this.scene.add(art.group);
      this.artefacts.push(art);
    }

    this.stag = new Stag(Math.round(6500 * Math.max(0.35, q.particles)), softDot());
    this.stag.group.visible = false;
    this.stag.group.scale.setScalar(1.35);
    this.scene.add(this.stag.group);

    this.letter = buildLetter();
    this.letter.group.visible = false;
    this.scene.add(this.letter.group);

    this.wand = new Wand(this.camera);
    this.rig = new CameraRig(this.camera);
    this.rig.snap(ENTRY, new THREE.Vector3(0, 2.6, 0));

    // project labels (attached to the DOM on enter)
    this.labelsEl = $(`<div class="artefact-labels" aria-label="Summoned projects"></div>`);
    this.artefacts.forEach((art, i) => {
      const b = $<HTMLButtonElement>(`<button type="button" class="artefact-label">${art.project.name}<small>${art.project.tagline}</small></button>`);
      b.addEventListener('click', () => {
        audio.ui();
        this.inspect(i);
      });
      b.addEventListener('pointerenter', () => (this.hovered = art));
      b.addEventListener('pointerleave', () => (this.hovered = null));
      b.tabIndex = -1;
      this.labelsEl.append(b);
      this.labelBtns.push(b);
    });

    const canvas = ctx.engine.canvas;
    const onMove = (e: PointerEvent) => {
      if (!this.artefactsDown || this.inspecting) return;
      const hit = this.pick(e);
      this.hovered = hit;
      canvas.style.cursor = hit ? 'pointer' : '';
    };
    const onClick = (e: MouseEvent) => {
      if (!this.artefactsDown || this.busy) return;
      const hit = this.pick(e);
      if (hit && hit !== this.inspecting) this.inspect(this.artefacts.indexOf(hit));
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('click', onClick);
    const offArrow = onArrow((d) => {
      if (this.inspecting) this.inspect((this.artefacts.indexOf(this.inspecting) + d + this.artefacts.length) % this.artefacts.length);
    });
    this.onDispose(() => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('click', onClick);
      canvas.style.cursor = '';
      offArrow();
      this.labelsEl.remove();
      ui.clearCaptions();
      this.wand.dispose();
      this.sparks.dispose();
      this.stag.dispose();
    });
  }

  /* ── construction ─────────────────────────────────────────────────── */

  /** Entrance hall: a lower floor, a broad flight of stone stairs, and a landing before the doors. */
  private buildVestibule(blocks: PbrMaps) {
    const z0 = HALL.FRONT_Z, w = 9, top = 9, low = STAIR_DROP;
    const landing = 3, stairLen = 8, lowerLen = 9;
    const len = landing + stairLen + lowerLen;
    const wallMat = pbrMaterial(blocks, [len / 3, (top - low) / 3], { color: 0x9a9088 });
    const stoneMat = pbrMaterial(blocks, [w / 3, 1], { color: 0x6e6862, roughness: 0.75 });
    // landing in front of the doors
    const land = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, landing), stoneMat);
    land.position.set(0, -0.2, z0 + landing / 2);
    this.scene.add(land);
    // the flight of stairs (instanced treads)
    const steps = 14;
    const rise = -low / steps, run = stairLen / steps;
    const tread = new THREE.InstancedMesh(new THREE.BoxGeometry(w, rise, run), stoneMat, steps);
    const m = new THREE.Matrix4();
    for (let i = 0; i < steps; i++) tread.setMatrixAt(i, m.makeTranslation(0, -(i + 0.5) * rise, z0 + landing + (i + 0.5) * run));
    this.scene.add(tread);
    // lower floor
    const lower = new THREE.Mesh(new THREE.PlaneGeometry(w, lowerLen).rotateX(-Math.PI / 2), pbrMaterial(blocks, [w / 3, lowerLen / 3], { color: 0x5e5852, roughness: 0.7 }));
    lower.position.set(0, low, z0 + landing + stairLen + lowerLen / 2);
    this.scene.add(lower);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(len, top - low), wallMat);
      wall.position.set((side * w) / 2, (top + low) / 2, z0 + len / 2);
      wall.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      this.scene.add(wall);
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, len).rotateX(Math.PI / 2), wallMat);
    ceil.position.set(0, top, z0 + len / 2);
    this.scene.add(ceil);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, top - low), wallMat);
    back.position.set(0, (top + low) / 2, z0 + len);
    back.rotation.y = Math.PI;
    this.scene.add(back);
  }

  private buildAboutScroll() {
    const c = parchment(512, 680, 4);
    const g = c.getContext('2d')!;
    g.textAlign = 'center';
    g.fillStyle = '#7a3a18';
    g.font = '600 22px Cinzel, Georgia, serif';
    g.fillText('L U M O S', 256, 74);
    g.strokeStyle = 'rgba(90,50,20,0.5)';
    g.beginPath();
    g.moveTo(150, 96);
    g.lineTo(362, 96);
    g.stroke();
    g.fillStyle = '#2a160a';
    g.font = '400 54px "IM Fell English", Georgia, serif';
    const [first, ...rest] = portfolio.name.split(' ');
    g.fillText(first ?? '', 256, 190);
    g.fillText(rest.join(' '), 256, 252);
    g.font = 'italic 26px "Cormorant Garamond", Georgia, serif';
    g.fillStyle = '#4a3020';
    let y = wrap(g, portfolio.about.heading, 256, 320, 380, 32) + 20;
    g.font = '22px "Cormorant Garamond", Georgia, serif';
    for (const it of portfolio.about.interests.slice(0, 4)) y = wrap(g, '✦ ' + it, 256, y, 400, 28) + 12;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide, emissive: 0xffe2b0, emissiveMap: tex, emissiveIntensity: 0.35, transparent: true, opacity: 0 });
    const geo = new THREE.PlaneGeometry(1.3, 1.72, 28, 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, -Math.pow(Math.abs(p.getX(i)) / 0.65, 3) * 0.12);
    geo.computeVertexNormals();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geo, mat));
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x5a3418, roughness: 0.5 });
    for (const yy of [0.89, -0.89]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.46, 12), rodMat);
      rod.rotation.z = Math.PI / 2;
      rod.position.y = yy;
      group.add(rod);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xffc880, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(3.2, 3.6, 1);
    glow.position.z = -0.25;
    group.add(glow);
    group.visible = false;
    return { group, mat };
  }

  private pick(e: MouseEvent): Artefact | null {
    const r = this.ctx.engine.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.artefacts.filter((a) => a.group.visible).map((a) => a.hit), false);
    return hits.length ? (this.artefacts.find((a) => a.hit === hits[0].object) ?? null) : null;
  }

  private castFx(color: THREE.ColorRepresentation, count = 70, speed = 2.5) {
    const tip = this.wand.tipWorld();
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    this.sparks.emit({ position: tip, velocity: fwd.multiplyScalar(speed), spread: 1.4, life: [0.4, 1.2], size: [0.06, 0.008], color, color2: 0xffffff, drag: 2.2, count });
  }

  /* ── lifecycle ────────────────────────────────────────────────────── */

  enter(section?: Section) {
    audio.ambience('hall');
    document.getElementById('ui')!.prepend(this.labelsEl);
    if (section && section !== 'station' && section !== 'lake') {
      // arriving from the spellbook: already inside, doors open
      this.door.setOpen(1);
      this.door.leakMat.opacity = 0;
      this.rig.snap(HOME, HOME_LOOK);
      this.track(gsap.delayedCall(0.4, () => this.goToSection(section)));
      return;
    }
    this.intro();
  }

  /** ~6 s, skippable: up the entrance stairs, the doors swing open, the dark hall is revealed. */
  private intro() {
    const reduced = settings.get().reducedMotion;
    this.rig.smooth = 0.7;
    this.rig.lookSmooth = 0.6;
    this.rig.snap(ENTRY, new THREE.Vector3(0, 3.2, HALL.FRONT_Z));
    const tl = gsap.timeline();
    const open = { v: 0 };
    // climb the stairs (a gentle step rhythm rides on top of the glide)
    const climb = { t: 0 };
    const from = ENTRY.clone(), to = new THREE.Vector3(0, EYE, HALL.FRONT_Z + 3.2);
    tl.to(climb, {
      t: 1,
      duration: dur(3.4, 0.4),
      ease: 'sine.inOut',
      onUpdate: () => {
        this.rig.pos.lerpVectors(from, to, climb.t);
        if (!reduced) this.rig.pos.y += Math.abs(Math.sin(climb.t * Math.PI * 7)) * 0.05 * Math.sin(climb.t * Math.PI);
      },
    }, 0);
    tl.call(() => audio.door(), [], 2.3);
    tl.to(open, { v: 1, duration: dur(2.6, 0.4), ease: 'power2.inOut', onUpdate: () => this.door.setOpen(open.v) }, 2.3);
    // through the doorway: the dark hall opens up, eyes drift to the enchanted ceiling
    tl.to(this.rig.pos, { z: HOME.z + 3, duration: dur(2.6, 0.4), ease: 'power2.inOut' }, 3.4);
    tl.to(this.rig.look, { y: 8, z: -30, duration: dur(2.4, 0.4), ease: 'sine.inOut' }, 3.4);
    tl.call(() => ui.caption(portfolio.hallTitle, 4600), [], reduced ? 0.5 : 4.4);
    this.playCinematic(tl, () => {
      this.rig.smooth = 0.9;
      this.rig.lookSmooth = 0.8;
      this.door.setOpen(1);
      // the springs carry the camera the last few metres and settle the gaze
      this.rig.pos.copy(HOME);
      this.rig.look.copy(HOME_LOOK);
      this.track(gsap.delayedCall(1.5, () => {
        this.rig.smooth = 0.55;
        this.rig.lookSmooth = 0.45;
      }));
      ui.hint('The hall is waiting in the dark. Raise your wand.');
      this.offerCast('Lumos', 'Light the hall', () => this.castLumos());
    }, 'Skip the entrance');
  }

  private offerCast(name: string, sub: string, fn: () => void, secondary?: { label: string; onClick: () => void }) {
    this.pendingCast = fn;
    ui.showCast(
      name,
      () => {
        this.pendingCast = null;
        fn();
      },
      sub,
      secondary,
    );
  }

  primary() {
    if (this.pendingCast && !this.busy) {
      const f = this.pendingCast;
      this.pendingCast = null;
      ui.hideActions();
      f();
    }
  }

  back() {
    if (this.inspecting) {
      ui.closePanel();
      return true;
    }
    return false;
  }

  /** Spellbook: jump to a section, applying earlier spells instantly if needed. */
  goToSection(section: Section) {
    if (this.busy) return;
    this.cine?.progress(1);
    this.pendingCast = null;
    ui.hideActions();
    ui.hint(null);
    if (this.inspecting) this.exitInspect(true);
    ui.closePanel(true);
    if (section !== 'about') this.hideAbout();
    if (section !== 'projects') this.retireArtefacts();
    if (section !== 'aspirations') this.dismissStag();
    if (section !== 'contact') this.hideLetter();
    this.rig.pos.copy(HOME);
    if (section === 'about') {
      if (!this.lit) this.castLumos();
      else this.revealAbout(true);
    } else if (section === 'projects') {
      if (!this.lit) this.applyLit();
      if (!this.summoned) this.castAccio();
      else this.bringArtefactsDown();
    } else if (section === 'aspirations') {
      if (!this.lit) this.applyLit();
      if (!this.patronusDone) this.castPatronus();
      else this.reformStag();
    } else if (section === 'contact') {
      if (!this.lit) this.applyLit();
      if (!this.maximaDone) this.castMaxima();
      else this.showLetterOpen();
    }
  }

  /* ── state helpers ────────────────────────────────────────────────── */

  private applyLit() {
    this.lit = true;
    this.candleLit.fill(1);
    this.tableLit.fill(1);
    this.hall.candles.flames.setAll(1);
    this.hall.tableFlames.setAll(1);
    this.igniteR = -1;
    this.setLitLighting(0);
  }

  /** Warm, candle-lit state of the room. */
  private setLitLighting(d: number) {
    const fog = this.scene.fog as THREE.FogExp2;
    const tw = (o: object, v: gsap.TweenVars) => this.track(d ? gsap.to(o, { duration: d, ...v }) : gsap.set(o, v));
    tw(this.hemi, { intensity: 0.42 });
    tw(this.hemi.color, { r: 0x8a / 255, g: 0x7a / 255, b: 0x6a / 255 });
    tw(this.headLight, { intensity: 22 });
    this.sconceLights.forEach((l, i) => tw(l, { base: i < 2 ? 20 : 14 }));
    tw(fog.color, { r: 0x10 / 255, g: 0x0c / 255, b: 0x09 / 255 });
    tw(fog, { density: 0.011 });
    tw(this.sky.material.uniforms.uClouds, { value: 0.35 });
    tw(this.sky.material.uniforms.uStars, { value: 1.3 });
    tw(this.hall.roseMat, { emissiveIntensity: 1.1 });
    tw(this, { exposure: 1.02 });
    tw(this.motes.material.uniforms.uOpacity, { value: 0.85 });
    tw(this.bloom, { strength: 0.85 });
    if (this.scene.environment) tw(this.scene, { environmentIntensity: 0.25 });
    this.wand.setColor(0xfff1d0);
    tw(this.wand, { glowLevel: 0.3 });
    tw(this.wand.light, { intensity: 1 });
  }

  private hideAbout() {
    if (!this.aboutScroll.visible) return;
    this.track(gsap.to(this.aboutScroll.scale, { y: 0.02, duration: 0.5, ease: 'power2.in', onComplete: () => void (this.aboutScroll.visible = false) }));
  }

  /** Artefacts float up out of the way, slowly circling high above the aisle. */
  private retireArtefacts() {
    if (!this.summoned) return;
    this.artefactsDown = false;
    this.labelBtns.forEach((b) => {
      b.classList.remove('on');
      b.tabIndex = -1;
    });
    this.artefacts.forEach((a, i) => {
      const x = (i - (this.artefacts.length - 1) / 2) * 3.2;
      this.track(gsap.to(a.group.position, { x, y: 9.5, z: -16 - Math.abs(x) * 0.3, duration: 2.2, ease: 'power2.inOut' }));
      this.track(gsap.to(a.group.scale, { x: 0.8, y: 0.8, z: 0.8, duration: 2.2 }));
    });
  }

  private dismissStag() {
    if (!this.stag.group.visible) return;
    const u = this.stag.material.uniforms;
    const p = this.stag.group.position.clone().add(new THREE.Vector3(0, 2, 0));
    for (let i = 0; i < 60; i++) this.sparks.emit({ position: p, spread: 1.6, velocity: new THREE.Vector3(0, 1.6, 0), life: [1, 2], size: [0.06, 0.01], color: 0xcfe0ff, drag: 0.8 });
    this.track(gsap.to(u.uFade, { value: 0, duration: 1.2, onComplete: () => void (this.stag.group.visible = false) }));
    this.track(gsap.to(this.magicLight, { intensity: 0, duration: 1.2 }));
    this.stagFollow = false;
    if (this.lit) this.setLitLighting(1.4);
  }

  private hideLetter() {
    if (!this.letter.group.visible) return;
    this.track(gsap.to(this.letter.group.position, { y: 9, duration: 1.6, ease: 'power2.in', onComplete: () => void (this.letter.group.visible = false) }));
  }

  /* ── LUMOS ────────────────────────────────────────────────────────── */

  private async castLumos() {
    if (this.busy) return;
    this.busy = true;
    ui.hint(null);
    this.rig.look.copy(HOME_LOOK);
    await this.wand.flick();
    audio.lumos();
    this.castFx(0xffe2a0, 90);
    const reduced = settings.get().reducedMotion;
    const tl = gsap.timeline({ onComplete: () => void (this.busy = false) });
    this.track(tl);
    // anticipation: the tip gathers light
    tl.to(this.wand, { glowLevel: 1.1, duration: 0.25, ease: 'power2.out' }, 0);
    tl.to(this.wand.light, { intensity: 7, duration: 0.25 }, 0);
    // release: an orb rises from the wand to the middle of the hall
    const start = this.wand.tipWorld();
    const burstAt = new THREE.Vector3(0, 9.5, -16);
    this.orb.position.copy(start);
    this.magicLight.position.copy(start);
    this.magicLight.color.set(0xffe2b0);
    const orbMat = this.orb.material as THREE.SpriteMaterial;
    tl.to(orbMat, { opacity: 1, duration: 0.2 }, 0.05);
    tl.to(this.magicLight, { intensity: 40, duration: 0.3 }, 0.05);
    const rise = reduced ? 0.4 : 1.25;
    tl.to(this.orb.position, { x: burstAt.x, y: burstAt.y, z: burstAt.z, duration: rise, ease: 'power2.inOut', onUpdate: () => void this.magicLight.position.copy(this.orb.position) }, 0.1);
    tl.to(this.rig.look, { y: 7, z: -24, duration: rise + 0.4, ease: 'sine.inOut' }, 0.1);
    // burst → ignition wave rolls outward through every candle
    tl.call(() => {
      this.igniteCentre.copy(burstAt);
      this.igniteR = 0;
      this.ctx.engine.flash(0.22, 0xfff0d0);
      for (let i = 0; i < 160; i++) {
        const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        this.sparks.emit({ position: burstAt, velocity: dir.multiplyScalar(4 + Math.random() * 6), life: [0.6, 1.6], size: [0.09, 0.01], color: 0xffe0a0, color2: 0xffffff, drag: 1.6 });
      }
    }, [], 0.1 + rise);
    tl.to(this, { igniteR: 70, duration: reduced ? 0.6 : 2.6, ease: 'power1.in' }, 0.1 + rise);
    tl.to(orbMat, { opacity: 0, duration: 0.5 }, 0.15 + rise);
    tl.to(this.magicLight, { intensity: 0, duration: 1.2 }, 0.2 + rise);
    tl.call(() => this.setLitLighting(reduced ? 0.5 : 2.6), [], 0.1 + rise);
    tl.to(this.wand, { glowLevel: 0.3, duration: 1.4 }, 0.8);
    tl.to(this.wand.light, { intensity: 1, duration: 1.4 }, 0.8);
    tl.to(this.rig.look, { x: HOME_LOOK.x, y: HOME_LOOK.y, z: HOME_LOOK.z, duration: 2, ease: 'sine.inOut' }, 0.6 + rise);
    tl.call(() => {
      this.lit = true;
      this.ctx.director.markVisited('about');
      this.revealAbout(false);
    }, [], (reduced ? 0.8 : 2.8) + rise * 0.5);
  }

  /** Golden motes gather in the air and the parchment unfurls. */
  private revealAbout(again: boolean) {
    const target = portrait() ? new THREE.Vector3(0, 3.1, -9.2) : new THREE.Vector3(-1.7, 2.55, -8.6);
    const s = this.aboutScroll;
    s.position.copy(target);
    s.lookAt(HOME.x, target.y - 0.15, HOME.z);
    s.visible = true;
    const k = portrait() ? 0.85 : 1;
    if (!again) {
      const tip = this.wand.tipWorld();
      for (let i = 0; i < 90; i++) {
        const v = target.clone().sub(tip).multiplyScalar(1.05 + Math.random() * 0.35);
        this.sparks.emit({ position: tip, velocity: v, spread: 0.3, life: [0.75, 1.05], size: [0.05, 0.015], color: 0xffd07a, color2: 0xfff4d8, drag: 1.1 });
      }
    }
    s.scale.set(k, 0.02, k);
    this.aboutMat.opacity = 0;
    this.rig.look.set(target.x * 0.5, 3, -18);
    const tl = gsap.timeline({ delay: again ? 0 : 0.7 });
    tl.to(this.aboutMat, { opacity: 1, duration: 0.6 }, 0);
    tl.to(s.scale, { y: k, duration: dur(1.3, 0.3), ease: 'back.out(1.5)' }, 0);
    tl.call(() => {
      ui.openPanel({
        variant: 'parchment',
        eyebrow: 'Lumos · About me',
        title: portfolio.about.heading,
        body: aboutBody(),
        closeLabel: 'Close the parchment',
        onClose: () => {
          this.rig.look.copy(HOME_LOOK);
          if (this.summoned) this.offerNextAfter('about');
          else this.offerCast('Accio', 'Summon my projects', () => this.castAccio(), { label: 'Read again', onClick: () => this.revealAbout(true) });
        },
      });
    }, [], 0.55);
    this.track(tl);
  }

  /** After revisiting a section, offer whatever comes next in the sequence. */
  private offerNextAfter(from: Section) {
    if (from === 'about' || from === 'projects') {
      if (!this.patronusDone) return this.offerCast('Expecto Patronum', 'Call your guide', () => this.castPatronus());
    }
    if (!this.maximaDone) return this.offerCast('Lumos Maxima', 'The last spell', () => this.castMaxima());
    ui.showAction('Read the letter again', () => this.showLetterOpen(), { label: 'Begin again', onClick: () => this.ctx.director.restart() });
  }

  /* ── ACCIO ────────────────────────────────────────────────────────── */

  private slot(i: number) {
    const n = this.artefacts.length;
    const p = portrait();
    const spread = p ? 0.95 : 1.85;
    const x = (i - (n - 1) / 2) * spread;
    return new THREE.Vector3(x, (p ? 2.65 : 2.2) + Math.abs(x) * 0.06, (p ? -9.6 : -8.6) + Math.abs(x) * 0.25);
  }

  private async castAccio() {
    if (this.busy) return;
    this.busy = true;
    this.hideAbout();
    ui.hint(null);
    this.rig.look.set(0, 4.5, -30);
    await this.wand.flick();
    audio.accio();
    this.castFx(0xffc870, 80, 4);
    this.ctx.engine.flash(0.1, 0xffe0b0);
    const reduced = settings.get().reducedMotion;
    this.track(gsap.fromTo(this.wand, { glowLevel: 1.1 }, { glowLevel: 0.3, duration: 1.6 }));
    const tl = gsap.timeline({
      onComplete: () => {
        this.busy = false;
        this.summoned = true;
        this.ctx.director.markVisited('projects');
        this.afterSummon();
      },
    });
    this.track(tl);
    // the pull: a ribbon of light runs from the wand to the rose window
    const tip = this.wand.tipWorld();
    const rose = new THREE.Vector3(0, 13.5, HALL.BACK_Z + 1);
    for (let i = 0; i < 40; i++) {
      const p = tip.clone().lerp(rose, i / 40);
      this.sparks.emit({ position: p, spread: 0.15, life: [0.6, 1.1], size: [0.06, 0.01], color: 0xffd890, drag: 2 });
    }
    tl.to(this.rig.look, { y: 3, z: -14, duration: reduced ? 0.5 : 2.6, ease: 'sine.inOut' }, 0.8);
    this.artefacts.forEach((a, i) => {
      const from = new THREE.Vector3((i - 1) * 3, 13.5 - Math.abs(i - 1), HALL.BACK_Z + 2);
      const to = this.slot(i);
      const c1 = from.clone().lerp(to, 0.3).add(new THREE.Vector3((i - 1) * 4, 3, 0));
      const c2 = from.clone().lerp(to, 0.72).add(new THREE.Vector3(-(i - 1) * 2, 1.5, 0));
      const curve = new THREE.CatmullRomCurve3([from, c1, c2, to], false, 'centripetal');
      const o = { t: 0 };
      a.group.position.copy(from);
      a.group.scale.setScalar(0.3);
      tl.call(() => {
        a.group.visible = true;
        this.flying.add(a);
      }, [], 0.35 + i * 0.4);
      tl.to(o, {
        t: 1,
        duration: reduced ? 0.8 : 3,
        ease: 'power3.inOut',
        onUpdate: () => {
          curve.getPointAt(o.t, a.group.position);
          a.body.rotation.y = (1 - o.t) * Math.PI * 5;
          a.body.rotation.z = Math.sin(o.t * Math.PI) * 0.5;
          a.group.scale.setScalar(0.3 + o.t * 0.7);
        },
        onComplete: () => {
          this.flying.delete(a);
          a.body.rotation.set(0, 0, 0);
          audio.arrive();
          // settle with a little overshoot
          this.track(gsap.fromTo(a.group.scale, { x: 1.12, y: 1.12, z: 1.12 }, { x: 1, y: 1, z: 1, duration: 0.9, ease: 'elastic.out(1, 0.45)' }));
          this.sparks.emit({ position: a.group.position, spread: 1.4, life: [0.3, 0.9], size: [0.05, 0.01], color: 0xffe0a0, drag: 3, count: 36 });
        },
      }, 0.35 + i * 0.4);
    });
  }

  private bringArtefactsDown() {
    this.busy = true;
    this.artefacts.forEach((a, i) => {
      const s = this.slot(i);
      a.group.visible = true;
      this.track(gsap.to(a.group.position, { x: s.x, y: s.y, z: s.z, duration: 1.6, ease: 'power3.inOut' }));
      this.track(gsap.to(a.group.scale, { x: 1, y: 1, z: 1, duration: 1.6 }));
    });
    this.rig.look.set(0, 3, -14);
    this.track(gsap.delayedCall(1.7, () => {
      this.busy = false;
      this.afterSummon();
    }));
  }

  private afterSummon() {
    this.artefactsDown = true;
    this.labelBtns.forEach((b) => {
      b.classList.add('on');
      b.tabIndex = 0;
    });
    ui.hint(isMobile ? 'Tap an artefact to open it.' : 'Choose an artefact to open it.');
    if (!this.patronusDone) this.offerCast('Expecto Patronum', 'Call your guide', () => this.castPatronus());
    else this.offerNextAfter('projects');
  }

  private inspect(i: number) {
    const a = this.artefacts[i];
    if (!a || !this.artefactsDown || this.flying.size) return;
    const prev = this.inspecting;
    this.inspecting = a;
    this.hovered = null;
    this.pendingCast = null;
    ui.hideActions();
    ui.hint(null);
    this.labelBtns.forEach((b) => b.classList.remove('on'));
    const dest = portrait() ? new THREE.Vector3(0, 2.35, -6.7) : new THREE.Vector3(-0.95, 1.95, -6.55);
    const d = dur(1.1, 0.3);
    this.artefacts.forEach((o, j) => {
      if (o === a) return;
      const s = this.slot(j);
      this.track(gsap.to(o.group.position, { x: s.x * 1.5, y: s.y + 0.7, z: s.z - 1.6, duration: d, ease: 'power3.out' }));
      this.track(gsap.to(o.group.scale, { x: 0.6, y: 0.6, z: 0.6, duration: d }));
      o.setOpen(0);
    });
    if (prev && prev !== a) prev.setOpen(0);
    this.track(gsap.to(a.group.position, { x: dest.x, y: dest.y, z: dest.z, duration: d, ease: 'power3.inOut' }));
    this.track(gsap.to(a.group.scale, { x: 1, y: 1, z: 1, duration: d }));
    const open = { v: 0 };
    this.track(gsap.to(open, { v: 1, duration: dur(1.2, 0.3), delay: 0.45, ease: 'power2.inOut', onUpdate: () => a.setOpen(open.v) }));
    this.rig.look.set(dest.x * 0.6, dest.y + 0.2, -14);
    this.sparks.emit({ position: dest, spread: 0.9, life: [0.4, 1], size: [0.04, 0.01], color: 0xffd890, drag: 2.5, count: 30 });
    const body = projectBody(a.project);
    const n = this.artefacts.length;
    const nav = $(`<div class="proj-nav"><button type="button" data-d="-1">${icons.arrowL}<span>Previous</span></button><span class="count">${i + 1} of ${n}</span><button type="button" data-d="1"><span>Next</span>${icons.arrowR}</button></div>`);
    nav.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
      b.addEventListener('click', () => {
        audio.ui();
        this.inspect((i + Number(b.dataset.d) + n) % n);
      }),
    );
    body.append(nav);
    ui.openPanel({ variant: 'project', eyebrow: `Accio · Project ${i + 1} of ${n}`, title: a.project.name, body, closeLabel: 'Put it back', onClose: () => this.exitInspect() });
  }

  private exitInspect(instant = false) {
    const a = this.inspecting;
    this.inspecting = null;
    const d = instant ? 0 : dur(0.9, 0.3);
    this.artefacts.forEach((o, j) => {
      const s = this.slot(j);
      this.track(gsap.to(o.group.position, { x: s.x, y: s.y, z: s.z, duration: d, ease: 'power3.inOut' }));
      this.track(gsap.to(o.group.scale, { x: 1, y: 1, z: 1, duration: d }));
    });
    a?.setOpen(0);
    this.rig.look.set(0, 3, -14);
    if (!instant) this.afterSummon();
  }

  /* ── EXPECTO PATRONUM ─────────────────────────────────────────────── */

  private stagPath() {
    const v = (x: number, z: number) => new THREE.Vector3(x, 0, z);
    return new THREE.CatmullRomCurve3([v(-0.6, -11.5), v(0, -16), v(0, -30), v(0, -43), v(2.4, -47.6), v(0, -49.6), v(-2.4, -47.6), v(0, -43), v(0, -30), v(-1.2, -21.5), v(-2.1, -17.5)], false, 'centripetal');
  }

  private async castPatronus() {
    if (this.busy) return;
    this.busy = true;
    ui.hint(null);
    this.hideAbout();
    this.retireArtefacts();
    this.hideLetter();
    this.wand.setColor(0xd8e6ff);
    this.rig.look.set(-0.4, 2.6, -14);
    await this.wand.flick();
    audio.patronus();
    this.castFx(0xcfe0ff, 140, 3);
    this.ctx.engine.flash(0.25, 0xdfe9ff);
    const reduced = settings.get().reducedMotion;
    const g = this.stag.group;
    g.position.set(-1.6, 0, -11.5);
    g.rotation.set(0, 0.3, 0);
    g.visible = true;
    const u = this.stag.material.uniforms;
    u.uForm.value = 0;
    u.uGait.value = 0;
    u.uFade.value = 1;
    g.updateMatrixWorld();
    u.uSource.value.copy(g.worldToLocal(this.wand.tipWorld()));
    this.magicLight.color.set(0xc4d8ff);
    this.magicLight.position.set(-1, 2.5, -11);
    const fog = this.scene.fog as THREE.FogExp2;
    const tl = gsap.timeline();
    // anticipation: silver gathers at the tip
    tl.to(this.wand, { glowLevel: 1.3, duration: 0.4 }, 0);
    tl.to(this.wand.light, { intensity: 9, duration: 0.4 }, 0);
    // the stag assembles from the stream of light
    tl.to(u.uForm, { value: 1, duration: reduced ? 1 : 3.6, ease: 'power1.inOut' }, 0.1);
    tl.to(this.magicLight, { intensity: 26, duration: 2.6 }, 0.5);
    // the hall cools to silver: candles bow, moonlight rises
    tl.to(this.hemi.color, { r: 0.5, g: 0.6, b: 0.85, duration: 2.6 }, 0.4);
    tl.to(fog.color, { r: 0.05, g: 0.07, b: 0.12, duration: 2.6 }, 0.4);
    this.sconceLights.forEach((l) => tl.to(l, { base: l.base * 0.35, duration: 2.6 }, 0.4));
    tl.to(this.headLight, { intensity: 6, duration: 2.6 }, 0.4);
    tl.to(this.bloom, { strength: 1.0, duration: 2 }, 0.4);
    tl.to(this.wand, { glowLevel: 0.4, duration: 1.4 }, 2.2);
    tl.to(this.wand.light, { intensity: 1.4, duration: 1.4 }, 2.2);
    // it lifts its head, then gallops the length of the hall and back
    const path = this.stagPath();
    const run = { t: 0 };
    const runStart = reduced ? 1.1 : 3.9;
    const runDur = reduced ? 1.6 : 7.5;
    tl.call(() => {
      audio.gallop();
      this.stagFollow = true;
    }, [], runStart);
    tl.to(u.uGait, { value: 1, duration: 0.5 }, runStart);
    const tan = new THREE.Vector3();
    tl.to(run, {
      t: 1,
      duration: runDur,
      ease: 'sine.inOut',
      onUpdate: () => {
        path.getPointAt(run.t, g.position);
        path.getTangentAt(Math.min(0.999, run.t), tan);
        const yaw = Math.atan2(-tan.z, tan.x);
        g.rotation.y += (shortest(g.rotation.y, yaw)) * 0.25;
      },
    }, runStart);
    tl.call(() => audio.gallop(), [], runStart + runDur * 0.5);
    tl.to(u.uGait, { value: 0, duration: 0.8 }, runStart + runDur - 0.6);
    // turn to face you
    tl.to(g.rotation, { y: STAG_FACING, duration: 1.4, ease: 'power2.inOut' }, runStart + runDur);
    tl.call(() => {
      this.stagFollow = false;
      this.rig.look.set(-0.6, 2.8, -24);
    }, [], runStart + runDur + 0.2);
    this.playCinematic(tl, () => {
      this.stagFollow = false;
      g.position.copy(STAG_REST);
      g.rotation.y = STAG_FACING;
      u.uForm.value = 1;
      u.uGait.value = 0;
      this.busy = false;
      this.patronusDone = true;
      this.ctx.director.markVisited('aspirations');
      this.revealAspirations();
    });
  }

  /** Revisit: the stag re-forms where it last stood. */
  private reformStag() {
    const g = this.stag.group;
    const u = this.stag.material.uniforms;
    g.position.copy(STAG_REST);
    g.rotation.set(0, STAG_FACING, 0);
    g.visible = true;
    u.uFade.value = 1;
    u.uForm.value = 0;
    g.updateMatrixWorld();
    u.uSource.value.copy(g.worldToLocal(this.wand.tipWorld()));
    this.magicLight.color.set(0xc4d8ff);
    this.magicLight.position.set(STAG_REST.x, 2.5, STAG_REST.z + 1);
    this.track(gsap.to(u.uForm, { value: 1, duration: dur(2, 0.4) }));
    this.track(gsap.to(this.magicLight, { intensity: 26, duration: 1.5 }));
    this.rig.look.set(-0.6, 2.8, -24);
    this.track(gsap.delayedCall(dur(1.6, 0.3), () => this.revealAspirations()));
  }

  private revealAspirations() {
    ui.openPanel({
      variant: 'patronus',
      eyebrow: 'Expecto Patronum · Aspirations',
      title: portfolio.aspirations.heading,
      body: aspirationsBody(),
      closeLabel: 'Close',
      onClose: () => {
        if (!this.maximaDone) this.offerCast('Lumos Maxima', 'The last spell', () => this.castMaxima(), { label: 'Read again', onClick: () => this.revealAspirations() });
        else this.offerNextAfter('aspirations');
      },
    });
  }

  /* ── LUMOS MAXIMA ─────────────────────────────────────────────────── */

  private async castMaxima() {
    if (this.busy) return;
    this.busy = true;
    ui.hint(null);
    this.hideAbout();
    this.retireArtefacts();
    const reduced = settings.get().reducedMotion;
    // the Patronus dissolves into rising light and the hall warms again
    this.dismissStag();
    this.wand.setColor(0xfff0c8);
    // aim high
    this.rig.look.set(0, 13, -18);
    await new Promise((r) => setTimeout(r, reduced ? 100 : 700));
    await this.wand.flick();
    audio.maxima();
    const tl = gsap.timeline();
    const tip = () => this.wand.tipWorld();
    // anticipation: light is drawn in toward the wand from the whole room
    const charge = { k: 0 };
    tl.to(charge, {
      k: 1,
      duration: reduced ? 0.4 : 1.5,
      ease: 'power2.in',
      onUpdate: () => {
        const t = tip();
        for (let i = 0; i < 4; i++) {
          const from = t.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.3) * 5, -Math.random() * 6));
          this.sparks.emit({ position: from, velocity: t.clone().sub(from).multiplyScalar(1.6), life: [0.55, 0.65], size: [0.05, 0.01], color: 0xffe2a0, drag: 0 });
        }
      },
    }, 0);
    tl.to(this.wand, { glowLevel: 1.8, duration: reduced ? 0.4 : 1.5, ease: 'power2.in' }, 0);
    tl.to(this.wand.light, { intensity: 14, duration: reduced ? 0.4 : 1.5, ease: 'power2.in' }, 0);
    // release: a column of light to the enchanted ceiling
    const releaseAt = reduced ? 0.45 : 1.55;
    tl.call(() => {
      const t = tip();
      this.beam.position.copy(t);
      this.beam.scale.set(1, 0.01, 1);
      this.beam.visible = true;
      this.ctx.engine.flash(0.85, 0xfff2d8);
      this.magicLight.color.set(0xfff0d0);
      this.magicLight.position.set(0, 12, -14);
      this.maximaDone = true;
      this.ctx.director.markVisited('contact');
      // fireworks of gold high in the hall
      for (let i = 0; i < 360; i++) {
        const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6 - 0.1, Math.random() - 0.5).normalize();
        this.sparks.emit({ position: new THREE.Vector3(0, 15, -16), velocity: dir.multiplyScalar(5 + Math.random() * 9), life: [1.2, 2.8], size: [0.12, 0.02], color: 0xffd98a, color2: 0xffffff, drag: 1.2, gravity: 0.6 });
      }
    }, [], releaseAt);
    tl.to(this.beam.scale, { y: 22, duration: 0.5, ease: 'power3.out' }, releaseAt);
    tl.fromTo(this.beam.material as THREE.MeshBasicMaterial, { opacity: 0.9 }, { opacity: 0, duration: 2.2, ease: 'power2.in' }, releaseAt + 0.2);
    tl.to(this.magicLight, { intensity: 60, duration: 0.3 }, releaseAt);
    tl.to(this.magicLight, { intensity: 0, duration: 3 }, releaseAt + 0.6);
    // the ceiling blazes with stars; every candle flares
    const sky = this.sky.material.uniforms;
    tl.to(sky.uStars, { value: 3, duration: 2.5 }, releaseAt);
    tl.to(sky.uClouds, { value: 0, duration: 2.5 }, releaseAt);
    tl.to(sky.uTop.value, { r: 0.05, g: 0.08, b: 0.2, duration: 2.5 }, releaseAt);
    tl.to(this.hall.candles.flames.material.uniforms.uGlobal, { value: 1.6, duration: 0.6 }, releaseAt);
    tl.to(this.hall.candles.flames.material.uniforms.uGlobal, { value: 1.15, duration: 3 }, releaseAt + 1);
    tl.to(this.wand, { glowLevel: 0.35, duration: 1.5 }, releaseAt + 0.4);
    tl.to(this.wand.light, { intensity: 1, duration: 1.5 }, releaseAt + 0.4);
    // a sealed letter drifts down out of the stars
    const L = this.letter.group;
    const restPos = portrait() ? new THREE.Vector3(0, 3.1, -8.6) : new THREE.Vector3(0, 2.15, -7.6);
    const fall = { t: 0 };
    const fallStart = releaseAt + (reduced ? 0.4 : 1.6);
    const fallDur = reduced ? 1.2 : 4.6;
    tl.call(() => {
      L.visible = true;
      L.position.set(0.6, 15, -12);
      L.rotation.set(0.4, 0, 0.3);
      this.letter.setOpen(0);
      audio.flutter();
    }, [], fallStart);
    tl.to(fall, {
      t: 1,
      duration: fallDur,
      ease: 'power2.out',
      onUpdate: () => {
        const t = fall.t;
        const sway = (1 - t) * 1.1;
        L.position.set(restPos.x + Math.sin(t * 9) * sway, THREE.MathUtils.lerp(15, restPos.y, t), THREE.MathUtils.lerp(-12, restPos.z, t));
        L.rotation.set((1 - t) * Math.sin(t * 7) * 0.5, Math.sin(t * 5) * (1 - t) * 0.6, Math.sin(t * 9 + 1) * 0.35 * (1 - t));
        this.rig.look.set(L.position.x * 0.4, L.position.y, L.position.z - 2);
      },
    }, fallStart);
    tl.call(() => audio.flutter(), [], fallStart + fallDur * 0.55);
    // turns over, the seal breaks, the letter slides out
    tl.to(L.rotation, { x: 0, y: Math.PI, z: 0, duration: 1.1, ease: 'power2.inOut' }, fallStart + fallDur);
    tl.call(() => audio.page(), [], fallStart + fallDur + 0.9);
    const op = { v: 0 };
    tl.to(op, { v: 1, duration: reduced ? 0.6 : 2.8, ease: 'sine.inOut', onUpdate: () => this.letter.setOpen(op.v) }, fallStart + fallDur + 1);
    tl.call(() => {
      for (let i = 0; i < 40; i++) this.sparks.emit({ position: L.position, spread: 1.1, life: [0.6, 1.4], size: [0.05, 0.01], color: 0xffd890, drag: 1.5, gravity: -0.3 });
    }, [], fallStart + fallDur + 1.1);
    this.playCinematic(tl, () => {
      this.busy = false;
      this.beam.visible = false;
      this.showLetterOpen();
    });
  }

  private showLetterOpen() {
    const L = this.letter.group;
    L.visible = true;
    this.letter.setOpen(1);
    L.rotation.set(0, Math.PI, 0);
    const p = portrait() ? new THREE.Vector3(0, 3.35, -9.4) : new THREE.Vector3(-1.35, 1.95, -8.1);
    this.track(gsap.to(L.position, { x: p.x, y: p.y, z: p.z, duration: dur(1.2, 0.3), ease: 'power3.inOut' }));
    this.rig.look.set(p.x * 0.5, p.y + 0.3, -16);
    ui.openPanel({
      variant: 'contact',
      eyebrow: 'Lumos Maxima · Contact',
      title: portfolio.contact.heading,
      body: contactBody(() => this.ctx.director.restart()),
      closeLabel: 'Close',
      onClose: () => ui.showAction('Read the letter again', () => this.showLetterOpen(), { label: 'Begin again', onClick: () => this.ctx.director.restart() }),
    });
  }

  /* ── frame ────────────────────────────────────────────────────────── */

  update(dt: number, t: number) {
    super.update(dt, t);
    const reduced = settings.get().reducedMotion;
    const pt = this.ctx.engine.pointer;
    if (this.stagFollow) {
      const p = this.stag.group.position;
      this.rig.look.set(p.x, 2.4, p.z);
    }
    this.rig.update(dt, pt);
    this.wand.update(dt, pt);
    this.sky.update(t);
    this.hall.update(t, reduced ? 0 : 0.09);
    for (const l of this.sconceLights) l.update(t);
    this.motes.update(t);

    // Lumos ignition wave
    if (this.igniteR >= 0) {
      const c = this.igniteCentre;
      const cp = this.hall.candles.pos;
      for (let i = 0; i < cp.length; i++) {
        if (this.candleLit[i] < 1 && cp[i].distanceTo(c) < this.igniteR) {
          this.candleLit[i] = Math.min(1, this.candleLit[i] + dt * 4);
          this.hall.candles.flames.setLit(i, this.candleLit[i]);
        }
      }
      const tf = this.hall.tableFlames;
      const posAttr = tf.geometry.attributes.position;
      const tmp = new THREE.Vector3();
      for (let i = 0; i < tf.count; i++) {
        if (this.tableLit[i] >= 1) continue;
        tmp.fromBufferAttribute(posAttr, i);
        if (tmp.distanceTo(c) < this.igniteR * 0.9) {
          this.tableLit[i] = Math.min(1, this.tableLit[i] + dt * 3);
          tf.setLit(i, this.tableLit[i]);
        }
      }
      if (this.igniteR >= 70) this.igniteR = -1;
    }

    // artefacts: trails while flying, float + glow when idle
    for (const a of this.flying) {
      this.sparks.emit({ position: a.group.position, spread: 0.3, life: [0.5, 1.1], size: [0.06, 0.01], color: 0xffd080, color2: new THREE.Color(a.project.color).lerp(new THREE.Color(0xffffff), 0.5), drag: 1.4, count: 3 });
    }
    if ((this.orb.material as THREE.SpriteMaterial).opacity > 0.05) {
      this.sparks.emit({ position: this.orb.position, spread: 0.5, life: [0.5, 1.2], size: [0.08, 0.01], color: 0xffe8c0, drag: 1, count: 4 });
    }
    this.artefacts.forEach((a, i) => {
      if (!a.group.visible) return;
      a.update(dt, t);
      if (this.flying.has(a)) return;
      const isInspect = a === this.inspecting;
      const hover = a === this.hovered;
      a.body.position.y = Math.sin(t * 1.1 + i * 1.7) * (reduced ? 0 : 0.06);
      if (isInspect) a.body.rotation.y = THREE.MathUtils.lerp(a.body.rotation.y, 0.35 + Math.sin(t * 0.5) * 0.22 * (reduced ? 0 : 1), 1 - Math.pow(0.05, dt));
      else a.body.rotation.y += dt * (hover ? 1.1 : 0.3) * (reduced ? 0 : 1);
      const gm = a.glow.material as THREE.SpriteMaterial;
      gm.opacity = THREE.MathUtils.lerp(gm.opacity, hover || isInspect ? 0.7 : 0.28, 1 - Math.pow(0.01, dt));
    });
    this.labelBtns.forEach((b, i) => b.classList.toggle('hover', this.artefacts[i] === this.hovered));
    if (this.artefactsDown && !this.inspecting) {
      const v = new THREE.Vector3();
      const w = this.ctx.engine.width, h = this.ctx.engine.height;
      this.artefacts.forEach((a, i) => {
        v.copy(a.group.position).add(new THREE.Vector3(0, -0.66, 0)).project(this.camera);
        this.labelBtns[i].style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, 0)`;
      });
    }

    if (this.stag.group.visible) {
      this.stag.update(t);
      const u = this.stag.material.uniforms;
      if (u.uGait.value > 0.5) {
        const g = this.stag.group;
        this.magicLight.position.set(g.position.x, 2.6, g.position.z);
        this.sparks.emit({ position: g.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.4 + Math.random() * 2.2, (Math.random() - 0.5) * 1.2)), spread: 0.4, life: [0.8, 1.6], size: [0.07, 0.01], color: 0xcfe0ff, drag: 1.2, count: 4 });
      }
    }
    if (this.letter.group.visible && !this.cinematic && !reduced) this.letter.group.position.y += Math.sin(t * 1.2) * 0.0008;
    if (this.aboutScroll.visible && !reduced) this.aboutScroll.rotation.z = Math.sin(t * 0.7) * 0.015;
    this.sparks.update(dt);
  }

  dispose() {
    ui.hint(null);
    super.dispose();
  }
}

function shortest(from: number, to: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  let line = '';
  for (const w of text.split(' ')) {
    if (line && g.measureText(line + w).width > maxW) {
      g.fillText(line.trim(), x, y);
      line = '';
      y += lh;
    }
    line += w + ' ';
  }
  g.fillText(line.trim(), x, y);
  return y + lh;
}

function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.7)');
  grd.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 256);
  const h = g.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,1)');
  h.addColorStop(0.5, 'rgba(0,0,0,0)');
  h.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = h;
  g.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(c);
}

export default async (ctx: SceneContext) => {
  const [brick, floor, wood, blocks, goblet, plate, env] = await Promise.all([
    pbr('castle_brick_07'),
    pbr('stone_tiles_02'),
    pbr('wood_table_worn'),
    pbr('medieval_blocks_02'),
    model('brass_goblets'),
    model('carved_wooden_plate'),
    environment('rostock_arches', ctx.engine.renderer),
  ]);
  return new GreatHallScene(ctx, { brick, floor, wood, blocks, goblet, plate, env });
};
