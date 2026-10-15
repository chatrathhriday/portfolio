/**
 * Ink outlines for the anime look. Edges are found in the depth buffer with a
 * Laplacian (silhouettes and creases), divided by distance so large surfaces
 * seen at a grazing angle don't get false lines, and faded with distance so
 * far detail stays calm. Lines take a darkened tint of the colour underneath
 * instead of flat black, which reads softer, like a painted cel.
 */
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

export class InkOutlinePass extends Pass {
  private quad: FullScreenQuad;
  private mat: THREE.ShaderMaterial;

  constructor() {
    super();
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tDepth: { value: null },
        uRes: { value: new THREE.Vector2(1, 1) },
        uNear: { value: 0.05 },
        uFar: { value: 2000 },
        uStrength: { value: 0.9 },
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        #include <packing>
        uniform sampler2D tDiffuse, tDepth; uniform vec2 uRes; uniform float uNear, uFar, uStrength;
        varying vec2 vUv;
        float lin(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
        void main(){
          vec4 col = texture2D(tDiffuse, vUv);
          vec2 px = 1.0 / uRes;
          float dc = lin(vUv);
          float l = lin(vUv - vec2(px.x, 0.0)), r = lin(vUv + vec2(px.x, 0.0));
          float u = lin(vUv + vec2(0.0, px.y)), d = lin(vUv - vec2(0.0, px.y));
          // normalise by the nearest sample so silhouettes are inked on both sides
          float dn = max(min(min(min(l, r), min(u, d)), dc), 0.001);
          float lap = abs(l + r + u + d - 4.0 * dc) / dn;
          float edge = smoothstep(0.04, 0.12, lap);
          edge *= 1.0 - smoothstep(35.0, 90.0, dn);
          vec3 ink = mix(col.rgb * 0.25, vec3(0.06, 0.04, 0.1), 0.55);
          gl_FragColor = vec4(mix(col.rgb, ink, edge * uStrength), col.a);
        }`,
    });
    this.quad = new FullScreenQuad(this.mat);
  }

  setCamera(cam: THREE.PerspectiveCamera) {
    this.mat.uniforms.uNear.value = cam.near;
    this.mat.uniforms.uFar.value = cam.far;
  }

  setSize2(w: number, h: number) {
    this.mat.uniforms.uRes.value.set(Math.max(1, w), Math.max(1, h));
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    this.mat.uniforms.tDiffuse.value = readBuffer.texture;
    this.mat.uniforms.tDepth.value = readBuffer.depthTexture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose() {
    this.mat.dispose();
    this.quad.dispose();
  }
}
