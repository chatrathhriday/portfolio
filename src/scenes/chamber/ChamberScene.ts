/**
 * SCENE 4 — The last spell. The visitor stands before the great door.
 * ALOHOMORA lights the rune lock ring by ring, the lock spins, and the doors
 * burst open in a flood of gold. Beyond is a round chamber under an enchanted
 * night sky, full of floating candles, where the contact parchment waits.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { BaseScene } from '../BaseScene';
import type { SceneContext, Section } from '../../core/types';
import { buildHall } from '../../world/hall';
import { buildDoor, type Door } from '../../world/door';
import { Wand } from '../../fx/wand';
import { DriftField, ParticlePool } from '../../fx/particles';
import { Flames, FlickerLight, makeSky } from '../../fx/atmosphere';
import { flagstones, parchment, softDot, stoneBlocks } from '../../core/textures';
import { audio } from '../../core/audio';
import { settings, dur } from '../../core/settings';
import { isMobile } from '../../core/quality';
import { ui } from '../../ui/ui';
import { contactBody } from '../../ui/content';
import { portfolio } from '../../content/portfolio';

const EYE = 1.7;
const DOOR_Z = -4;
const ROOM_Z = -20; // chamber centre
const ROOM_R = 13;

class ChamberScene extends BaseScene {
  readonly id = 'chamber' as const;
  private door: Door;
  private wand: Wand;
  private sky: ReturnType<typeof makeSky>;
  private sparks: ParticlePool;
  private motes: DriftField;
  private candleFlames!: Flames;
  private candles!: THREE.InstancedMesh;
  private candlePos: THREE.Vector3[] = [];
  private lights: FlickerLight[] = [];
  private roomLight: THREE.PointLight;
  private hemi: THREE.HemisphereLight;
  private beam: THREE.Mesh;
  private beamMat: THREE.MeshBasicMaterial;
  private scroll: THREE.Group;
  private scrollMat: THREE.MeshStandardMaterial;
  private camPos = new THREE.Vector3(0, EYE, 4);
  private look = new THREE.Vector3(0, 2.6, DOOR_Z);
  private lookTarget = new THREE.Vector3(0, 2.6, DOOR_Z);
  private opened = false;
  private busy = false;
  private pendingCast: (() => void) | null = null;

  constructor(ctx: SceneContext) {
    super(ctx);
    const q = ctx.engine.quality;
    this.baseFov = 58;
    this.bloom = { strength: 0.9, radius: 0.6, threshold: 0.78 };
    this.exposure = 1;
    this.scene.background = new THREE.Color(0x03050a);
    this.scene.fog = new THREE.FogExp2(0x07080c, 0.03);

    // vestibule: short stretch of corridor leading to the door
    const hall = buildHall({ zStart: 8, length: 12, windows: false });
    this.scene.add(hall.group);
    const torchFlames = new Flames(hall.torchPositions.map((p) => p.clone().add(new THREE.Vector3(p.x > 0 ? -0.05 : 0.05, 0.22, 0))), 0.55, 0xff9a40, 1);
    this.scene.add(torchFlames);
    this.updaters.push((_d, t) => torchFlames.update(t));
    for (const x of [-2.6, 2.6]) {
      const l = new FlickerLight(0xff9a40, 24, 14, 1.6);
      l.position.set(x, 3.6, -1.6);
      this.scene.add(l);
      this.lights.push(l);
    }
    this.hemi = new THREE.HemisphereLight(0x8a7a6a, 0x120c08, 0.4);
    this.scene.add(this.hemi);

    // the door, in a wall that separates vestibule and chamber
    this.door = buildDoor();
    this.door.group.position.set(0, 0, DOOR_Z);
    this.scene.add(this.door.group);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 1 });
    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(12, 14, 0.8), wallMat);
      w.position.set(side * (this.door.width / 2 + 1.1 + 6), 7, DOOR_Z - 0.4);
      this.scene.add(w);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 0.8), wallMat);
    lintel.position.set(0, 11.6, DOOR_Z - 0.4);
    this.scene.add(lintel);

    // the round chamber beyond
    this.buildChamber(q.candles);

    // enchanted ceiling: the real night sky
    this.sky = makeSky({ top: 0x050c22, horizon: 0x1a2440, moonDir: new THREE.Vector3(-0.3, 0.8, -0.5), stars: 1.6, clouds: 0.7 });
    this.scene.add(this.sky.mesh);

    // the burst of light from the doorway
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0xffe8b8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, map: beamTexture() });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 5, 10, 24, 1, true), this.beamMat);
    this.beam.rotation.x = Math.PI / 2;
    this.beam.position.set(0, 3, DOOR_Z + 5);
    this.scene.add(this.beam);
    this.roomLight = new THREE.PointLight(0xffd8a0, 0, 40, 1.4);
    this.roomLight.position.set(0, 5, DOOR_Z - 3);
    this.scene.add(this.roomLight);

    this.sparks = new ParticlePool(Math.round(900 * Math.max(0.5, q.particles)));
    this.scene.add(this.sparks.points);
    this.motes = new DriftField({ count: Math.round(400 * q.particles), box: new THREE.Vector3(24, 12, 24), center: new THREE.Vector3(0, 6, ROOM_Z), color: 0xffd38a, size: 0.05, speed: 0.3, rise: 0.6, opacity: 0.9 });
    this.scene.add(this.motes);

    const { group, mat } = this.buildScroll();
    this.scroll = group;
    this.scrollMat = mat;
    this.scene.add(group);

    this.wand = new Wand(this.camera);
    this.onDispose(() => {
      this.wand.dispose();
      this.sparks.dispose();
    });
    this.camera.position.copy(this.camPos);
  }

  private buildChamber(nCandles: number) {
    const stone = stoneBlocks('chamber', { rows: 8, cols: 4, tint: [104, 96, 88], seed: 61 });
    const map = stone.map.clone();
    map.repeat.set(10, 3);
    const nmap = stone.normalMap.clone();
    nmap.repeat.copy(map.repeat);
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(ROOM_R, ROOM_R, 13, 48, 1, true),
      new THREE.MeshStandardMaterial({ map, normalMap: nmap, roughness: 0.9, side: THREE.BackSide, color: 0xb0a698 }),
    );
    wall.position.set(0, 6.5, ROOM_Z);
    this.scene.add(wall);
    const flags = flagstones(33);
    const fmap = flags.map.clone();
    fmap.repeat.set(8, 8);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(ROOM_R, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: fmap, roughness: 0.35, color: 0x9a948c }));
    floor.position.set(0, 0.01, ROOM_Z);
    this.scene.add(floor);
    // gallery ring and tall banners
    const ring = new THREE.Mesh(new THREE.TorusGeometry(ROOM_R - 0.3, 0.25, 8, 64), new THREE.MeshStandardMaterial({ color: 0x5a5048, roughness: 0.8 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 13, ROOM_Z);
    this.scene.add(ring);
    const bannerMat = new THREE.MeshStandardMaterial({ color: 0x5a1414, roughness: 0.85, side: THREE.DoubleSide });
    const trim = new THREE.MeshStandardMaterial({ color: 0xc9a14f, metalness: 0.8, roughness: 0.35 });
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + (i - 2.5) * 0.42;
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 6, 1, 6), bannerMat);
      const x = Math.sin(a) * (ROOM_R - 0.2), z = ROOM_Z + Math.cos(a) * (ROOM_R - 0.2);
      b.position.set(x, 7.5, z);
      b.lookAt(0, 7.5, ROOM_Z);
      this.scene.add(b);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.9), trim);
      rod.rotation.z = Math.PI / 2;
      rod.position.copy(b.position).setY(10.55);
      rod.lookAt(0, 10.55, ROOM_Z);
      rod.rotateY(Math.PI / 2);
      rod.rotateZ(Math.PI / 2);
      this.scene.add(rod);
    }
    // pedestal
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 1.1, 8), new THREE.MeshStandardMaterial({ map: stone.map, color: 0xb0a698, roughness: 0.8 }));
    ped.position.set(0, 0.55, ROOM_Z + 3);
    this.scene.add(ped);
    // candles
    for (let i = 0; i < nCandles * 2; i++) {
      const r = Math.sqrt(Math.random()) * (ROOM_R - 1.5);
      const a = Math.random() * Math.PI * 2;
      this.candlePos.push(new THREE.Vector3(Math.sin(a) * r, 5 + Math.random() * 6, ROOM_Z + Math.cos(a) * r));
    }
    const geo = new THREE.CylinderGeometry(0.04, 0.045, 0.36, 8);
    geo.translate(0, -0.18, 0);
    this.candles = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xf2e6cc, emissive: 0x403020, emissiveIntensity: 0.3 }), this.candlePos.length);
    this.scene.add(this.candles);
    this.candleFlames = new Flames(this.candlePos.map((p) => p.clone().add(new THREE.Vector3(0, 0.08, 0))), 0.26, 0xffb050, 1);
    this.candleFlames.material.uniforms.uBob.value = settings.get().reducedMotion ? 0 : 0.1;
    this.scene.add(this.candleFlames);
    this.updateCandles(0);
  }

  private buildScroll() {
    const c = parchment(512, 640, 12);
    const g = c.getContext('2d')!;
    g.textAlign = 'center';
    g.fillStyle = '#7a3a18';
    g.font = '600 22px Cinzel, Georgia, serif';
    g.fillText('A L O H O M O R A', 256, 76);
    g.fillStyle = '#2a160a';
    g.font = '400 50px "IM Fell English", Georgia, serif';
    g.fillText(portfolio.contact.heading, 256, 170);
    g.font = 'italic 26px "Cormorant Garamond", Georgia, serif';
    g.fillStyle = '#4a3020';
    g.fillText(portfolio.contact.email, 256, 250);
    g.font = '24px "Cormorant Garamond", Georgia, serif';
    let y = 310;
    for (const l of portfolio.contact.links.filter((x) => x.url)) {
      g.fillText('✦ ' + l.label, 256, y);
      y += 36;
    }
    g.font = 'italic 30px "IM Fell English", Georgia, serif';
    g.fillText(portfolio.contact.signature, 256, 560);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffe2b0, emissiveMap: tex, emissiveIntensity: 0.4, roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0 });
    const geo = new THREE.PlaneGeometry(1.2, 1.5, 20, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, -Math.pow(Math.abs(p.getX(i)) / 0.6, 3) * 0.1);
    geo.computeVertexNormals();
    const group = new THREE.Group();
    group.add(new THREE.Mesh(geo, mat));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0xffc880, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(3.2, 3.4, 1);
    glow.position.z = -0.2;
    group.add(glow);
    group.visible = false;
    return { group, mat };
  }

  private updateCandles(t: number) {
    const m = new THREE.Matrix4();
    const bob = settings.get().reducedMotion ? 0 : 0.1;
    const seeds = this.candleFlames.seeds;
    for (let i = 0; i < this.candlePos.length; i++) {
      const p = this.candlePos[i];
      this.candles.setMatrixAt(i, m.makeTranslation(p.x, p.y + Math.sin(t * 0.8 + seeds[i]) * bob, p.z));
    }
    this.candles.instanceMatrix.needsUpdate = true;
  }

  /* ── Lifecycle ────────────────────────────────────────────────────── */

  enter(section?: Section) {
    audio.ambience('chamber');
    this.door.setRunes(0.04, 0xffc870);
    if (section === 'contact') {
      // arriving from the spellbook: cast for the visitor after a breath
      ui.hint('The last door. The spell is on your lips…');
      this.track(gsap.delayedCall(dur(1.2, 0.3), () => this.castAlohomora()));
      return;
    }
    ui.hint('A sealed door, older than the castle. One spell left.');
    this.offerCast('Alohomora', 'Open the way', () => this.castAlohomora());
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

  goToSection(section: Section) {
    if (section !== 'contact' || this.busy) return;
    if (!this.opened) {
      this.pendingCast = null;
      ui.hideActions();
      this.castAlohomora();
    } else this.revealContact();
  }

  private async castAlohomora() {
    if (this.busy || this.opened) return;
    this.busy = true;
    ui.hint(null);
    this.wand.setColor(0xffe2a0);
    await this.wand.flick();
    audio.alohomora();
    const tip = this.wand.tipWorld();
    const ringPos = this.door.ring.getWorldPosition(new THREE.Vector3());
    // a thread of light from the wand to the lock
    for (let i = 0; i < 80; i++) {
      this.sparks.emit({ position: tip, velocity: ringPos.clone().sub(tip).multiplyScalar(1.3 + Math.random() * 0.3), spread: 0.15, life: [0.6, 0.85], size: [0.05, 0.02], color: 0xffd07a, color2: 0xffffff, drag: 0.6 });
    }
    const reduced = settings.get().reducedMotion;
    const tl = gsap.timeline();
    const runes = { v: 0.04 };
    tl.to(this.wand, { glowLevel: 1.1, duration: 0.3 }, 0);
    tl.to(this.wand.light, { intensity: 6, duration: 0.3 }, 0);
    tl.to(runes, { v: 1, duration: reduced ? 0.4 : 1.0, ease: 'steps(5)', onUpdate: () => this.door.setRunes(runes.v) }, 0.2);
    tl.to(this.door.ring.rotation, { z: -Math.PI * 1.5, duration: reduced ? 0.4 : 1.0, ease: 'power2.inOut' }, 0.2);
    // burst
    tl.call(() => {
      this.ctx.engine.flash(0.9, 0xfff0d0);
      audio.door();
      const c = ringPos.clone();
      this.sparks.emit({ position: c, spread: 5, life: [0.6, 1.8], size: [0.12, 0.02], color: 0xffe0a0, color2: 0xffffff, drag: 1.4, count: 220 });
    }, [], reduced ? 0.7 : 1.25);
    const open = { v: 0 };
    tl.to(open, { v: 1, duration: reduced ? 0.6 : 2.4, ease: 'power2.out', onUpdate: () => this.door.setOpen(open.v) }, reduced ? 0.7 : 1.25);
    tl.to(this.door.ringMat.uniforms.uBase, { value: 0, duration: 0.4 }, reduced ? 0.7 : 1.25);
    tl.to(this.door.ring.scale, { x: 1.8, y: 1.8, duration: 0.8, ease: 'power2.out' }, reduced ? 0.7 : 1.25);
    tl.to(this.door.ringMat.uniforms.uProgress, { value: 0, duration: 0.8 }, reduced ? 0.9 : 1.45);
    tl.to(this.beamMat, { opacity: 0.55, duration: 0.5 }, reduced ? 0.7 : 1.3);
    tl.to(this.beamMat, { opacity: 0, duration: 2.5 }, reduced ? 1.2 : 2.6);
    tl.to(this.roomLight, { intensity: 60, duration: 0.6 }, reduced ? 0.7 : 1.3);
    tl.to(this.roomLight, { intensity: 30, duration: 3 }, reduced ? 1.3 : 2.4);
    tl.to(this.roomLight.position, { y: 8, z: ROOM_Z + 2, duration: 3 }, reduced ? 1.3 : 2.4);
    tl.to(this.hemi, { intensity: 0.7, duration: 3 }, reduced ? 1.3 : 2.4);
    tl.to(this.door.leakMat, { opacity: 0, duration: 2 }, reduced ? 1.3 : 3.2);
    tl.to(this.wand, { glowLevel: 0.35, duration: 1.2 }, 1.6);
    tl.to(this.wand.light, { intensity: 1, duration: 1.2 }, 1.6);
    // walk through into the chamber, glancing up at the enchanted sky
    const walkStart = reduced ? 1 : 2.4;
    tl.to(this.camPos, { z: ROOM_Z + 8.5, duration: reduced ? 0.8 : 4.2, ease: 'power2.inOut' }, walkStart);
    tl.to(this.lookTarget, { y: 9, z: ROOM_Z, duration: reduced ? 0.5 : 2.4, ease: 'sine.inOut' }, walkStart + 0.4);
    tl.to(this.lookTarget, { y: 2.2, z: ROOM_Z + 3, duration: reduced ? 0.5 : 2.2, ease: 'sine.inOut' }, walkStart + (reduced ? 0.6 : 2.8));
    tl.to(this.lights, { base: 8, duration: 2 }, walkStart);
    this.opened = true;
    this.playCinematic(tl, () => {
      this.busy = false;
      this.camPos.set(0, EYE, ROOM_Z + 8.5);
      this.lookTarget.set(0, 2.2, ROOM_Z + 3);
      this.door.setOpen(1);
      this.beamMat.opacity = 0;
      this.roomLight.intensity = 30;
      this.roomLight.position.set(0, 8, ROOM_Z + 2);
      this.hemi.intensity = 0.7;
      this.ctx.director.markVisited('contact');
      this.revealContact();
    });
  }

  private revealContact() {
    const portrait = window.innerHeight > window.innerWidth;
    const s = this.scroll;
    const pos = portrait || isMobile ? new THREE.Vector3(0, 2.6, ROOM_Z + 3.4) : new THREE.Vector3(-1.05, 1.95, ROOM_Z + 4.5);
    s.position.copy(pos).setY(pos.y - 0.8);
    s.lookAt(this.camPos.x, pos.y, this.camPos.z);
    s.visible = true;
    this.scrollMat.opacity = 0;
    const tl = gsap.timeline();
    tl.to(this.scrollMat, { opacity: 1, duration: 0.8 }, 0);
    tl.to(s.position, { y: pos.y, duration: dur(1.6, 0.3), ease: 'power2.out' }, 0);
    tl.call(() => {
      for (let i = 0; i < 40; i++) this.sparks.emit({ position: s.position, spread: 1.2, life: [0.8, 1.6], size: [0.05, 0.01], color: 0xffd890, drag: 1.5, gravity: -0.4 });
      ui.openPanel({
        variant: 'contact',
        eyebrow: 'Alohomora · Contact',
        title: portfolio.contact.heading,
        body: contactBody(() => this.ctx.director.restart()),
        closeLabel: 'Close',
        onClose: () => ui.showAction('Read the letter again', () => this.revealContact(), { label: 'Begin again', onClick: () => this.ctx.director.restart() }),
      });
    }, [], 0.6);
    this.track(tl);
  }

  update(dt: number, t: number) {
    super.update(dt, t);
    const reduced = settings.get().reducedMotion;
    const pt = this.ctx.engine.pointer;
    const sway = reduced ? 0 : 1;
    this.camera.position.set(this.camPos.x + pt.x * 0.15 * sway, this.camPos.y + Math.sin(t * 0.6) * 0.02 * sway, this.camPos.z);
    const lt = this.lookTarget.clone().add(new THREE.Vector3(pt.x * 1.2 * sway, pt.y * 0.7 * sway, 0));
    this.look.lerp(lt, 1 - Math.pow(0.03, dt));
    this.camera.lookAt(this.look);
    this.camera.updateMatrixWorld();
    this.wand.update(dt, pt);
    this.sky.update(t);
    this.updateCandles(t);
    this.candleFlames.update(t);
    for (const l of this.lights) l.update(t);
    this.door.ringMat.uniforms.uTime.value = t;
    this.motes.update(t);
    this.sparks.update(dt);
    if (this.scroll.visible && !reduced) this.scroll.rotation.z = Math.sin(t * 0.7) * 0.02;
  }

  dispose() {
    ui.hint(null);
    super.dispose();
  }
}

function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  return t;
}

export default (ctx: SceneContext) => new ChamberScene(ctx);
