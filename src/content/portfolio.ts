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
const ROLE = 'Student developer'; // CONFIRM

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
  /** Shown under the name on the ticket. PLACEHOLDER: e.g. "Student · Developer". */
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
    file: './music/theme.mp3', // local file — kept out of git (see .gitignore)
    volume: 0.6,
  },

  /* ── Boat ride captions (Scene 2) ─────────────────────────────────────── */
  // DRAFT — edit freely. They fade in one after another as the boat crosses the lake.
  lakeCaptions: [
    { at: 0.03, eyebrow: 'The Black Lake', title: 'No oars tonight.', sub: 'The boats know the way.' },
    { at: 0.2, eyebrow: 'Your guide this evening', title: NAME, sub: ROLE },
    { at: 0.38, title: 'I build software that has to work in the real world', sub: 'Phones in a lecture hall. A building site. Light from the open ocean.' },
    { at: 0.58, eyebrow: 'Waiting in the castle', title: 'Four spells. Three projects. One letter.' },
    { at: 0.8, title: 'Keep your heads down —', sub: 'we are going under the cliff.' },
  ] as Caption[],

  /* ── Great Hall arrival ───────────────────────────────────────────────── */
  hallTitle: { eyebrow: 'Hogwarts', title: 'The Great Hall', sub: 'Cast the spells in order — or open the spellbook to jump ahead.' },

  /* ── LUMOS · About me ─────────────────────────────────────────────────── */
  about: {
    heading: 'The one who lit the lamp',
    // DRAFT — based on your projects; rewrite in your own words.
    intro:
      'I build software that has to survive contact with the real world — phones in a lecture hall, a construction site in Gurugram, satellite spectra from the open ocean.',
    education: [
      // CONFIRM — VIT is inferred from ProxyProof's @vitstudent.ac.in sign-in. Add degree, branch and year.
      { title: 'Vellore Institute of Technology (VIT)', detail: 'PLACEHOLDER: degree · branch · year of study' },
    ],
    // DRAFT — taken from the work in your three projects.
    interests: [
      'Security that holds up in hardware (Android Keystore, signed requests)',
      '3D and geospatial visualisation',
      'Environmental and climate data',
      'Applied machine learning with honest uncertainty',
    ],
    // DRAFT — reflects patterns visible in your READMEs (threat models, "numbers are honest").
    approach:
      'Start from the person who has to use it, write down how it could fail, then make the system say "I don\'t know" instead of guessing. Every number on screen should trace back to a source.',
    // PLACEHOLDER — interests beyond academics. Leave the array empty to hide this line.
    beyond: [] as string[],
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
        // CONFIRM — wording about your role.
        'Designed and built the full system: Flutter Android app with native Kotlin key handling, Node.js backend, live React dashboard, threat model and deployment.',
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
        { label: 'Demo video', url: '', kind: 'video' }, // PLACEHOLDER
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
        // CONFIRM — wording about your role.
        'Built the 3D site viewer, the screening-level dust / heat / greenhouse-gas models, the live-data layer, the mitigation scenario engine and the report export.',
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
        { label: 'Source on GitHub', url: '', kind: 'repo' }, // PLACEHOLDER — no public repo found yet
        { label: 'Live demo', url: '', kind: 'live' }, // PLACEHOLDER
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
        // CONFIRM — wording about your role.
        'Built the ML service (feature pipeline, detector ensemble, cause classifier, out-of-distribution gate) and the 3D web front end.',
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
        { label: 'Source on GitHub', url: '', kind: 'repo' }, // PLACEHOLDER
        { label: 'Live demo', url: '', kind: 'live' }, // PLACEHOLDER
      ],
    },
  ] as Project[],

  /* ── EXPECTO PATRONUM · Aspirations ───────────────────────────────────── */
  aspirations: {
    heading: 'What the light is walking toward',
    // PLACEHOLDER/DRAFT — every line below is a starting point drawn from your
    // projects. Replace with your real goals.
    engineer:
      'PLACEHOLDER: the kind of engineer you want to become — e.g. one who ships systems people can trust because their limits are written down.',
    explore: [
      'PLACEHOLDER: technologies you want to learn next',
      'e.g. on-device ML, geospatial engines, secure hardware',
    ],
    problems: [
      'PLACEHOLDER: problems you want to solve',
      'e.g. climate and environmental decision tools that people actually use',
    ],
    longTerm: 'PLACEHOLDER: your longer-term ambition, in one or two sentences.',
  },

  /* ── ALOHOMORA · Contact ──────────────────────────────────────────────── */
  contact: {
    heading: 'Send an owl',
    blurb: 'Internships, collaborations, or just a good problem — the door is open.', // DRAFT
    email: 'chatrathhriday45@gmail.com', // CONFIRM this is the address you want public
    links: [
      { label: 'GitHub', url: 'https://github.com/chatrathhriday' },
      { label: 'LinkedIn', url: '' }, // PLACEHOLDER — paste your LinkedIn URL
      { label: 'Résumé', url: '' }, // PLACEHOLDER — put resume.pdf in /public and use './resume.pdf'
    ] as LinkItem[],
    /** The closing line of the whole journey. DRAFT — make it yours. */
    farewell: 'The castle lights stay on for whoever finds the door. Thank you for walking all the way here.',
    signature: '— H.C.',
  },
};

export type Portfolio = typeof portfolio;

/** Links that are actually filled in. */
export const liveLinks = (links: LinkItem[]) => links.filter((l) => l.url.trim() !== '');

/** True when a string still contains an unfilled marker. Used to style placeholders. */
export const isPlaceholder = (s: string) => /PLACEHOLDER/.test(s);
