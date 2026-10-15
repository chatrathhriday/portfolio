/** Shared plumbing for journey scenes: camera, timelines, cleanup. */
import * as THREE from 'three';
import type { BloomSettings, SceneContext, SceneId, Section, WorldScene } from '../core/types';
import { ui } from '../ui/ui';

export abstract class BaseScene implements WorldScene {
  abstract readonly id: SceneId;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  bloom: BloomSettings = { strength: 0.8, radius: 0.6, threshold: 0.75 };
  exposure = 1;
  protected timelines: gsap.core.Animation[] = [];
  protected cleanups: (() => void)[] = [];
  protected updaters: ((dt: number, t: number) => void)[] = [];
  protected cine: gsap.core.Timeline | null = null;
  /** Base vertical FOV for landscape; widened automatically on portrait. */
  protected baseFov = 50;

  constructor(protected ctx: SceneContext) {
    this.camera = new THREE.PerspectiveCamera(this.baseFov, 1, 0.05, 2000);
    this.scene.add(this.camera);
  }

  get cinematic() {
    return !!this.cine && this.cine.isActive();
  }

  abstract enter(section?: Section): void;

  update(dt: number, t: number) {
    for (const u of this.updaters) u(dt, t);
  }

  resize(w: number, h: number) {
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Keep horizontal framing on portrait screens by widening the vertical FOV.
    const fov = aspect < 1 ? Math.min(78, this.baseFov / Math.pow(aspect, 0.55)) : this.baseFov;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  /** Run a skippable cinematic. `onEnd` runs once whether it completes or is skipped. */
  protected playCinematic(tl: gsap.core.Timeline, onEnd: () => void, label = 'Skip') {
    this.cine?.kill();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      ui.setSkippable(false);
      this.cine = null;
      onEnd();
    };
    tl.eventCallback('onComplete', finish);
    this.cine = tl;
    this.track(tl);
    ui.setSkippable(true, () => {
      tl.progress(1, false);
      finish();
    }, label);
  }

  skip() {
    if (this.cine) {
      const tl = this.cine;
      tl.progress(1, false);
      // onComplete fires on progress(1); ensure skip UI hides regardless
      ui.setSkippable(false);
    }
  }

  protected track<T extends gsap.core.Animation>(a: T): T {
    this.timelines.push(a);
    return a;
  }

  protected onDispose(fn: () => void) {
    this.cleanups.push(fn);
  }

  dispose() {
    this.timelines.forEach((t) => t.kill());
    this.cleanups.forEach((f) => f());
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.scene.clear();
  }
}
