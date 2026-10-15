/**
 * The parchment version: every piece of portfolio content as a static,
 * accessible page. Shown when WebGL is unavailable, when the 3D scene fails,
 * or whenever the visitor asks for it from the spellbook.
 */
import { portfolio } from '../content/portfolio';
import { aboutBody, aspirationsBody, contactBody, esc, projectBody } from './content';

type Reason = 'nowebgl' | 'error' | 'chosen';

let hooks: { pause?: () => void; resume?: () => void } = {};
export const setFallbackHooks = (h: typeof hooks) => (hooks = h);

let el: HTMLElement | null = null;

export function showFallback(reason: Reason) {
  hooks.pause?.();
  el?.remove();
  el = document.createElement('main');
  el.className = 'fallback';
  el.setAttribute('aria-label', 'Portfolio — parchment version');
  const notice =
    reason === 'nowebgl'
      ? `<p class="fb-notice">Your device can’t open the 3D journey, so here is the whole story on parchment.</p>`
      : reason === 'error'
        ? `<p class="fb-notice">Something in the 3D journey failed to load, so here is the whole story on parchment.</p>`
        : '';
  el.innerHTML = `
    <div class="fb-wrap">
      <header class="fb-head">
        <p class="eyebrow">Platform 9¾ · One-way to Hogwarts</p>
        <h1>${esc(portfolio.name)}</h1>
        <p class="fb-role">${esc(portfolio.role)}</p>
        ${notice}
        ${reason === 'chosen' || reason === 'error' ? `<button type="button" class="go fb-back">Return to the 3D journey</button>` : ''}
      </header>
      <section aria-labelledby="fb-about"><p class="eyebrow">Lumos</p><h2 id="fb-about">${esc(portfolio.about.heading)}</h2></section>
      <section aria-labelledby="fb-proj"><p class="eyebrow">Accio</p><h2 id="fb-proj">Projects</h2></section>
      <section aria-labelledby="fb-asp"><p class="eyebrow">Expecto Patronum</p><h2 id="fb-asp">${esc(portfolio.aspirations.heading)}</h2></section>
      <section aria-labelledby="fb-contact"><p class="eyebrow">Lumos Maxima</p><h2 id="fb-contact">${esc(portfolio.contact.heading)}</h2></section>
    </div>`;
  const sections = el.querySelectorAll('section');
  sections[0].append(aboutBody());
  for (const p of portfolio.projects) {
    const art = document.createElement('article');
    art.className = 'fb-project';
    art.innerHTML = `<h3 class="fb-pname">${esc(p.name)}</h3>`;
    art.append(projectBody(p));
    sections[1].append(art);
  }
  sections[2].append(aspirationsBody());
  sections[3].append(contactBody());
  el.querySelector('.fb-back')?.addEventListener('click', hideFallback);
  document.body.append(el);
  document.body.classList.add('fallback-open');
  el.focus();
}

export function hideFallback() {
  el?.remove();
  el = null;
  document.body.classList.remove('fallback-open');
  hooks.resume?.();
}
