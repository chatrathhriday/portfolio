var z=Object.defineProperty;var N=(l,e,t)=>e in l?z(l,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):l[e]=t;var o=(l,e,t)=>N(l,typeof e!="symbol"?e+"":e,t);import{M as L,O,B as I,F as _,S as c,U as T,V as u,W as g,H as v,N as V,C as D,a as x,b as p,A as G,c as Q,R as k,d as q,e as H,L as W,f as j,g as X,h as A,i as K,j as Y,k as Z,l as J,D as $,m as ee,P as te,n as ie,o as se}from"./three-8ZOBuMax.js";import{s as b,d as y,p as P,F as re}from"./index-C1bFjbBJ.js";import{p as R}from"./particles-CAQrdhOo.js";const U={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};class d{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}const ae=new O(-1,1,1,-1,0,1);class oe extends I{constructor(){super(),this.setAttribute("position",new _([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new _([0,2,0,0,2,0],2))}}const le=new oe;class M{constructor(e){this._mesh=new L(le,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,ae)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}class E extends d{constructor(e,t){super(),this.textureID=t!==void 0?t:"tDiffuse",e instanceof c?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=T.clone(e.uniforms),this.material=new c({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this.fsQuad=new M(this.material)}render(e,t,i){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=i.texture),this.fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this.fsQuad.render(e))}dispose(){this.material.dispose(),this.fsQuad.dispose()}}class F extends d{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,i){const r=e.getContext(),s=e.state;s.buffers.color.setMask(!1),s.buffers.depth.setMask(!1),s.buffers.color.setLocked(!0),s.buffers.depth.setLocked(!0);let a,h;this.inverse?(a=0,h=1):(a=1,h=0),s.buffers.stencil.setTest(!0),s.buffers.stencil.setOp(r.REPLACE,r.REPLACE,r.REPLACE),s.buffers.stencil.setFunc(r.ALWAYS,a,4294967295),s.buffers.stencil.setClear(h),s.buffers.stencil.setLocked(!0),e.setRenderTarget(i),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),s.buffers.color.setLocked(!1),s.buffers.depth.setLocked(!1),s.buffers.color.setMask(!0),s.buffers.depth.setMask(!0),s.buffers.stencil.setLocked(!1),s.buffers.stencil.setFunc(r.EQUAL,1,4294967295),s.buffers.stencil.setOp(r.KEEP,r.KEEP,r.KEEP),s.buffers.stencil.setLocked(!0)}}class ne extends d{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class he{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){const i=e.getSize(new u);this._width=i.width,this._height=i.height,t=new g(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:v}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new E(U),this.copyPass.material.blending=V,this.clock=new D}swapBuffers(){const e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){const t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){e===void 0&&(e=this.clock.getDelta());const t=this.renderer.getRenderTarget();let i=!1;for(let r=0,s=this.passes.length;r<s;r++){const a=this.passes[r];if(a.enabled!==!1){if(a.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(r),a.render(this.renderer,this.writeBuffer,this.readBuffer,e,i),a.needsSwap){if(i){const h=this.renderer.getContext(),n=this.renderer.state.buffers.stencil;n.setFunc(h.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),n.setFunc(h.EQUAL,1,4294967295)}this.swapBuffers()}F!==void 0&&(a instanceof F?i=!0:a instanceof ne&&(i=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){const t=this.renderer.getSize(new u);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;const i=this._width*this._pixelRatio,r=this._height*this._pixelRatio;this.renderTarget1.setSize(i,r),this.renderTarget2.setSize(i,r);for(let s=0;s<this.passes.length;s++)this.passes[s].setSize(i,r)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}class ue extends d{constructor(e,t,i=null,r=null,s=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=i,this.clearColor=r,this.clearAlpha=s,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new x}render(e,t,i){const r=e.autoClear;e.autoClear=!1;let s,a;this.overrideMaterial!==null&&(a=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(s=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:i),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(s),this.overrideMaterial!==null&&(this.scene.overrideMaterial=a),e.autoClear=r}}const fe={uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new x(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};class m extends d{constructor(e,t,i,r){super(),this.strength=t!==void 0?t:1,this.radius=i,this.threshold=r,this.resolution=e!==void 0?new u(e.x,e.y):new u(256,256),this.clearColor=new x(0,0,0),this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let s=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);this.renderTargetBright=new g(s,a,{type:v}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let f=0;f<this.nMips;f++){const C=new g(s,a,{type:v});C.texture.name="UnrealBloomPass.h"+f,C.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(C);const w=new g(s,a,{type:v});w.texture.name="UnrealBloomPass.v"+f,w.texture.generateMipmaps=!1,this.renderTargetsVertical.push(w),s=Math.round(s/2),a=Math.round(a/2)}const h=fe;this.highPassUniforms=T.clone(h.uniforms),this.highPassUniforms.luminosityThreshold.value=r,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new c({uniforms:this.highPassUniforms,vertexShader:h.vertexShader,fragmentShader:h.fragmentShader}),this.separableBlurMaterials=[];const n=[3,5,7,9,11];s=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);for(let f=0;f<this.nMips;f++)this.separableBlurMaterials.push(this.getSeperableBlurMaterial(n[f])),this.separableBlurMaterials[f].uniforms.invSize.value=new u(1/s,1/a),s=Math.round(s/2),a=Math.round(a/2);this.compositeMaterial=this.getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;const B=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=B,this.bloomTintColors=[new p(1,1,1),new p(1,1,1),new p(1,1,1),new p(1,1,1),new p(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors;const S=U;this.copyUniforms=T.clone(S.uniforms),this.blendMaterial=new c({uniforms:this.copyUniforms,vertexShader:S.vertexShader,fragmentShader:S.fragmentShader,blending:G,depthTest:!1,depthWrite:!1,transparent:!0}),this.enabled=!0,this.needsSwap=!1,this._oldClearColor=new x,this.oldClearAlpha=1,this.basic=new Q,this.fsQuad=new M(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this.basic.dispose(),this.fsQuad.dispose()}setSize(e,t){let i=Math.round(e/2),r=Math.round(t/2);this.renderTargetBright.setSize(i,r);for(let s=0;s<this.nMips;s++)this.renderTargetsHorizontal[s].setSize(i,r),this.renderTargetsVertical[s].setSize(i,r),this.separableBlurMaterials[s].uniforms.invSize.value=new u(1/i,1/r),i=Math.round(i/2),r=Math.round(r/2)}render(e,t,i,r,s){e.getClearColor(this._oldClearColor),this.oldClearAlpha=e.getClearAlpha();const a=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),s&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this.fsQuad.material=this.basic,this.basic.map=i.texture,e.setRenderTarget(null),e.clear(),this.fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=i.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this.fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this.fsQuad.render(e);let h=this.renderTargetBright;for(let n=0;n<this.nMips;n++)this.fsQuad.material=this.separableBlurMaterials[n],this.separableBlurMaterials[n].uniforms.colorTexture.value=h.texture,this.separableBlurMaterials[n].uniforms.direction.value=m.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[n]),e.clear(),this.fsQuad.render(e),this.separableBlurMaterials[n].uniforms.colorTexture.value=this.renderTargetsHorizontal[n].texture,this.separableBlurMaterials[n].uniforms.direction.value=m.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[n]),e.clear(),this.fsQuad.render(e),h=this.renderTargetsVertical[n];this.fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this.fsQuad.render(e),this.fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,s&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(i),this.fsQuad.render(e)),e.setClearColor(this._oldClearColor,this.oldClearAlpha),e.autoClear=a}getSeperableBlurMaterial(e){const t=[];for(let i=0;i<e;i++)t.push(.39894*Math.exp(-.5*i*i/(e*e))/e);return new c({defines:{KERNEL_RADIUS:e},uniforms:{colorTexture:{value:null},invSize:{value:new u(.5,.5)},direction:{value:new u(.5,.5)},gaussianCoefficients:{value:t}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {
					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`})}getCompositeMaterial(e){return new c({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`})}}m.BlurDirectionX=new u(1,0);m.BlurDirectionY=new u(0,1);const ce={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`
	
		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};class de extends d{constructor(){super();const e=ce;this.uniforms=T.clone(e.uniforms),this.material=new k({name:e.name,uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader}),this.fsQuad=new M(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,i){this.uniforms.tDiffuse.value=i.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},q.getTransfer(this._outputColorSpace)===H&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===W?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===j?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===X?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===A?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===K?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===Y&&(this.material.defines.NEUTRAL_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this.fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this.fsQuad.render(e))}dispose(){this.material.dispose(),this.fsQuad.dispose()}}class me extends d{constructor(){super();o(this,"quad");o(this,"mat");this.mat=new c({uniforms:{tDiffuse:{value:null},tDepth:{value:null},uRes:{value:new u(1,1)},uNear:{value:.05},uFar:{value:2e3},uStrength:{value:.9}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fragmentShader:`
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
        }`}),this.quad=new M(this.mat)}setCamera(t){this.mat.uniforms.uNear.value=t.near,this.mat.uniforms.uFar.value=t.far}setSize2(t,i){this.mat.uniforms.uRes.value.set(Math.max(1,t),Math.max(1,i))}render(t,i,r){this.mat.uniforms.tDiffuse.value=r.texture,this.mat.uniforms.tDepth.value=r.depthTexture,t.setRenderTarget(this.renderToScreen?null:i),this.quad.render(t)}dispose(){this.mat.dispose(),this.quad.dispose()}}const pe={uniforms:{tDiffuse:{value:null},uTime:{value:0},uVignette:{value:1},uGrain:{value:0},uFlash:{value:0},uFlashColor:{value:new x(1,.92,.75)}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",fragmentShader:`
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
    }`};class Te{constructor(e){o(this,"renderer");o(this,"canvas");o(this,"quality");o(this,"composer");o(this,"renderPass");o(this,"bloom");o(this,"outline");o(this,"grade");o(this,"current",null);o(this,"clock",new D);o(this,"elapsed",0);o(this,"fps");o(this,"running",!1);o(this,"qualityListeners",new Set);o(this,"pointer",new u(0,0));o(this,"width",window.innerWidth);o(this,"height",window.innerHeight);o(this,"dynScale",1);o(this,"dynAcc",0);o(this,"dynFrames",0);const t=b.get().lightGraphics?"low":y();this.quality=P(t),this.renderer=new Z({antialias:this.quality.tier!=="low",powerPreference:"high-performance",stencil:!1}),this.renderer.setPixelRatio(this.quality.pixelRatio),this.renderer.setSize(this.width,this.height),this.renderer.toneMapping=A,this.renderer.outputColorSpace=J,this.canvas=this.renderer.domElement,this.canvas.setAttribute("aria-hidden","true"),e.appendChild(this.canvas);const i=new g(1,1,{type:v,samples:this.quality.tier==="high"?4:2});i.depthTexture=new $(1,1),i.depthTexture.type=ee,this.composer=new he(this.renderer,i),this.renderer.shadowMap.enabled=this.quality.tier==="high",this.renderer.shadowMap.type=te,this.renderPass=new ue(new ie,new se),this.composer.addPass(this.renderPass),this.outline=new me,this.composer.addPass(this.outline),this.bloom=new m(new u(256,256),.8,.6,.8),this.composer.addPass(this.bloom),this.grade=new E(pe),this.composer.addPass(this.grade),this.composer.addPass(new de),this.applySize(),this.fps=new re(()=>this.downgrade()),window.addEventListener("resize",()=>this.onResize()),window.addEventListener("pointermove",r=>{this.pointer.set(r.clientX/window.innerWidth*2-1,-(r.clientY/window.innerHeight)*2+1)}),b.on(()=>{const r=b.get().lightGraphics?"low":y();r!==this.quality.tier&&this.setTier(r)})}onQuality(e){return this.qualityListeners.add(e),()=>this.qualityListeners.delete(e)}setTier(e){this.quality=P(e),this.renderer.setPixelRatio(this.quality.pixelRatio),this.applySize(),this.qualityListeners.forEach(t=>t(this.quality))}downgrade(){this.quality.tier==="high"?this.setTier("medium"):this.quality.tier==="medium"&&this.setTier("low")}get ratio(){return Math.max(.6,this.quality.pixelRatio*this.dynScale)}applySize(){R.uPixel.value=this.ratio,R.uHeight.value=this.height,this.renderer.setPixelRatio(this.ratio),this.renderer.setSize(this.width,this.height),this.composer.setPixelRatio(this.ratio),this.composer.setSize(this.width,this.height);const e=this.quality.bloomScale;this.bloom.resolution.set(this.width*e,this.height*e),this.bloom.setSize(Math.round(this.width*e),Math.round(this.height*e))}onResize(){this.width=window.innerWidth,this.height=window.innerHeight,this.applySize(),this.current?.resize(this.width,this.height)}get scene(){return this.current}setScene(e){this.current=e,this.renderPass.scene=e.scene,this.renderPass.camera=e.camera,e.resize(this.width,this.height)}async warm(e){e.resize(this.width,this.height);try{await this.renderer.compileAsync(e.scene,e.camera)}catch{this.renderer.compile(e.scene,e.camera)}}flash(e,t){t&&this.grade.uniforms.uFlashColor.value.set(t),this.grade.uniforms.uFlash.value=b.get().reducedMotion?e*.4:e}start(){this.running||(this.running=!0,this.clock.start(),this.renderer.setAnimationLoop(()=>this.frame()))}stop(){this.running=!1,this.renderer.setAnimationLoop(null)}adaptResolution(e){if(document.visibilityState!=="visible"||(this.dynAcc+=e,this.dynFrames++,this.dynAcc<1.2))return;const t=this.dynFrames/this.dynAcc;this.dynAcc=0,this.dynFrames=0;const i=this.dynScale;t<52&&this.dynScale>.6?this.dynScale=Math.max(.6,this.dynScale-(t<40?.15:.08)):t>58.5&&this.dynScale<1&&(this.dynScale=Math.min(1,this.dynScale+.04)),i!==this.dynScale&&this.applySize()}tick(){this.frame()}frame(){const e=Math.min(this.clock.getDelta(),.05);this.elapsed+=e;const t=this.current;if(!t)return;t.update(e,this.elapsed),this.bloom.enabled=this.quality.bloom,this.bloom.strength=t.bloom.strength*.85,this.bloom.radius=Math.max(t.bloom.radius,.8),this.bloom.threshold=t.bloom.threshold,this.outline.setCamera(t.camera),this.outline.setSize2(this.width*this.ratio,this.height*this.ratio),this.outline.enabled=this.quality.tier!=="low"||this.dynScale>.7,this.renderer.toneMappingExposure=t.exposure,this.grade.uniforms.uTime.value=this.elapsed;const i=this.grade.uniforms.uFlash;i.value=Math.max(0,i.value-e*1.4),this.composer.render(e),this.adaptResolution(e),document.visibilityState==="visible"&&this.fps.sample(e)}}export{Te as Engine};
