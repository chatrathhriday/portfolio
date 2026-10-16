/**
 * Entry point: capability check → loader → engine + director → station.
 * Anything that goes wrong lands on the parchment (static) version.
 */
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/im-fell-english/400.css';
import '@fontsource/im-fell-english/400-italic.css';
import './ui/styles.css';
import { portfolio } from './content/portfolio';
import { hasWebGL } from './core/quality';
import { showFallback, setFallbackHooks } from './ui/fallback';

document.title = portfolio.siteTitle;

const loader = document.getElementById('loader')!;
const fill = loader.querySelector<HTMLElement>('.loader-fill')!;
const spark = loader.querySelector<HTMLElement>('.loader-spark')!;
const status = loader.querySelector<HTMLElement>('.loader-status')!;
let shown = 0;
const progress = (p: number, label?: string) => {
  shown = Math.max(shown, p);
  fill.style.transform = `scaleX(${shown})`;
  spark.style.left = `${shown * 100}%`;
  loader.setAttribute('aria-valuenow', String(Math.round(shown * 100)));
  if (label) status.textContent = label;
};
const hideLoader = () => {
  loader.classList.add('done');
  setTimeout(() => loader.remove(), 1400);
};

async function start() {
  if (!hasWebGL()) {
    hideLoader();
    showFallback('nowebgl');
    return;
  }
  progress(0.05, 'Gathering steam');
  // Fonts are drawn into canvas textures (signs, plates), so wait briefly for them.
  const fonts = Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 2500))]);
  const [{ Engine }, { Director }, { ui }, { installToonShading }] = await Promise.all([import('./core/Engine'), import('./core/Director'), import('./ui/ui'), import('./core/toon'), fonts]);
  installToonShading(); // anime cel shading — must run before any material compiles
  progress(0.2, 'Polishing the brass');

  let engine: InstanceType<typeof Engine>;
  try {
    engine = new Engine(document.getElementById('stage')!);
  } catch (e) {
    console.error(e);
    hideLoader();
    showFallback('nowebgl');
    return;
  }
  const director = new Director(engine);
  ui.init(director);
  // Browsers only allow audio after a user gesture: start it on the very first click, tap or key.
  const { audio } = await import('./core/audio');
  const firstGesture = () => audio.unlock();
  for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(ev, firstGesture, { once: true, capture: true });
  setFallbackHooks({ pause: () => engine.stop(), resume: () => engine.start() });

  engine.canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    engine.stop();
    ui.showError('The magic flickered out (graphics context lost).', () => location.reload());
  });

  const labels = ['Polishing the brass', 'Lighting the lanterns', 'Stoking the firebox', 'Checking tickets'];
  await director.boot((p) => progress(0.2 + p * 0.78, labels[Math.min(3, Math.floor(p * 4))]));
  engine.start();
  progress(1, 'All aboard');
  // one frame so the first image is on screen before the loader lifts
  let lifted = false;
  const lift = () => {
    if (lifted) return;
    lifted = true;
    hideLoader();
  };
  requestAnimationFrame(() => requestAnimationFrame(lift));
  setTimeout(lift, 600); // rAF may be paused in background tabs

  // dev hook for automated checks
  if (import.meta.env.DEV) {
    const { default: gsap } = await import('gsap');
    // Drives frames manually so automated checks work even when the tab is hidden.
    const pump = async (seconds: number) => {
      gsap.ticker.lagSmoothing(0);
      const end = performance.now() + seconds * 1000;
      while (performance.now() < end) {
        gsap.ticker.tick();
        engine.tick();
        await new Promise((r) => setTimeout(r, 16));
      }
    };
    (window as unknown as Record<string, unknown>).__journey = { director, engine, ui, pump, audio };
  }
}

start().catch((err) => {
  console.error('[boot] failed', err);
  hideLoader();
  showFallback('error');
});
