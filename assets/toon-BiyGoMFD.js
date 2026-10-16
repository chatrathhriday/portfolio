import{p as a}from"./three-8ZOBuMax.js";const t="vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",n=`
float toonBand(float L) {
  // ~1.1 bands per stop of light, each edge softened so it never flickers
  float e = log2(max(L, 1e-4)) * 1.1;
  float q = floor(e);
  q += smoothstep(0.82, 1.0, e - q);
  return exp2(q / 1.1);
}
`,i=`
vec3 toonLight = totalDiffuse / max(diffuseColor.rgb, vec3(0.03));
float toonL = dot(toonLight, vec3(0.299, 0.587, 0.114));
vec3 toonDiffuse = diffuseColor.rgb * toonLight * (toonBand(toonL) / max(toonL, 1e-4));
float specL = dot(totalSpecular, vec3(0.333));
vec3 toonSpec = totalSpecular * smoothstep(0.18, 0.24, specL) * 0.8;
vec3 outgoingLight = toonDiffuse + toonSpec + totalEmissiveRadiance;
`;let e=!1;function s(){if(e)return;const o=a.physical;if(!o.fragmentShader.includes(t)){console.warn("[toon] shader anchor not found; keeping standard shading");return}o.fragmentShader=o.fragmentShader.replace("void main() {",n+`
void main() {`).replace(t,i),e=!0}export{s as installToonShading};
