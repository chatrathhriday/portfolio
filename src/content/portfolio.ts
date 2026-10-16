/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PORTFOLIO CONTENT — the only file you need to edit to change what the
 *  website says. Scenes, spells and UI all read from here.
 *
 *  Markers:
 *    PLACEHOLDER  → nothing real is known yet; replace it with your own text.
 *    DRAFT        → written from your project docs/READMEs; reword it in your
 *                   own voice and check it is accurate.
 *    CONFIRM      → probably right, but verify before submitting.
 *
 *  Links: any link left as '' is hidden automatically, so the site never shows
 *  a dead button. Run `npm run check:content` to list what is still unfilled.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface LinkItem {
  label: string;
  url: string; // '' = hidden
  kind?: 'live' | 'repo' | 'download' | 'docs' | 'video';
}

export interface Project {
  id: string;
  name: string;
  /** Short subtitle shown on the summoned artefact. */
  tagline: string;
  /** Which magical object represents the project in the Great Hall. */
  artefact: 'tome' | 'orrery' | 'orb';
  /** Accent colour of the artefact (hex). */
  color: string;
  problem: string;
  contribution: string;
  tech: string[];
  features: string[];
  /** Honest notes on scope/limits — shown in small print. Optional. */
  note?: string;
  links: LinkItem[];
}

const NAME = 'Hriday Chatrath';
const ROLE = 'Student developer';

export interface Caption {
  /** 0..1 — how far across the lake the caption appears. */
  at: number;
  eyebrow?: string;
  title: string;
  sub?: string;
}

export const portfolio = {
  /* ── Identity ──────────────────────────────────────────────────────────── */
  name: NAME,
  /** Shown under the name on the ticket. */
  role: ROLE,
  /** Used in <title> and share previews. */
  siteTitle: 'Hriday Chatrath — The Journey',

  /* ── Ticket (Scene 1) ──────────────────────────────────────────────────── */
  ticket: {
    from: "King's Cross",
    to: 'Hogwarts',
    platform: '9¾',
    departs: '11:00',
    class: 'First Year',
  },

  /* ── Music ─────────────────────────────────────────────────────────────── */
  music: {
    /**
     * Optional: your own music file, e.g. './music/theme.mp3' (put it in /public/music).
     * Only use audio you have the rights to publish. Leave '' to use the original
     * score that is generated in code.
     */
    file: './music/mystery-magic.mp3', // "Mystery Magic" by HitsLab (Pixabay Content License)
    volume: 0.6,
  },

  /* ── Boat ride captions (Scene 2) ─────────────────────────────────────── */
  // Edit freely. They fade in one after another as the boat crosses the lake.
  lakeCaptions: [
    { at: 0.03, eyebrow: 'The Black Lake', title: 'Every journey starts on the water.', sub: 'Sit back — the boats know the way.' },
    { at: 0.2, eyebrow: 'Rowing with you tonight', title: NAME, sub: 'B.Tech fresher at VIT · ' + ROLE },
    { at: 0.38, eyebrow: 'A little about the traveller', title: 'A curious mind with a hunger to learn', sub: 'Books, cricket, football — and building things that solve real problems.' },
    { at: 0.56, eyebrow: 'Waiting inside the castle', title: 'Four spells. Three projects. One letter.', sub: 'Light the hall, summon the work, call the Patronus, open the last letter.' },
    { at: 0.78, eyebrow: 'Almost there', title: 'Heads down, first-years —', sub: 'we are going under the cliff.' },
  ] as Caption[],

  /* ── Great Hall arrival ───────────────────────────────────────────────── */
  hallTitle: { eyebrow: 'Hogwarts', title: 'The Great Hall', sub: 'Cast the spells in order — or open the spellbook to jump ahead.' },

  /* ── LUMOS · About me ─────────────────────────────────────────────────── */
  about: {
    heading: 'The one who lit the lamp',
    intro:
      'I have a curious mind and a hunger to learn. I love reading books, playing sports and exploring new things — and building software that solves real problems.',
    education: [
      { title: 'Vellore Institute of Technology (VIT)', detail: 'B.Tech, Engineering · Fresher' },
    ],
    interests: [
      'Building new things from scratch',
      'Security that holds up in hardware (Android Keystore, signed requests)',
      '3D and geospatial visualisation',
      'Environmental and climate data',
      'Applied machine learning with honest uncertainty',
    ],
    approach:
      'I love new problems — every one teaches me something more. I like to think a problem through properly first, and only then start solving it.',
    // Leave the array empty to hide this line.
    beyond: ['Listening to music', 'Reading books', 'Playing cricket and football', 'Binge-watching a good show'] as string[],
  },

  /* ── ACCIO · Projects ─────────────────────────────────────────────────── */
  projects: [
    {
      id: 'proxyproof',
      name: 'ProxyProof',
      tagline: 'Bluetooth attendance that a friend cannot mark for you',
      artefact: 'tome',
      color: '#8e2a2a',
      problem:
        'Proxy attendance: a classmate answers the roll call, scans a QR code or types a PIN for someone who is not in the room. Teachers lose minutes every class checking it by hand.',
      contribution:
        'Built it myself, end to end: the Flutter Android app with native Kotlin key handling, the Node.js backend, the live React dashboard, the threat model and the deployment.',
      tech: ['Flutter', 'Kotlin · Android Keystore', 'Node.js · Express', 'PostgreSQL (Neon) · PGlite', 'Socket.IO', 'React · Vite', 'Render'],
      features: [
        'Teacher phone broadcasts an iBeacon whose token is an HMAC that rotates every 10 s — the secret never leaves the server',
        'Two hardware-backed P-256 keys per phone: a silent device key and a fingerprint key invalidated when a new fingerprint is enrolled',
        'Every request is signed over its exact bytes, time-boxed and replay-proof',
        'Presence across the whole class (30 s buckets, median RSSI) plus a random fingerprint spot check',
        'Sign-in restricted to verified VIT Google accounts; new phones need admin approval',
        'Live dashboard over Socket.IO; teacher closes a class with one "Approve all"',
      ],
      note: 'Android is the shipped app; iPhone detection works, an iOS build is documented as future work.',
      links: [
        { label: 'Live dashboard', url: 'https://proxyproof.onrender.com', kind: 'live' },
        { label: 'Source on GitHub', url: 'https://github.com/chatrathhriday/ProxyProof', kind: 'repo' },
        { label: 'Download APK', url: 'https://github.com/chatrathhriday/ProxyProof/releases/latest/download/ProxyProof.apk', kind: 'download' },
        { label: 'Demo video', url: '', kind: 'video' }, // add a link when you have one
      ],
    },
    {
      id: 'envelope',
      name: 'Envelope',
      tagline: 'A 3D environmental decision simulator for building projects',
      artefact: 'orrery',
      color: '#2f6b4f',
      problem:
        'Construction sites create dust, heat stress and embodied carbon long before a building is occupied, yet developers rarely see those impacts — or what mitigation would change — before they break ground.',
      contribution:
        'Worked on the backend: the server that fetches and caches the live environmental data feeds and generates the assessment report.',
      tech: ['TypeScript', 'React · Vite', 'CesiumJS', 'Google Photorealistic 3D Tiles', 'Web Workers', 'Zustand', 'Hono', 'Playwright (PDF)', 'Gemini / Groq'],
      features: [
        'Your building as a 3D model at its real location on photorealistic 3D tiles',
        'Separate heat-map layers for Dust (PM10/PM2.5), Heat (surface temperature, worker UTCI) and construction carbon (A1–A5)',
        'Driven by live open data: Open-Meteo, OpenAQ, OpenStreetMap, SoilGrids, NASA POWER',
        'Toggle mitigations — sprinkling, wind barriers, shade nets, low-carbon concrete, grid power — and compare baseline vs mitigated',
        'Models run in Web Workers; every coefficient is cited to its source',
        'Exports an assessment report: the LLM writes prose only, and a validator rejects any number not in the model output',
      ],
      note: 'Screening-level (Tier 1–2) models, labelled as indicative — not regulatory dispersion modelling.',
      links: [
        { label: 'Source on GitHub', url: '', kind: 'repo' }, // no public repo yet — add the URL when there is one
        { label: 'Live demo', url: '', kind: 'live' },
      ],
    },
    {
      id: 'oceannova',
      name: 'OceanNova',
      tagline: 'Finding the unusual in hyperspectral ocean colour',
      artefact: 'orb',
      color: '#2b4f7a',
      problem:
        'NASA\'s PACE satellite sees the ocean in 172 colours. Spotting spectra that are genuinely abnormal — and saying what likely caused them, or admitting it cannot tell — is hard to do honestly.',
      contribution:
        'Built it myself: the ML service (feature pipeline, detector ensemble, cause classifier, out-of-distribution gate) and the 3D web front end.',
      tech: ['Python', 'scikit-learn', 'FastAPI', 'xarray · netCDF', 'earthaccess', 'PyTorch (experimental CNN)', 'Next.js', 'React Three Fiber'],
      features: [
        'Spectral pipeline: quality flags, denoising, SNV, derivatives, continuum removal, 24-component PCA manifold',
        'Seven novelty detectors fused by reliability, with their disagreement kept as uncertainty',
        'A stacked cause classifier that can answer "unknown_mixed" instead of forcing a label',
        'Evidence wavelengths and a confidence breakdown for every prediction',
        'Language model used only to explain results, never to score them',
      ],
      note: 'The included model is trained on synthetic PACE-shaped data; its metrics are engineering benchmarks, not field accuracy.',
      links: [
        { label: 'Source on GitHub', url: 'https://github.com/chatrathhriday/OceanNova', kind: 'repo' },
        { label: 'Live demo', url: '', kind: 'live' },
      ],
    },
  ] as Project[],

  /* ── EXPECTO PATRONUM · Aspirations ───────────────────────────────────── */
  aspirations: {
    heading: 'What the light is walking toward',
    engineer:
      'An engineer who keeps solving new problems and turns the answers into products people actually use.',
    explore: ['Data science', 'AI and machine learning', 'Building and shipping new products'],
    problems: ['Real-world problems that affect everyday people', 'Problems where data and AI can help people make better decisions'],
    longTerm: 'To build a startup of my own — and to do an MBA at an Ivy League school along the way.',
  },

  /* ── LUMOS MAXIMA · Contact ───────────────────────────────────────────── */
  contact: {
    heading: 'Send an owl',
    blurb: 'Internships, collaborations, a startup idea or just a good problem — the door is open.',
    email: 'chatrathhriday45@gmail.com',
    /** Shown as a tap-to-call link. Leave '' to hide it. */
    phone: '+91 88009 69860',
    links: [
      { label: 'GitHub', url: 'https://github.com/chatrathhriday' },
      { label: 'LinkedIn', url: '' }, // paste your LinkedIn URL to show it
      { label: 'Résumé', url: '' }, // put resume.pdf in /public and use './resume.pdf'
    ] as LinkItem[],
    /** The closing line of the whole journey. */
    farewell:
      'Every castle began as a stubborn idea and a long walk in the dark. Mine is still being built — and the lanterns are lit for whoever wants to build it with me.',
    signature: '— H.C.',
  },
};

export type Portfolio = typeof portfolio;

/** Links that are actually filled in. */
export const liveLinks = (links: LinkItem[]) => links.filter((l) => l.url.trim() !== '');

/** True when a string still contains an unfilled marker. Used to style placeholders. */
export const isPlaceholder = (s: string) => /PLACEHOLDER/.test(s);
