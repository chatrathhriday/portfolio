/**
 * Turns the content config into DOM for the panels. Shared by the 3D
 * experience and the parchment (fallback) version.
 */
import { portfolio, liveLinks, isPlaceholder, type Project, type LinkItem } from '../content/portfolio';
import { icons, linkIcon } from './icons';
import { $ } from './ui';

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Text node that is visibly marked when it still contains PLACEHOLDER. */
const txt = (s: string) => (isPlaceholder(s) ? `<span class="placeholder" title="Edit in src/content/portfolio.ts">${esc(s)}</span>` : esc(s));

const list = (items: string[], cls = '') => `<ul class="${cls}">${items.map((i) => `<li>${txt(i)}</li>`).join('')}</ul>`;

export const linkButtons = (links: LinkItem[]) =>
  liveLinks(links)
    .map(
      (l) =>
        `<a class="magic-link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"${l.kind === 'download' ? ' download' : ''}>${linkIcon(l.kind, l.label)}<span>${esc(l.label)}</span></a>`,
    )
    .join('');

export function aboutBody() {
  const a = portfolio.about;
  return $(`<div class="content about">
    <p class="lede">${txt(a.intro)}</p>
    <h3>Studying</h3>
    <ul class="plain">${a.education.map((e) => `<li><strong>${txt(e.title)}</strong><br><span class="muted">${txt(e.detail)}</span></li>`).join('')}</ul>
    <h3>Drawn to</h3>
    ${list(a.interests, 'runes')}
    <h3>How I solve problems</h3>
    <p>${txt(a.approach)}</p>
    ${a.beyond.length ? `<h3>Beyond the classroom</h3>${list(a.beyond, 'runes')}` : ''}
  </div>`);
}

export function projectBody(p: Project) {
  const links = linkButtons(p.links);
  return $(`<div class="content project">
    <p class="lede">${txt(p.tagline)}</p>
    <h3>The problem</h3>
    <p>${txt(p.problem)}</p>
    <h3>What I did</h3>
    <p>${txt(p.contribution)}</p>
    <h3>Key features</h3>
    ${list(p.features, 'runes')}
    <h3>Built with</h3>
    <p class="tags">${p.tech.map((t) => `<span>${esc(t)}</span>`).join('')}</p>
    ${p.note ? `<p class="note">${txt(p.note)}</p>` : ''}
    ${links ? `<div class="links">${links}</div>` : `<p class="note">Links will appear here once they are added.</p>`}
  </div>`);
}

export function aspirationsBody() {
  const a = portfolio.aspirations;
  return $(`<div class="content aspirations">
    <p class="lede">${txt(a.engineer)}</p>
    <h3>Next to explore</h3>
    ${list(a.explore, 'runes')}
    <h3>Problems worth solving</h3>
    ${list(a.problems, 'runes')}
    <h3>The long road</h3>
    <p>${txt(a.longTerm)}</p>
  </div>`);
}

export function contactBody(onRestart?: () => void) {
  const c = portfolio.contact;
  const el = $(`<div class="content contact">
    <p class="lede">${txt(c.blurb)}</p>
    <div class="owl-post">
      <a class="magic-link primary" href="mailto:${esc(c.email)}">${icons.mail}<span>${esc(c.email)}</span></a>
      <button type="button" class="copy-btn" aria-label="Copy email address">${icons.copy}<span>Copy</span></button>
    </div>
    <div class="links">${linkButtons(c.links)}</div>
    <blockquote class="farewell"><p>${txt(c.farewell)}</p><footer>${esc(c.signature)}</footer></blockquote>
    ${onRestart ? `<button type="button" class="go ghost restart">Begin the journey again</button>` : ''}
  </div>`);
  const copy = el.querySelector<HTMLButtonElement>('.copy-btn')!;
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(c.email);
      copy.querySelector('span')!.textContent = 'Copied';
    } catch {
      copy.querySelector('span')!.textContent = 'Select & copy';
    }
    setTimeout(() => (copy.querySelector('span')!.textContent = 'Copy'), 2000);
  });
  el.querySelector('.restart')?.addEventListener('click', () => onRestart?.());
  return el;
}
