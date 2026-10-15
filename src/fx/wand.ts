/**
 * The visitor's wand: a camera-attached model that leans toward the pointer,
 * flicks when a spell is cast, and carries a light at its tip.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { softDot } from '../core/textures';
import { isMobile } from '../core/quality';
import { settings } from '../core/settings';

export class Wand {
  readonly root = new THREE.Group(); // attached to the camera
  private pivot = new THREE.Group(); // aims + flicks
  readonly tip = new THREE.Object3D();
  readonly light: THREE.PointLight;
  private glow: THREE.Sprite;
  private glowMat: THREE.SpriteMaterial;
  private aim = new THREE.Vector2();
  private flicking = false;
  private idleT = Math.random() * 10;
  /** 0..1 tip glow intensity. */
  glowLevel = 0.15;
  readonly color = new THREE.Color(0xfff1d0);

  constructor(camera: THREE.Camera) {
    const wood = new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.55, metalness: 0.05 });
    const darkWood = new THREE.MeshStandardMaterial({ color: 0x21140c, roughness: 0.5 });
    const len = 0.42;
    // shaft — tapered, slightly gnarled
    const shaftGeo = new THREE.CylinderGeometry(0.0045, 0.011, len, 10, 12);
    const pos = shaftGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const k = 1 + Math.sin(y * 70) * 0.06;
      pos.setX(i, pos.getX(i) * k);
      pos.setZ(i, pos.getZ(i) * k);
    }
    shaftGeo.computeVertexNormals();
    shaftGeo.rotateX(-Math.PI / 2);
    shaftGeo.translate(0, 0, -len / 2);
    const shaft = new THREE.Mesh(shaftGeo, wood);
    // handle with rings
    const handleGeo = new THREE.CylinderGeometry(0.013, 0.015, 0.13, 12);
    handleGeo.rotateX(-Math.PI / 2);
    handleGeo.translate(0, 0, 0.06);
    const handle = new THREE.Mesh(handleGeo, darkWood);
    for (const z of [-0.005, 0.03, 0.12]) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.0145, 0.003, 6, 16), darkWood);
      r.position.z = z;
      handle.add(r);
    }
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), darkWood);
    pommel.position.z = 0.13;
    this.pivot.add(shaft, handle, pommel);
    this.tip.position.set(0, 0, -len);
    this.pivot.add(this.tip);

    this.glowMat = new THREE.SpriteMaterial({ map: softDot(), color: this.color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
    this.glow = new THREE.Sprite(this.glowMat);
    this.glow.scale.setScalar(0.08);
    this.glow.renderOrder = 20;
    this.tip.add(this.glow);
    this.light = new THREE.PointLight(0xffe6b5, 0, 14, 1.6);
    this.tip.add(this.light);

    this.root.add(this.pivot);
    this.layout();
    camera.add(this.root);
    window.addEventListener('resize', this.layout);
  }

  /** Position in the lower-right of the view; centred lower on portrait phones. */
  layout = () => {
    const portrait = window.innerHeight > window.innerWidth;
    if (portrait || isMobile) this.root.position.set(0.12, -0.3, -0.5);
    else this.root.position.set(0.27, -0.24, -0.5);
    this.pivot.rotation.set(0.35, 0.25, 0.15);
  };

  /** Flick toward the target; resolves at the moment of release. */
  flick(): Promise<void> {
    if (this.flicking) return Promise.resolve();
    this.flicking = true;
    const r = this.pivot.rotation;
    const reduced = settings.get().reducedMotion;
    return new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: () => void (this.flicking = false) });
      tl.to(r, { x: r.x + (reduced ? 0.15 : 0.6), z: r.z - 0.25, duration: 0.22, ease: 'power2.out' })
        .to(r, { x: r.x - (reduced ? 0.1 : 0.35), z: r.z + 0.1, duration: 0.14, ease: 'power3.in', onComplete: resolve })
        .to(r, { x: r.x, z: r.z, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
    });
  }

  tipWorld(out = new THREE.Vector3()) {
    return this.tip.getWorldPosition(out);
  }

  setColor(c: THREE.ColorRepresentation) {
    this.color.set(c);
    this.light.color.set(c);
  }

  update(dt: number, pointer: THREE.Vector2) {
    this.idleT += dt;
    if (!this.flicking) {
      this.aim.lerp(pointer, 1 - Math.pow(0.002, dt));
      const sway = settings.get().reducedMotion ? 0 : 1;
      this.pivot.rotation.y = 0.25 - this.aim.x * 0.35 + Math.sin(this.idleT * 0.7) * 0.015 * sway;
      this.pivot.rotation.x = 0.35 + this.aim.y * 0.25 + Math.sin(this.idleT * 0.9) * 0.012 * sway;
    }
    const g = this.glowLevel;
    this.glowMat.opacity = Math.min(1, 0.2 + g);
    this.glow.scale.setScalar(0.03 + g * 0.11 * (1 + Math.sin(this.idleT * 6) * 0.05));
  }

  dispose() {
    window.removeEventListener('resize', this.layout);
    this.root.removeFromParent();
  }
}
