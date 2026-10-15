/**
 * Anime / cel shading for every lit surface.
 *
 * Rather than swapping materials (which would break the references scenes use
 * to animate light and opacity), this patches three's standard/physical
 * fragment shader once at start-up: diffuse lighting is posterised into soft
 * bands in log-brightness space (so it works in dim halls and bright skies
 * alike), and specular highlights become crisp spots. Emissive is untouched.
 */
import * as THREE from 'three';

const ANCHOR = 'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;';

const RAMP = /* glsl */ `
float toonBand(float L) {
  // ~1.1 bands per stop of light, each edge softened so it never flickers
  float e = log2(max(L, 1e-4)) * 1.1;
  float q = floor(e);
  q += smoothstep(0.82, 1.0, e - q);
  return exp2(q / 1.1);
}
`;

const TOON = /* glsl */ `
vec3 toonLight = totalDiffuse / max(diffuseColor.rgb, vec3(0.03));
float toonL = dot(toonLight, vec3(0.299, 0.587, 0.114));
vec3 toonDiffuse = diffuseColor.rgb * toonLight * (toonBand(toonL) / max(toonL, 1e-4));
float specL = dot(totalSpecular, vec3(0.333));
vec3 toonSpec = totalSpecular * smoothstep(0.18, 0.24, specL) * 0.8;
vec3 outgoingLight = toonDiffuse + toonSpec + totalEmissiveRadiance;
`;

let patched = false;

export function installToonShading() {
  if (patched) return;
  const lib = THREE.ShaderLib.physical;
  if (!lib.fragmentShader.includes(ANCHOR)) {
    console.warn('[toon] shader anchor not found; keeping standard shading');
    return;
  }
  lib.fragmentShader = lib.fragmentShader.replace('void main() {', RAMP + '\nvoid main() {').replace(ANCHOR, TOON);
  patched = true;
}
