/**
 * Spring-damped camera. Cinematics move a *target* (position + look point);
 * the real camera follows with critically damped springs, so every move
 * eases in and out naturally and nothing ever snaps. A faint handheld drift
 * and pointer parallax keep still shots alive.
 */
import * as THREE from 'three';
import { settings } from '../core/settings';

/** Critically damped spring step (Game Programming Gems 4, "smooth damp"). */
function damp(cur: THREE.Vector3, target: THREE.Vector3, vel: THREE.Vector3, smooth: number, dt: number) {
  const omega = 2 / Math.max(0.0001, smooth);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur.clone().sub(target);
  const temp = vel.clone().addScaledVector(change, omega).multiplyScalar(dt);
  vel.sub(temp.clone().multiplyScalar(omega)).multiplyScalar(exp);
  cur.copy(target).add(change.add(temp).multiplyScalar(exp));
}

export class CameraRig {
  /** Where the camera wants to be / look. Animate these. */
  readonly pos = new THREE.Vector3();
  readonly look = new THREE.Vector3();
  /** Spring smoothing time in seconds (bigger = floatier). */
  smooth = 0.55;
  lookSmooth = 0.45;
  /** 0..1 strength of handheld drift + pointer parallax. */
  life = 1;
  private cPos = new THREE.Vector3();
  private cLook = new THREE.Vector3();
  private vPos = new THREE.Vector3();
  private vLook = new THREE.Vector3();
  private t = Math.random() * 100;

  constructor(private camera: THREE.PerspectiveCamera) {}

  /** Jump without easing (scene start, spellbook jumps behind a veil). */
  snap(pos?: THREE.Vector3, look?: THREE.Vector3) {
    if (pos) this.pos.copy(pos);
    if (look) this.look.copy(look);
    this.cPos.copy(this.pos);
    this.cLook.copy(this.look);
    this.vPos.set(0, 0, 0);
    this.vLook.set(0, 0, 0);
  }

  update(dt: number, pointer: THREE.Vector2) {
    this.t += dt;
    damp(this.cPos, this.pos, this.vPos, this.smooth, dt);
    damp(this.cLook, this.look, this.vLook, this.lookSmooth, dt);
    const reduced = settings.get().reducedMotion;
    const life = reduced ? 0 : this.life;
    const t = this.t;
    // layered, non-repeating handheld drift (a few cm)
    const hx = (Math.sin(t * 0.31) + Math.sin(t * 0.73 + 1.3) * 0.5) * 0.035 * life;
    const hy = (Math.sin(t * 0.47 + 0.7) + Math.sin(t * 1.07) * 0.4) * 0.025 * life;
    this.camera.position.set(this.cPos.x + hx + pointer.x * 0.12 * life, this.cPos.y + hy + pointer.y * 0.06 * life, this.cPos.z);
    const lx = this.cLook.x + pointer.x * 0.9 * life;
    const ly = this.cLook.y + pointer.y * 0.5 * life;
    this.camera.lookAt(lx, ly, this.cLook.z);
    this.camera.rotateZ(Math.sin(t * 0.23) * 0.004 * life);
    this.camera.updateMatrixWorld();
  }
}
