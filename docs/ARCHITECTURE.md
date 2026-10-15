# Architecture

## Stack
- **Vite + TypeScript**, no UI framework. The DOM UI is small, so plain modules are lighter than React.
- **Three.js** (vanilla) for every scene, plus `EffectComposer` → `UnrealBloomPass` → grade pass (vignette, grain) → `OutputPass` (ACES tone mapping).
- **GSAP** for camera and cinematic timelines.
- **Anime / painted style:** `core/toon.ts` patches three's standard shader once so all lit surfaces get soft cel bands and crisp highlights. `core/outline.ts` draws depth-based ink lines. Surfaces use painted canvas textures (`core/painted.ts`) and skies are painted in a shader. No film grain, photo textures or HDRIs.
- **Camera:** `fx/cameraRig.ts`: cinematics move a target, and the camera follows on critically damped springs.

## Journey (scene sequence)

| # | Scene module | What happens | Leaves via |
|---|---|---|---|
| 1 | `scenes/station` | Wet night platform with photo-textured paving and brick, HDRI reflections on the clear-coated train, steam, lanterns and suitcase props. **Board** punches the ticket. | Whistle → train departs → camera is swallowed by steam → **steam veil** |
| 2 | `scenes/lake` | Boat ride under a photographic starry sky. Mirror water, layered ridgelines, a photo-textured castle with crenellations, lantern-lit boats, and five story captions (`lakeCaptions` in the content file). Hold to row faster, or skip. | Boats pass under the cliff → **dark veil** |
| 3 | `scenes/hall` | Walk through the great doors into the Great Hall, then cast **Lumos → Accio → Expecto Patronum → Lumos Maxima** in place. Each spell restages the whole room (light, sky, candles, particles, camera). | "Begin again" → station |

## Code layout
```
src/content/portfolio.ts   ← ALL personal content (edit this)
src/core/                  Engine (renderer, composer, loop), Director (scene loading/transitions),
                           audio (procedural Web Audio), quality tiers, settings, textures, noise
src/scenes/<scene>/        One module per scene, lazy-loaded with import(); preloaded during idle time
                           while the previous scene plays; disposed after the transition
src/world/                 Builders for objects (train, castle, boat, stag, artefacts, door)
src/fx/                    Reusable effects: GPU particles, fog layers, sky, wand, flames
src/ui/                    DOM overlay: loader, ticket, hints, cast button, spellbook, panels, fallback
```

## Scene contract (`core/types.ts`)
Each scene exposes `scene`, `camera`, `enter()`, `update(dt)`, `skip()`, `resize()`, `dispose()`, and an optional `goToSection()`. The **Director** owns which scene is live, the veils between scenes, preloading, and spellbook jumps such as "go straight to Projects": it loads the hall and applies the earlier spells instantly.

## Performance
- Quality tiers (`high`/`medium`/`low`) come from device hints and are downgraded automatically if the frame rate stays low. They control pixel ratio, bloom, water reflection resolution, particle counts and light counts.
- At most 4–6 dynamic lights per scene. Glow comes from emissive materials plus bloom.
- Particles animate in the vertex shader, so the CPU does no per-particle work. Candles are instanced.
- Only the live scene and the next one exist in memory.

## Accessibility and fallbacks
- `prefers-reduced-motion`, plus a toggle in the spellbook: cinematic moves become short crossfades, idle sway and bobbing stop, particle counts drop.
- Keyboard: `Space`/`Enter` casts or continues, `Esc` closes or returns, `S` skips, `M` opens the spellbook, and arrow keys move between projects.
- No WebGL, a lost context, or a scene that fails to load → the **parchment version**, a static HTML page with all content. It is also available from the spellbook at any time.
