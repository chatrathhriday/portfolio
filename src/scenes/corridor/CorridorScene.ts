/**
 * SCENE 3 — The Hogwarts corridor. The visitor's wand reveals the portfolio:
 *   LUMOS             → an orb of light races down the corridor, lighting every
 *                       candle and torch it passes; an enchanted parchment unfurls (About).
 *   ACCIO             → project artefacts fly in from the dark end of the hall
 *                       and hover in an arc; each can be inspected (Projects).
 *   EXPECTO PATRONUM  → silver light gathers from the wand into a galloping
 *                       stag that tints the hall and leads to the door (Aspirations).
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { BaseScene } from '../BaseScene';
import type { SceneContext, Section } from '../../core/types';
import { buildHall, type Hall } from '../../world/hall';
import { buildDoor, type Door } from '../../world/door';
import { buildArtefact, type Artefact } from '../../world/artefacts';
import { Stag } from '../../world/stag';
import { Wand } from '../../fx/wand';
import { DriftField, ParticlePool } from '../../fx/particles';
import { Flames, FlickerLight } from '../../fx/atmosphere';
import { parchment, softDot } from '../../core/textures';
import { audio } from '../../core/audio';
import { settings, dur } from '../../core/settings';
import { isMobile } from '../../core/quality';
import { ui, onArrow, $ } from '../../ui/ui';
import { aboutBody, aspirationsBody, projectBody } from '../../ui/content';
import { portfolio } from '../../content/portfolio';
import { icons } from '../../ui/icons';

const EYE = 1.7;
const STOP = { about: 2, projects: -24, aspirations: -50, door: -80 } as const;
const DOOR_Z = -92;
const HALL_START = 12;
const HALL_LEN = 108;

type Phase = 'dark' | 'lit' | 'patronus';

class CorridorScene extends BaseScene {
  readonly id = 'corridor' as const;
  private hall: Hall;
  private door: Door;
  private wand: Wand;
  private hemi: THREE.HemisphereLight;
  private torchLights: FlickerLight[] = [];
  private torchFlames: Flames;
  private candleFlames: Flames;
  private candles: THREE.InstancedMesh;
  private candlePos: THREE.Vector3[] = [];
  private candleLit: Float32Array;
  private torchLit: Float32Array;
  private sparks: ParticlePool;
  private motes: DriftField;
  private orb: THREE.Sprite;
  private orbLight: THREE.PointLight;
  private aboutScroll: THREE.Group;
  private aboutScrollMat: THREE.MeshStandardMaterial;
  private artefacts: Artefact[] = [];
  private stag: Stag;
  private stagLight: THREE.PointLight;
  private labelsEl: HTMLElement;
  private labelBtns: HTMLButtonElement[] = [];
  private raycaster = new THREE.Raycaster();

  // state
  private phase: Phase = 'dark';
  private litFront = 99; // z beyond which lights are lit (decreasing = further)
  private camZ = HALL_START - 4;
  private walking = 0;
  private walkPhase = 0;
  private busy = false;
  private summoned = false;
  private flying = new Set<Artefact>();
  private inspecting: Artefact | null = null;
  private hovered: Artefact | null = null;
  private look = new THREE.Vector3(0, EYE, -10);
  private lookFocus: THREE.Vector3 | null = null;
  private pendingCast: (() => void) | null = null;
  private torchBase = 0;

  constructor(ctx: SceneContext) {
    super(ctx);
    const q = ctx.engine.quality;
    this.baseFov = 58;
    this.bloom = { strength: 0.85, radius: 0.55, threshold: 0.78 };
    this.exposure = 0.9;
    this.scene.background = new THREE.Color(0x020306);
    this.scene.fog = new THREE.FogExp2(0x030408, 0.07);

    this.hall = buildHall({ zStart: HALL_START, length: HALL_LEN });
    this.scene.add(this.hall.group);
    // back wall behind the starting point
    const back = new THREE.Mesh(new THREE.PlaneGeometry(8, 12), new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 1 }));
    back.position.set(0, 6, HALL_START);
    back.rotation.y = Math.PI;
    this.scene.add(back);

    // the far door, set into an end wall
    this.door = buildDoor();
    this.door.group.position.set(0, 0, DOOR_Z);
    this.scene.add(this.door.group);
    const endWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 12), new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 1 }));
    endWall.position.set(0, 6, DOOR_Z - 0.45);
    this.scene.add(endWall);

    this.hemi = new THREE.HemisphereLight(0x5a6a8a, 0x120c08, 0.05);
    this.scene.add(this.hemi);

    // torch lights: one per stop, ahead of the camera on the right wall
    const nLights = Math.max(2, q.maxLights - 2);
    const lightZ = [STOP.about - 5, STOP.projects - 5, STOP.aspirations - 5, STOP.door - 6].slice(0, nLights);
    this.torchBase = 26;
    for (const z of lightZ) {
      const l = new FlickerLight(0xff9a40, 0, 18, 1.7);
      l.position.set(2.6, 3.4, z);
      this.scene.add(l);
      this.torchLights.push(l);
    }
    this.torchFlames = new Flames(this.hall.torchPositions.map((p) => p.clone().add(new THREE.Vector3(p.x > 0 ? -0.05 : 0.05, 0.22, 0))), 0.55, 0xff9a40, 0);
    this.scene.add(this.torchFlames);
    this.torchLit = new Float32Array(this.hall.torchPositions.length);

    // floating candles (instanced bodies + one flame draw call)
    const nCandles = q.candles;
    for (let i = 0; i < nCandles; i++) {
      this.candlePos.push(new THREE.Vector3((Math.random() - 0.5) * 6, 4.6 + Math.random() * 3.2, HALL_START - 3 - Math.random() * (HALL_LEN - 14)));
    }
    const candleGeo = new THREE.CylinderGeometry(0.035, 0.04, 0.32, 8);
    candleGeo.translate(0, -0.16, 0);
    this.candles = new THREE.InstancedMesh(candleGeo, new THREE.MeshStandardMaterial({ color: 0xf2e6cc, roughness: 0.6, emissive: 0x403020, emissiveIntensity: 0.3 }), nCandles);
    this.scene.add(this.candles);
    this.candleFlames = new Flames(this.candlePos.map((p) => p.clone().add(new THREE.Vector3(0, 0.07, 0))), 0.22, 0xffb050, 0);
    this.candleFlames.material.uniforms.uBob.value = settings.get().reducedMotion ? 0 : 0.08;
    this.scene.add(this.candleFlames);
    this.candleLit = new Float32Array(nCandles);
    this.updateCandles(0);

    this.sparks = new ParticlePool(Math.round(900 * Math.max(0.5, q.particles)));
    this.scene.add(this.sparks.points);
    this.motes = new DriftField({ count: Math.round(320 * q.particles), box: new THREE.Vector3(8, 7, 26), center: new THREE.Vector3(0, 3.5, 0), color: 0xffd9a8, size: 0.03, speed: 0.25, rise: 0.15, opacity: 0.0 });
    this.scene.add(this.motes);

    // Lumos orb
    this.orb = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xfff0d0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.orb.scale.setScalar(0.9);
    this.orbLight = new THREE.PointLight(0xffe0b0, 0, 16, 1.5);
    this.orb.add(this.orbLight);
    this.scene.add(this.orb);

    // About parchment (in-world)
    const { group, mat } = this.buildAboutScroll();
    this.aboutScroll = group;
    this.aboutScrollMat = mat;
    this.scene.add(group);

    // Project artefacts (hidden until Accio)
    for (const p of portfolio.projects) {
      const a = buildArtefact(p);
      a.group.visible = false;
      this.scene.add(a.group);
      this.artefacts.push(a);
    }

    // Patronus
    const stagCount = Math.round(5200 * Math.max(0.35, q.particles));
    this.stag = new Stag(stagCount, softDot());
    this.stagLight = new THREE.PointLight(0xc4d8ff, 0, 22, 1.4);
    this.stagLight.position.set(0.3, 1.8, 0.8);
    this.stag.group.add(this.stagLight);
    this.stag.group.visible = false;
    this.scene.add(this.stag.group);

    this.wand = new Wand(this.camera);

    // labels for artefacts
    this.labelsEl = $(`<div class="artefact-labels" aria-label="Summoned projects"></div>`);
    this.artefacts.forEach((a, i) => {
      const b = $<HTMLButtonElement>(`<button type="button" class="artefact-label">${a.project.name}<small>${a.project.tagline}</small></button>`);
      b.addEventListener('click', () => {
        audio.ui();
        this.inspect(i);
      });
      b.addEventListener('pointerenter', () => (this.hovered = a));
      b.addEventListener('pointerleave', () => (this.hovered = null));
      b.tabIndex = -1;
      this.labelsEl.append(b);
      this.labelBtns.push(b);
    });

    // canvas picking for artefacts
    const canvas = ctx.engine.canvas;
    const onMove = (e: PointerEvent) => {
      if (!this.summoned || this.inspecting) return;
      const hit = this.pick(e);
      this.hovered = hit;
      canvas.style.cursor = hit ? 'pointer' : '';
    };
    const onClick = (e: PointerEvent) => {
      if (!this.summoned || this.busy) return;
      const hit = this.pick(e);
      if (hit && hit !== this.inspecting) this.inspect(this.artefacts.indexOf(hit));
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('click', onClick as EventListener);
    const offArrow = onArrow((d) => {
      if (this.inspecting) this.inspect((this.artefacts.indexOf(this.inspecting) + d + this.artefacts.length) % this.artefacts.length);
    });
    this.onDispose(() => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('click', onClick as EventListener);
      canvas.style.cursor = '';
      offArrow();
      this.labelsEl.remove();
      this.wand.dispose();
      this.sparks.dispose();
      this.stag.dispose();
    });

    this.camera.position.set(0, EYE, this.camZ);
  }

  /* ── Construction helpers ─────────────────────────────────────────── */

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
    g.font = '400 52px "IM Fell English", Georgia, serif';
    g.fillText(portfolio.name.split(' ')[0] ?? portfolio.name, 256, 190);
    g.fillText(portfolio.name.split(' ').slice(1).join(' '), 256, 250);
    g.font = 'italic 26px "Cormorant Garamond", Georgia, serif';
    g.fillStyle = '#4a3020';
    wrap(g, portfolio.about.heading, 256, 320, 380, 32);
    g.font = '22px "Cormorant Garamond", Georgia, serif';
    let y = 420;
    for (const it of portfolio.about.interests.slice(0, 4)) {
      y = wrap(g, '✦ ' + it, 256, y, 400, 28) + 14;
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide, emissive: 0xffe2b0, emissiveMap: tex, emissiveIntensity: 0.32, transparent: true, opacity: 0 });
    // gently curled sheet
    const geo = new THREE.PlaneGeometry(1.25, 1.66, 24, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setZ(i, -Math.pow(Math.abs(x) / 0.625, 3) * 0.12);
    }
    geo.computeVertexNormals();
    const sheet = new THREE.Mesh(geo, mat);
    const group = new THREE.Group();
    group.add(sheet);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x5a3418, roughness: 0.5 });
    for (const y of [0.86, -0.86]) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.42, 10), rodMat);
      rod.rotation.z = Math.PI / 2;
      rod.position.y = y;
      group.add(rod);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xffc880, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(3, 3.4, 1);
    glow.position.z = -0.2;
    group.add(glow);
    group.visible = false;
    return { group, mat };
  }

  private updateCandles(t: number) {
    const m = new THREE.Matrix4();
    const bob = settings.get().reducedMotion ? 0 : 0.08;
    const seeds = this.candleFlames.seeds;
    for (let i = 0; i < this.candlePos.length; i++) {
      const p = this.candlePos[i];
      m.makeTranslation(p.x, p.y + Math.sin(t * 0.8 + seeds[i]) * bob, p.z);
      this.candles.setMatrixAt(i, m);
    }
    this.candles.instanceMatrix.needsUpdate = true;
  }

  private pick(e: PointerEvent): Artefact | null {
    const r = this.ctx.engine.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.artefacts.filter((a) => a.group.visible).map((a) => a.hit), false);
    if (!hits.length) return null;
    return this.artefacts.find((a) => a.hit === hits[0].object) ?? null;
  }

  /* ── State helpers ────────────────────────────────────────────────── */

  private walkTo(z: number, seconds?: number) {
    const d = Math.abs(z - this.camZ);
    const reduced = settings.get().reducedMotion;
    const t = seconds ?? (reduced ? 0.6 : Math.min(4.2, 1 + d / 9));
    return new Promise<void>((resolve) => {
      this.track(
        gsap.to(this, {
          camZ: z,
          duration: d < 0.01 ? 0.01 : t,
          ease: 'power2.inOut',
          onUpdate: () => void (this.walking = 1),
          onComplete: () => {
            this.walking = 0;
            resolve();
          },
        }),
      );
    });
  }

  /** Lights on, instantly (used when jumping straight into a later section). */
  private applyLit() {
    this.phase = 'lit';
    this.litFront = -999;
    this.candleLit.fill(1);
    this.candleFlames.setAll(1);
    this.torchLit.fill(1);
    this.torchFlames.setAll(1);
    this.hemi.intensity = 0.42;
    this.hemi.color.set(0x8a7a6a);
    this.torchLights.forEach((l) => (l.base = this.torchBase));
    (this.scene.fog as THREE.FogExp2).density = 0.03;
    (this.scene.fog as THREE.FogExp2).color.set(0x0c0907);
    this.motes.material.uniforms.uOpacity.value = 0.8;
    this.wand.glowLevel = 0.35;
    this.wand.light.intensity = 1.2;
    this.exposure = 1;
  }

  /** Return from the silver Patronus tint to warm candlelight. */
  private restoreWarm(instant = false) {
    const fog = this.scene.fog as THREE.FogExp2;
    const d = instant ? 0 : 1.2;
    this.track(gsap.to(this.stag.material.uniforms.uFade, { value: 0, duration: d, onComplete: () => void (this.stag.group.visible = false) }));
    this.track(gsap.to(this.stagLight, { intensity: 0, duration: d }));
    this.track(gsap.to(this.hemi.color, { r: 0x8a / 255, g: 0x7a / 255, b: 0x6a / 255, duration: d }));
    this.track(gsap.to(fog.color, { r: 0x0c / 255, g: 0x09 / 255, b: 0x07 / 255, duration: d }));
    this.track(gsap.to(this.bloom, { strength: 0.85, duration: d }));
    this.torchLights.forEach((l) => this.track(gsap.to(l, { base: this.torchBase, duration: d })));
    this.wand.setColor(0xfff1d0);
    this.phase = 'lit';
  }

  private castFx(color: THREE.ColorRepresentation, count = 60) {
    const tip = this.wand.tipWorld();
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    this.sparks.emit({ position: tip, velocity: fwd.multiplyScalar(2.5), spread: 1.6, life: [0.4, 1.1], size: [0.06, 0.01], color, color2: 0xffffff, drag: 2.5, count });
  }

  /* ── Lifecycle ────────────────────────────────────────────────────── */

  enter(section?: Section) {
    audio.ambience('corridor');
    document.getElementById('ui')!.prepend(this.labelsEl);
    if (section && section !== 'station' && section !== 'lake') {
      // start a few steps before the requested stop so the arrival still feels like walking
      const stop = section === 'projects' ? STOP.projects : section === 'aspirations' ? STOP.aspirations : STOP.about;
      this.camZ = stop + 5;
      this.goToSection(section);
      return;
    }
    // natural arrival from the boat: a few steps into the dark
    this.camZ = HALL_START - 3;
    ui.hint('The corridor is pitch dark. Raise your wand.');
    const tl = gsap.timeline();
    tl.to(this, { camZ: STOP.about, duration: dur(3.6, 0.4), ease: 'power2.out', onUpdate: () => void (this.walking = 1), onComplete: () => void (this.walking = 0) });
    this.playCinematic(tl, () => {
      this.walking = 0;
      this.offerCast('Lumos', 'Light the way', () => this.castLumos());
    });
  }

  private offerCast(name: string, sub: string, fn: () => void) {
    this.pendingCast = fn;
    ui.showCast(name, () => {
      this.pendingCast = null;
      fn();
    }, sub);
  }

  primary() {
    if (this.pendingCast) {
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

  goToSection(section: Section) {
    if (this.busy) return;
    this.cine?.progress(1);
    this.pendingCast = null;
    ui.hideActions();
    if (this.inspecting) this.exitInspect(true);
    ui.closePanel(true);
    if (section === 'about') {
      if (this.phase === 'patronus') this.restoreWarm();
      this.walkTo(STOP.about).then(() => {
        if (this.phase === 'dark') this.castLumos();
        else this.revealAbout(true);
      });
    } else if (section === 'projects') {
      if (this.phase === 'dark') this.applyLit();
      if (this.phase === 'patronus') this.restoreWarm();
      this.walkTo(STOP.projects).then(() => {
        if (!this.summoned) this.castAccio();
        else this.afterSummon();
      });
    } else if (section === 'aspirations') {
      if (this.phase === 'dark') this.applyLit();
      this.walkTo(STOP.aspirations).then(() => {
        if (this.phase !== 'patronus') this.castPatronus();
        else this.revealAspirations();
      });
    }
  }

  /* ── LUMOS ────────────────────────────────────────────────────────── */

  private async castLumos() {
    if (this.busy) return;
    this.busy = true;
    ui.hint(null);
    await this.wand.flick();
    audio.lumos();
    this.ctx.engine.flash(0.18, 0xfff0d0);
    this.castFx(0xffe2a0, 80);
    const reduced = settings.get().reducedMotion;
    const tl = gsap.timeline({ onComplete: () => void (this.busy = false) });
    this.track(tl);
    // wand tip blazes, then settles to a steady glow
    tl.to(this.wand, { glowLevel: 1, duration: 0.25 }, 0);
    tl.to(this.wand.light, { intensity: 8, duration: 0.25 }, 0);
    tl.to(this.wand, { glowLevel: 0.35, duration: 1.5 }, 0.6);
    tl.to(this.wand.light, { intensity: 1.2, duration: 1.5 }, 0.6);
    // orb of light races down the corridor; everything it passes ignites
    const start = this.wand.tipWorld();
    this.orb.position.copy(start);
    const orbMat = this.orb.material as THREE.SpriteMaterial;
    tl.to(orbMat, { opacity: 1, duration: 0.2 }, 0.05);
    tl.to(this.orbLight, { intensity: 30, duration: 0.3 }, 0.05);
    tl.to(this.orb.position, { x: 0, y: 4.2, z: DOOR_Z + 2, duration: reduced ? 1 : 2.8, ease: 'power1.in', onUpdate: () => void (this.litFront = this.orb.position.z + 2) }, 0.1);
    tl.to(orbMat, { opacity: 0, duration: 0.6 }, reduced ? 1 : 2.6);
    tl.to(this.orbLight, { intensity: 0, duration: 0.6 }, reduced ? 1 : 2.6);
    tl.call(() => void (this.litFront = -999), [], reduced ? 1.1 : 2.9);
    // ambient fill, fog thins and warms
    const fog = this.scene.fog as THREE.FogExp2;
    tl.to(this.hemi, { intensity: 0.42, duration: 2.5 }, 0.2);
    tl.to(this.hemi.color, { r: 0x8a / 255, g: 0x7a / 255, b: 0x6a / 255, duration: 2.5 }, 0.2);
    tl.to(fog, { density: 0.03, duration: 2.5 }, 0.2);
    tl.to(fog.color, { r: 0x0c / 255, g: 0x09 / 255, b: 0x07 / 255, duration: 2.5 }, 0.2);
    tl.to(this, { exposure: 1, duration: 2 }, 0.2);
    tl.to(this.motes.material.uniforms.uOpacity, { value: 0.8, duration: 2 }, 0.5);
    this.phase = 'lit';
    this.ctx.director.markVisited('about');
    tl.call(() => this.revealAbout(false), [], reduced ? 0.8 : 1.6);
  }

  /** Golden motes stream to a point in the air; the parchment unfurls there. */
  private revealAbout(again: boolean) {
    const portrait = window.innerHeight > window.innerWidth;
    const target = portrait || isMobile ? new THREE.Vector3(0, 2.75, STOP.about - 3.6) : new THREE.Vector3(-1.05, 1.85, STOP.about - 3.2);
    const s = this.aboutScroll;
    s.position.copy(target);
    s.lookAt(this.camera.position.x, target.y - 0.1, this.camera.position.z);
    s.visible = true;
    const sheetScale = portrait ? 0.82 : 1;
    if (!again) {
      // stream of motes from the wand to the parchment
      const tip = this.wand.tipWorld();
      for (let i = 0; i < 70; i++) {
        const v = target.clone().sub(tip).multiplyScalar(1.1 + Math.random() * 0.4);
        this.sparks.emit({ position: tip, velocity: v, spread: 0.25, life: [0.7, 1.1], size: [0.05, 0.02], color: 0xffd07a, color2: 0xfff4d8, drag: 1.2 });
      }
    }
    s.scale.set(sheetScale, 0.02, sheetScale);
    this.aboutScrollMat.opacity = 0;
    const tl = gsap.timeline({ delay: again ? 0 : 0.6 });
    tl.to(this.aboutScrollMat, { opacity: 1, duration: 0.5 }, 0);
    tl.to(s.scale, { y: sheetScale, duration: dur(1.2, 0.3), ease: 'back.out(1.4)' }, 0);
    tl.call(() => {
      ui.openPanel({
        variant: 'parchment',
        eyebrow: 'Lumos · About me',
        title: portfolio.about.heading,
        body: aboutBody(),
        closeLabel: 'Close the parchment',
        onClose: () => this.afterAbout(),
      });
      ui.hint(null);
    }, [], 0.5);
    this.track(tl);
  }

  private afterAbout() {
    ui.showAction('Walk on', () => this.toProjects(), { label: 'Read again', onClick: () => this.revealAbout(true) });
  }

  private async toProjects() {
    ui.hint(null);
    this.track(gsap.to(this.aboutScroll.scale, { y: 0.02, duration: 0.6, onComplete: () => void (this.aboutScroll.visible = false) }));
    await this.walkTo(STOP.projects);
    if (this.summoned) return this.afterSummon();
    ui.hint('Somewhere in the dark, your work is waiting to be called.');
    this.offerCast('Accio', 'Summon my projects', () => this.castAccio());
  }

  /* ── ACCIO ────────────────────────────────────────────────────────── */

  private slot(i: number) {
    const n = this.artefacts.length;
    const portrait = window.innerHeight > window.innerWidth;
    const spread = portrait ? 0.82 : 1.35;
    const x = (i - (n - 1) / 2) * spread;
    return new THREE.Vector3(x, (portrait ? 2.25 : 1.85) + Math.abs(x) * 0.08, STOP.projects - (portrait ? 4.4 : 3.6) + Math.abs(x) * 0.25);
  }

  private async castAccio() {
    if (this.busy) return;
    this.busy = true;
    ui.hint(null);
    await this.wand.flick();
    audio.accio();
    this.castFx(0xffc870, 70);
    this.ctx.engine.flash(0.12, 0xffe0b0);
    const reduced = settings.get().reducedMotion;
    // the wand pulls: its light reaches into the dark end
    this.track(gsap.fromTo(this.wand, { glowLevel: 1 }, { glowLevel: 0.35, duration: 1.4 }));
    const tl = gsap.timeline({
      onComplete: () => {
        this.busy = false;
        this.summoned = true;
        this.ctx.director.markVisited('projects');
        this.afterSummon();
      },
    });
    this.track(tl);
    this.artefacts.forEach((a, i) => {
      const from = new THREE.Vector3((i - 1) * 2.2, 3 + (i % 2), DOOR_Z + 4);
      const to = this.slot(i);
      const ctrl1 = from.clone().lerp(to, 0.35).add(new THREE.Vector3((i - 1) * 2.5, 2.2, 0));
      const ctrl2 = from.clone().lerp(to, 0.75).add(new THREE.Vector3(-(i - 1) * 1.2, 0.8, 0));
      const curve = new THREE.CatmullRomCurve3([from, ctrl1, ctrl2, to]);
      const o = { t: 0 };
      a.group.position.copy(from);
      a.group.scale.setScalar(0.4);
      tl.call(() => {
        a.group.visible = true;
        this.flying.add(a);
      }, [], i * 0.35);
      tl.to(o, {
        t: 1,
        duration: reduced ? 0.8 : 2.4,
        ease: 'power2.inOut',
        onUpdate: () => {
          curve.getPointAt(o.t, a.group.position);
          a.body.rotation.y = (1 - o.t) * Math.PI * 4;
          a.body.rotation.x = Math.sin(o.t * Math.PI) * 0.6;
          a.group.scale.setScalar(0.4 + o.t * 0.6);
        },
        onComplete: () => {
          this.flying.delete(a);
          a.body.rotation.set(0, 0, 0);
          audio.arrive();
          this.sparks.emit({ position: a.group.position, spread: 1.2, life: [0.3, 0.8], size: [0.05, 0.01], color: 0xffe0a0, drag: 3, count: 30 });
        },
      }, i * 0.35);
    });
  }

  private afterSummon() {
    this.labelBtns.forEach((b) => {
      b.classList.add('on');
      b.tabIndex = 0;
    });
    ui.hint(isMobile ? 'Tap an artefact to inspect it.' : 'Choose an artefact to inspect it.');
    ui.showAction('Walk on', () => this.toAspirations());
  }

  private inspect(i: number) {
    const a = this.artefacts[i];
    if (!a || !this.summoned || this.flying.size) return;
    const prev = this.inspecting;
    this.inspecting = a;
    this.hovered = null;
    ui.hideActions();
    ui.hint(null);
    this.labelBtns.forEach((b) => b.classList.remove('on'));
    const portrait = window.innerHeight > window.innerWidth;
    const dest = portrait || isMobile ? new THREE.Vector3(0, 2.2, STOP.projects - 2.9) : new THREE.Vector3(-1.0, 1.7, STOP.projects - 2.75);
    const d = dur(0.9, 0.3);
    this.artefacts.forEach((o, j) => {
      if (o === a) return;
      const s = this.slot(j);
      this.track(gsap.to(o.group.position, { x: s.x * 1.4, y: s.y + 0.5, z: s.z - 1.2, duration: d, ease: 'power2.out' }));
      this.track(gsap.to(o.group.scale, { x: 0.6, y: 0.6, z: 0.6, duration: d }));
      o.setOpen(0);
    });
    if (prev && prev !== a) prev.setOpen(0);
    this.track(gsap.to(a.group.position, { x: dest.x, y: dest.y, z: dest.z, duration: d, ease: 'power3.out' }));
    this.track(gsap.to(a.group.scale, { x: 1, y: 1, z: 1, duration: d }));
    const open = { v: 0 };
    this.track(gsap.to(open, { v: 1, duration: dur(1.1, 0.3), delay: 0.3, ease: 'power2.out', onUpdate: () => a.setOpen(open.v) }));
    this.lookFocus = dest.clone().lerp(new THREE.Vector3(0, EYE, STOP.projects - 10), 0.6);
    this.sparks.emit({ position: dest, spread: 0.8, life: [0.4, 1], size: [0.04, 0.01], color: 0xffd890, drag: 2.5, count: 26 });
    audio.page();

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
    ui.openPanel({
      variant: 'project',
      eyebrow: `Accio · Project ${i + 1} of ${n}`,
      title: a.project.name,
      body,
      closeLabel: 'Return to the corridor',
      onClose: () => this.exitInspect(),
    });
  }

  private exitInspect(instant = false) {
    const a = this.inspecting;
    this.inspecting = null;
    this.lookFocus = null;
    const d = instant ? 0 : dur(0.8, 0.3);
    this.artefacts.forEach((o, j) => {
      const s = this.slot(j);
      this.track(gsap.to(o.group.position, { x: s.x, y: s.y, z: s.z, duration: d, ease: 'power2.inOut' }));
      this.track(gsap.to(o.group.scale, { x: 1, y: 1, z: 1, duration: d }));
    });
    a?.setOpen(0);
    if (!instant) this.afterSummon();
  }

  private async toAspirations() {
    ui.hint(null);
    this.labelBtns.forEach((b) => {
      b.classList.remove('on');
      b.tabIndex = -1;
    });
    await this.walkTo(STOP.aspirations);
    if (this.phase === 'patronus') return this.revealAspirations();
    ui.hint('A cold draught. Think of the future you are walking toward.');
    this.offerCast('Expecto Patronum', 'Call your guide', () => this.castPatronus());
  }

  /* ── EXPECTO PATRONUM ─────────────────────────────────────────────── */

  private stagHome() {
    const portrait = window.innerHeight > window.innerWidth;
    return portrait || isMobile ? new THREE.Vector3(-0.5, 0, STOP.aspirations - 7.2) : new THREE.Vector3(-1.6, 0, STOP.aspirations - 5.6);
  }

  private async castPatronus() {
    if (this.busy) return;
    this.busy = true;
    ui.hint(null);
    this.wand.setColor(0xd8e6ff);
    await this.wand.flick();
    audio.patronus();
    this.castFx(0xcfe0ff, 120);
    this.ctx.engine.flash(0.3, 0xdfe9ff);
    const reduced = settings.get().reducedMotion;
    const g = this.stag.group;
    g.position.copy(this.stagHome());
    g.rotation.set(0, 0.25, 0);
    g.visible = true;
    const u = this.stag.material.uniforms;
    u.uForm.value = 0;
    u.uGait.value = 0;
    u.uFade.value = 1;
    g.updateMatrixWorld();
    u.uSource.value.copy(g.worldToLocal(this.wand.tipWorld()));
    const fog = this.scene.fog as THREE.FogExp2;
    const tl = gsap.timeline({
      onComplete: () => {
        this.busy = false;
        this.ctx.director.markVisited('aspirations');
        this.revealAspirations();
      },
    });
    this.track(tl);
    tl.to(this.wand, { glowLevel: 1.2, duration: 0.4 }, 0);
    tl.to(this.wand.light, { intensity: 10, duration: 0.4 }, 0);
    tl.to(u.uForm, { value: 1, duration: reduced ? 1 : 3.6, ease: 'power1.inOut' }, 0.1);
    tl.to(this.stagLight, { intensity: 22, duration: 2.5 }, 0.6);
    // the hall turns silver: torches bow down, cool fill rises
    tl.to(this.hemi.color, { r: 0.55, g: 0.65, b: 0.9, duration: 2.5 }, 0.4);
    tl.to(fog.color, { r: 0.05, g: 0.07, b: 0.12, duration: 2.5 }, 0.4);
    this.torchLights.forEach((l) => tl.to(l, { base: this.torchBase * 0.35, duration: 2.5 }, 0.4));
    tl.to(this.bloom, { strength: 1.0, duration: 2 }, 0.4);
    tl.to(this.wand, { glowLevel: 0.4, duration: 1.4 }, 2);
    tl.to(this.wand.light, { intensity: 1.5, duration: 1.4 }, 2);
    // stag takes a few proud steps and lifts its head
    tl.to(u.uGait, { value: 0.25, duration: 0.6 }, reduced ? 1 : 3.4);
    tl.to(g.position, { x: g.position.x + 0.5, duration: 1.2, ease: 'sine.inOut' }, reduced ? 1 : 3.4);
    tl.to(u.uGait, { value: 0, duration: 0.6 }, reduced ? 1.4 : 4.4);
    this.phase = 'patronus';
  }

  private revealAspirations() {
    ui.openPanel({
      variant: 'patronus',
      eyebrow: 'Expecto Patronum · Aspirations',
      title: portfolio.aspirations.heading,
      body: aspirationsBody(),
      closeLabel: 'Close',
      onClose: () => ui.showAction('Follow the Patronus', () => this.followPatronus(), { label: 'Read again', onClick: () => this.revealAspirations() }),
    });
  }

  private async followPatronus() {
    if (this.busy) return;
    this.busy = true;
    ui.hint(null);
    audio.gallop();
    const g = this.stag.group;
    const u = this.stag.material.uniforms;
    const reduced = settings.get().reducedMotion;
    const tl = gsap.timeline();
    tl.to(g.rotation, { y: Math.PI / 2, duration: 0.8, ease: 'power2.inOut' }, 0);
    tl.to(g.position, { x: 0, duration: 0.8 }, 0);
    tl.to(u.uGait, { value: 1, duration: 0.6 }, 0.3);
    tl.to(g.position, { z: DOOR_Z + 1.5, duration: reduced ? 1 : 3.8, ease: 'power1.in' }, 0.4);
    tl.to(this, { camZ: STOP.door, duration: reduced ? 1 : 4.4, ease: 'power2.inOut', onUpdate: () => void (this.walking = 1) }, 0.6);
    // door runes answer the Patronus
    const runes = { v: 0 };
    tl.to(runes, { v: 1, duration: 1.6, onUpdate: () => this.door.setRunes(runes.v, 0xcfe0ff) }, reduced ? 1 : 3.2);
    tl.to(u.uFade, { value: 0, duration: 0.8 }, reduced ? 1.4 : 4.2);
    tl.call(() => this.ctx.engine.flash(0.6, 0xe0ecff), [], reduced ? 1.4 : 4.3);
    tl.to({}, { duration: 0.5 });
    this.playCinematic(tl, () => {
      this.walking = 0;
      this.busy = false;
      this.ctx.director.next('silver');
    });
  }

  /* ── Frame ────────────────────────────────────────────────────────── */

  update(dt: number, t: number) {
    super.update(dt, t);
    const reduced = settings.get().reducedMotion;
    // camera: walk with a gentle step bob; drift toward the pointer
    if (this.walking) this.walkPhase += dt * 7;
    const bob = reduced ? 0 : this.walking * 0.035;
    const pt = this.ctx.engine.pointer;
    const sway = reduced ? 0 : 1;
    this.camera.position.set(pt.x * 0.12 * sway, EYE + Math.abs(Math.sin(this.walkPhase)) * bob, this.camZ);
    const lookTarget = this.lookFocus ?? new THREE.Vector3(pt.x * 1.4 * sway, EYE + pt.y * 0.8 * sway, this.camZ - 10);
    this.look.lerp(lookTarget, 1 - Math.pow(0.02, dt));
    this.camera.lookAt(this.look);
    this.camera.updateMatrixWorld();

    this.wand.update(dt, pt);
    this.updateCandles(t);
    this.candleFlames.update(t);
    this.torchFlames.update(t);
    for (const s of this.hall.shafts) s.uniforms.uTime.value = t;
    this.motes.update(t);
    this.motes.follow(new THREE.Vector3(0, 3.5, this.camZ - 8));
    this.door.ringMat.uniforms.uTime.value = t;

    // progressive ignition as the Lumos orb passes
    if (this.litFront < 98) {
      let dirty = false;
      for (let i = 0; i < this.candlePos.length; i++) {
        if (this.candleLit[i] < 1 && this.candlePos[i].z > this.litFront) {
          this.candleLit[i] = Math.min(1, this.candleLit[i] + dt * 3);
          this.candleFlames.setLit(i, this.candleLit[i]);
          dirty = true;
        }
      }
      const tp = this.hall.torchPositions;
      for (let i = 0; i < tp.length; i++) {
        if (this.torchLit[i] < 1 && tp[i].z > this.litFront) {
          this.torchLit[i] = Math.min(1, this.torchLit[i] + dt * 2);
          this.torchFlames.setLit(i, this.torchLit[i]);
          dirty = true;
        }
      }
      for (const l of this.torchLights) if (l.position.z > this.litFront && l.base < this.torchBase && this.phase !== 'patronus') l.base = Math.min(this.torchBase, l.base + dt * 20);
      if (!dirty && this.litFront < -500) this.litFront = 99;
    }
    for (const l of this.torchLights) l.update(t);

    // trails for artefacts in flight
    for (const a of this.flying) {
      this.sparks.emit({ position: a.group.position, spread: 0.25, life: [0.4, 0.9], size: [0.05, 0.01], color: 0xffd080, color2: new THREE.Color(a.project.color).lerp(new THREE.Color(0xffffff), 0.5), drag: 1.5, count: 2 });
    }
    // Lumos orb trail
    if ((this.orb.material as THREE.SpriteMaterial).opacity > 0.05) {
      this.sparks.emit({ position: this.orb.position, spread: 0.4, life: [0.5, 1.2], size: [0.07, 0.01], color: 0xffe8c0, drag: 1, count: 3 });
    }
    this.sparks.update(dt);

    // artefacts idle: float, turn, glow on hover
    this.artefacts.forEach((a, i) => {
      if (!a.group.visible) return;
      a.update(dt, t);
      if (!this.flying.has(a)) {
        const isInspect = a === this.inspecting;
        const hover = a === this.hovered;
        a.body.position.y = Math.sin(t * 1.1 + i) * (reduced ? 0 : 0.05);
        if (isInspect) {
          a.body.rotation.y = THREE.MathUtils.lerp(a.body.rotation.y, 0.35 + Math.sin(t * 0.5) * 0.25 * sway, 1 - Math.pow(0.05, dt));
        } else {
          a.body.rotation.y += dt * (hover ? 1.2 : 0.35) * sway;
        }
        const gm = a.glow.material as THREE.SpriteMaterial;
        gm.opacity = THREE.MathUtils.lerp(gm.opacity, hover || isInspect ? 0.7 : 0.3, 1 - Math.pow(0.01, dt));
      }
    });
    this.labelBtns.forEach((b, i) => b.classList.toggle('hover', this.artefacts[i] === this.hovered));

    // project DOM labels under each artefact
    if (this.summoned && !this.inspecting) {
      const v = new THREE.Vector3();
      const w = this.ctx.engine.width, h = this.ctx.engine.height;
      this.artefacts.forEach((a, i) => {
        v.copy(a.group.position).add(new THREE.Vector3(0, -0.62, 0)).project(this.camera);
        this.labelBtns[i].style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, 0)`;
      });
    }

    if (this.stag.group.visible) {
      this.stag.update(t);
      if (this.phase === 'patronus' && this.stag.material.uniforms.uGait.value > 0.5) {
        this.sparks.emit({ position: this.stag.group.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.3 + Math.random() * 1.5, 0.8)), spread: 0.3, life: [0.6, 1.4], size: [0.06, 0.01], color: 0xcfe0ff, drag: 1, count: 3 });
      }
    }
  }

  dispose() {
    ui.hint(null);
    super.dispose();
  }
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
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

export default (ctx: SceneContext) => new CorridorScene(ctx);
