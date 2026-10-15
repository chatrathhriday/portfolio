# Architecture

## Stack
- **Vite + TypeScript**, no UI framework. The DOM UI is small, so plain modules are lighter than React.
- **Three.js** (vanilla) for every scene, plus `EffectComposer` → `UnrealBloomPass` → grade pass (vignette, grain) → `OutputPass` (ACES tone mapping).
- **GSAP** for camera and cinematic timelines.
- **No downloaded 3D models, textures or audio.** Stone, wood, paving, castle windows, signs, normal maps and every sound are generated at runtime (canvas and Web Audio). Nothing can 404, the first load stays small, and each scene builds in a few hundred milliseconds.

## Journey (scene sequence)

| # | Scene module | What happens | Leaves via |
|---|---|---|---|
| 1 | `scenes/station` | Night platform, red locomotive and coaches, steam, lanterns. Camera drifts in; the visitor's name is on a ticket. **Board** punches the ticket. | Whistle → train departs → camera follows into the steam → **steam veil** |
| 2 | `scenes/lake` | First-year boat over the Black Lake, mirror-reflecting water, mist, other boats, Hogwarts growing on the cliff. Hold to row faster, or skip. | Boat passes under the cliff into darkness → **dark veil** |
| 3 | `scenes/corridor` | Stone corridor in darkness. **Lumos** lights the corridor → About. **Accio** summons three artefacts → Projects (inspect mode). **Expecto Patronum** forms a particle stag → Aspirations; the stag leads to the door. | Stag passes through the far door → **silver veil** |
| 4 | `scenes/chamber` | The great door. **Alohomora** lights its runes, bursts it open, and reveals a round chamber under an enchanted sky → Contact and the closing line. | "Begin again" → station |

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
Each scene exposes `scene`, `camera`, `enter()`, `update(dt)`, `skip()`, `resize()`, `dispose()`, and an optional `goToSection()`. The **Director** owns which scene is live, the veils between scenes, and spellbook jumps such as "go straight to Projects": it loads the corridor and applies the earlier spells instantly.

## Performance
- Quality tiers (`high`/`medium`/`low`) come from device hints and are downgraded automatically if the frame rate stays low. They control pixel ratio, bloom, water reflection resolution, particle counts and light counts.
- At most 4–6 dynamic lights per scene. Glow comes from emissive materials plus bloom.
- Particles animate in the vertex shader, so the CPU does no per-particle work. Candles are instanced.
- Only the live scene and the next one exist in memory.

## Accessibility and fallbacks
- `prefers-reduced-motion`, plus a toggle in the spellbook: cinematic moves become short crossfades, idle sway and bobbing stop, particle counts drop.
- Keyboard: `Space`/`Enter` casts or continues, `Esc` closes or returns, `S` skips, `M` opens the spellbook, and arrow keys move between projects.
- No WebGL, a lost context, or a scene that fails to load → the **parchment version**, a static HTML page with all content. It is also available from the spellbook at any time.
