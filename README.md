# The Journey — Hriday Chatrath's portfolio

An interactive, Wizarding World–inspired 3D journey. Visitors punch a ticket on Platform 9¾, cross the Black Lake by boat, and walk a candlelit Hogwarts corridor where spells reveal the portfolio:

| Spell | Reveals | What happens |
|---|---|---|
| **Lumos** | About me | An orb of light races down the dark corridor and lights every candle and torch it passes. A parchment unfurls. |
| **Accio** | Projects | ProxyProof (a tome), Envelope (an orrery) and OceanNova (a crystal orb) fly in from the dark end of the corridor. Each one can be inspected. |
| **Expecto Patronum** | Aspirations | Silver light gathers from the wand into a particle stag. The hall turns silver, and the stag leads you to the door. |
| **Alohomora** | Contact | Rune rings light up, the lock spins, and the great door bursts open onto a round chamber under an enchanted sky. |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + content check + production build
npm run preview    # serve the production build
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

Vite + TypeScript + Three.js + GSAP. There are no downloaded models, textures or audio files. Stone, wood, signs, water normals, castle windows and every sound are generated at runtime, so nothing can fail to load and the first visit downloads about 180 KB of gzipped JS.

- `src/core/`: the engine (renderer, bloom, colour grade, loop), the director (lazy scene loading, preloading, veiled transitions, spellbook jumps), procedural audio, quality tiers and settings.
- `src/scenes/`: one module per scene. Each is lazy-loaded with `import()`, preloaded while the previous scene plays, and disposed afterwards.
- `src/world/`: builders for the train, castle, boat, hall, door, artefacts and Patronus stag.
- `src/fx/`: particles, fog, sky, flames and the wand.
- `src/ui/`: the DOM overlay (ticket, cast button, panels, spellbook and fallback).

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the scene contract and the performance and accessibility decisions.

**Performance:** quality tiers come from device hints and drop automatically if the frame rate stays below ~38 fps. Particles animate in the vertex shader, candles are instanced, each scene has at most about six dynamic lights, and only two scenes exist at once.

**Fallbacks:**
- `prefers-reduced-motion` is respected, and there's a manual toggle as well.
- No WebGL, a lost context, or a scene that fails to load: the visitor gets a retry option or the parchment version.
- Without JavaScript, a `<noscript>` message shows.

*Harry Potter and the Wizarding World belong to their respective owners. This is a non-commercial, fan-inspired personal portfolio.*
