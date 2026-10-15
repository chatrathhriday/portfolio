/**
 * Renderer, post-processing chain and main loop. Scenes plug in through
 * `setScene`; the engine never knows what a scene contains.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { WorldScene } from './types';
import { FpsMonitor, detectTier, profileFor, type QualityProfile, type Tier } from './quality';
import { settings } from './settings';
import { pointUniforms } from '../fx/particles';
import { InkOutlinePass } from './outline';

/** Vignette, film grain and a gentle cool-shadow / warm-highlight grade. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 1.0 },
    uGrain: { value: 0.0 }, // anime style: no film grain
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 0.92, 0.75) },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uFlash; uniform vec3 uFlashColor;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126,0.7152,0.0722));
      // split tone: shadows toward midnight blue, highlights toward amber
      c.rgb += mix(vec3(-0.004, 0.0, 0.018), vec3(0.02, 0.008, -0.012), smoothstep(0.05, 0.6, l));
      c.rgb = mix(vec3(l), c.rgb, 1.12); // a touch more saturation, like a painted frame
      vec2 d = vUv - 0.5;
      c.rgb *= mix(1.0, smoothstep(0.95, 0.25, length(d * vec2(1.1, 1.0))), 0.4 * uVignette);
      c.rgb += (h(vUv * 1000.0 + fract(uTime * 7.0)) - 0.5) * uGrain;
      c.rgb = mix(c.rgb, uFlashColor * 1.4, uFlash);
      gl_FragColor = c;
    }`,
};

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  quality: QualityProfile;
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private bloom: UnrealBloomPass;
  private outline: InkOutlinePass;
  readonly grade: ShaderPass;
  private current: WorldScene | null = null;
  private clock = new THREE.Clock();
  private elapsed = 0;
  private fps: FpsMonitor;
  private running = false;
  private qualityListeners = new Set<(q: QualityProfile) => void>();
  /** Normalised device coords of the pointer, updated globally. */
  readonly pointer = new THREE.Vector2(0, 0);
  width = window.innerWidth;
  height = window.innerHeight;

  constructor(container: HTMLElement) {
    const baseTier: Tier = settings.get().lightGraphics ? 'low' : detectTier();
    this.quality = profileFor(baseTier);
    this.renderer = new THREE.WebGLRenderer({
      antialias: this.quality.tier !== 'low',
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(this.quality.pixelRatio);
    this.renderer.setSize(this.width, this.height);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(this.canvas);

    // MSAA on the composer's own targets — without it every edge in post-processing is jagged.
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.quality.tier === 'high' ? 4 : 2 });
    // depth is kept so the ink-outline pass can find silhouettes and creases
    rt.depthTexture = new THREE.DepthTexture(1, 1);
    rt.depthTexture.type = THREE.UnsignedIntType;
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderer.shadowMap.enabled = this.quality.tier === 'high';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.composer.addPass(this.renderPass);
    this.outline = new InkOutlinePass();
    this.composer.addPass(this.outline);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.6, 0.8);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.applySize();

    this.fps = new FpsMonitor(() => this.downgrade());

    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('pointermove', (e) => {
      this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    });
    settings.on(() => {
      const want: Tier = settings.get().lightGraphics ? 'low' : detectTier();
      if (want !== this.quality.tier) this.setTier(want);
    });
  }

  onQuality(fn: (q: QualityProfile) => void) {
    this.qualityListeners.add(fn);
    return () => this.qualityListeners.delete(fn);
  }

  private setTier(t: Tier) {
    this.quality = profileFor(t);
    this.renderer.setPixelRatio(this.quality.pixelRatio);
    this.applySize();
    this.qualityListeners.forEach((f) => f(this.quality));
  }

  private downgrade() {
    if (this.quality.tier === 'high') this.setTier('medium');
    else if (this.quality.tier === 'medium') this.setTier('low');
  }

  /** Dynamic resolution: scales the pixel ratio to hold frame rate on weaker GPUs. */
  private dynScale = 1;
  private dynAcc = 0;
  private dynFrames = 0;

  private get ratio() {
    return Math.max(0.6, this.quality.pixelRatio * this.dynScale);
  }

  private applySize() {
    pointUniforms.uPixel.value = this.ratio;
    pointUniforms.uHeight.value = this.height;
    this.renderer.setPixelRatio(this.ratio);
    this.renderer.setSize(this.width, this.height);
    this.composer.setPixelRatio(this.ratio);
    this.composer.setSize(this.width, this.height);
    const s = this.quality.bloomScale;
    this.bloom.resolution.set(this.width * s, this.height * s);
    this.bloom.setSize(Math.round(this.width * s), Math.round(this.height * s));
  }

  private onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.applySize();
    this.current?.resize(this.width, this.height);
  }

  get scene() {
    return this.current;
  }

  setScene(ws: WorldScene) {
    this.current = ws;
    this.renderPass.scene = ws.scene;
    this.renderPass.camera = ws.camera;
    ws.resize(this.width, this.height);
  }

  /** Pre-compile shaders so the first frame of a scene doesn't hitch. */
  async warm(ws: WorldScene) {
    ws.resize(this.width, this.height);
    try {
      await this.renderer.compileAsync(ws.scene, ws.camera);
    } catch {
      this.renderer.compile(ws.scene, ws.camera);
    }
  }

  /** Brief full-screen flash (used by spells). */
  flash(amount: number, color?: THREE.ColorRepresentation) {
    if (color) (this.grade.uniforms.uFlashColor.value as THREE.Color).set(color);
    this.grade.uniforms.uFlash.value = settings.get().reducedMotion ? amount * 0.4 : amount;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  private adaptResolution(dt: number) {
    if (document.visibilityState !== 'visible') return;
    this.dynAcc += dt;
    this.dynFrames++;
    if (this.dynAcc < 1.2) return;
    const fps = this.dynFrames / this.dynAcc;
    this.dynAcc = 0;
    this.dynFrames = 0;
    const prev = this.dynScale;
    // target a steady 55–60 fps: shed pixels quickly, win them back slowly
    if (fps < 52 && this.dynScale > 0.6) this.dynScale = Math.max(0.6, this.dynScale - (fps < 40 ? 0.15 : 0.08));
    else if (fps > 58.5 && this.dynScale < 1) this.dynScale = Math.min(1, this.dynScale + 0.04);
    if (prev !== this.dynScale) this.applySize();
  }

  /** Render one frame now (used by the dev test pump). */
  tick() {
    this.frame();
  }

  private frame() {
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    this.elapsed += dt;
    const ws = this.current;
    if (!ws) return;
    ws.update(dt, this.elapsed);
    this.bloom.enabled = this.quality.bloom;
    // soft, wide "anime glow" around lights rather than tight hot spots
    this.bloom.strength = ws.bloom.strength * 0.85;
    this.bloom.radius = Math.max(ws.bloom.radius, 0.8);
    this.bloom.threshold = ws.bloom.threshold;
    this.outline.setCamera(ws.camera);
    this.outline.setSize2(this.width * this.ratio, this.height * this.ratio);
    this.outline.enabled = this.quality.tier !== 'low' || this.dynScale > 0.7;
    this.renderer.toneMappingExposure = ws.exposure;
    this.grade.uniforms.uTime.value = this.elapsed;
    const f = this.grade.uniforms.uFlash;
    f.value = Math.max(0, f.value - dt * 1.4);
    this.composer.render(dt);
    this.adaptResolution(dt);
    if (document.visibilityState === 'visible') this.fps.sample(dt);
  }
}
