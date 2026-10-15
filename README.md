# The Journey — Hriday Chatrath's portfolio

An interactive, Wizarding World–inspired 3D journey. Visitors punch a ticket on Platform 9¾, cross the Black Lake by boat while captions introduce the portfolio, then walk through the great doors into the Great Hall. There, four spells are cast one after another:

| Spell | Reveals | What happens |
|---|---|---|
| **Lumos** | About me | A light rises from the wand and bursts over the tables. A wave of flame lights hundreds of floating candles, the clouds in the enchanted ceiling part, and a parchment unfurls. |
| **Accio** | Projects | ProxyProof (a tome), Envelope (an orrery) and OceanNova (a crystal orb) stream down from the rose window and hover in the aisle. Each one can be opened. |
| **Expecto Patronum** | Aspirations | Silver light gathers into a stag that gallops the length of the hall and back while the room turns silver. |
| **Lumos Maxima** | Contact | A column of light reaches the ceiling, the stars blaze, and a sealed letter drifts down and opens. |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + content check + production build
npm run preview    # serve the production build
npm run assets     # re-download and re-compress the Poly Haven assets (already committed)
```

`npm run check:content -- --online` also requests every link in the content file and reports any that are broken.

## Edit your content

**Everything personal lives in [`src/content/portfolio.ts`](src/content/portfolio.ts).** Nothing else needs to change.

- `PLACEHOLDER` marks text that still needs writing. It shows on the site with a dashed outline so you can't miss it.
- `DRAFT` marks text written from your project READMEs. Reword it in your own voice.
- `CONFIRM` marks text that is probably right but needs checking.
- A link with `url: ''` is hidden automatically, so the site never shows a dead button.
- To add a résumé, put `resume.pdf` in `public/` and set its url to `./resume.pdf`.

`npm run check:content` lists everything still to fill in.

## Deploy

The build is a static folder (`dist/`) with relative paths, so it works on any static host: Vercel, Netlify, Cloudflare Pages, or GitHub Pages (including a sub-path).

```bash
npm run build
```

## Controls

| | Desktop | Touch |
|---|---|---|
| Cast / continue | `Space` or `Enter`, or click the glowing button | Tap the button |
| Back / close | `Esc` | Close button on the panel |
| Skip a cinematic | `S` or **Skip** | **Skip** (top right) |
| Row faster on the lake | Hold the mouse button or `Shift` | Press and hold |
| Spellbook (jump anywhere, settings) | `M` or the book icon | Book icon |
| Previous / next project | `←` / `→` | Buttons in the panel |

The **Spellbook** jumps straight to any chapter and marks the ones you've visited. It also has toggles for sound, reduced motion and lighter graphics, and links to the **parchment version**: a plain HTML page with all the content.

## How it's built

Vite + TypeScript + Three.js + GSAP.

- **Assets:** photo-scanned CC0 textures, HDRI lighting, a photographic night sky and props from [Poly Haven](https://polyhaven.com), compressed to WebP by `scripts/fetch-assets.mjs` (about 11 MB in total, loaded per scene; see `public/assets/CREDITS.md`).
- **Generated in code:** the train, castle, hall architecture, particles and all sound. If any asset fails to load, the scene falls back to its procedural version instead of breaking.
- **Rendering:** multisampled post-processing (no jagged edges), ACES tone mapping, bloom, a colour grade, and soft shadows on capable GPUs.
- **Camera:** spring-damped, so every move eases in and out.
- **Music:** an original ambient score, slow strings under a celesta-like bell line, composed procedurally in `core/audio.ts` (not the film theme). Sound and music stay off until the visitor turns them on, from the ticket or the speaker icon.
- **Performance:** full detail only on strong discrete GPUs. Intel UHD-class laptops get a lighter profile, and resolution adapts to hold about 55–60 fps.

- `src/core/`: the engine (renderer, bloom, colour grade, loop), the director (lazy scene loading, preloading, veiled transitions, spellbook jumps), procedural audio, quality tiers and settings.
- `src/scenes/`: one module per scene (station, lake, Great Hall). Each is lazy-loaded with `import()`, preloaded while the previous scene plays, and disposed afterwards.
- `src/world/`: builders for the train, castle, boat, Great Hall, door, artefacts, letter and Patronus stag.
- `src/fx/`: particles, fog, sky, flames, the wand and the camera rig.
- `src/ui/`: the DOM overlay (ticket, cast button, panels, spellbook and fallback).

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the scene contract and the performance and accessibility decisions.

**Performance:** quality tiers come from device hints, and resolution scales dynamically to hold the frame rate. Particles animate in the vertex shader, candles are instanced, each scene has at most about six dynamic lights, and only two scenes exist at once.

**Fallbacks:**
- `prefers-reduced-motion` is respected, and there's a manual toggle as well.
- No WebGL, a lost context, or a scene that fails to load: the visitor gets a retry option or the parchment version.
- Without JavaScript, a `<noscript>` message shows.

*Harry Potter and the Wizarding World belong to their respective owners. This is a non-commercial, fan-inspired personal portfolio.*
