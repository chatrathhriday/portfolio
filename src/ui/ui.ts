/**
 * DOM overlay that sits above the canvas: veils, hints, the cast button,
 * skip control, panels, spellbook and error notices. Scenes talk to this
 * module; it never touches Three.js.
 */
import type { Director } from '../core/Director';
import type { Section, VeilKind } from '../core/types';
import { settings, dur } from '../core/settings';
import { audio } from '../core/audio';
import { icons } from './icons';
import { showFallback } from './fallback';

const $ = <T extends HTMLElement = HTMLElement>(html: string): T => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
};

let root: HTMLElement;
let director: Director;
let veilEl: HTMLElement, hintEl: HTMLElement, actionsEl: HTMLElement, skipEl: HTMLButtonElement;
let panelEl: HTMLElement, panelBody: HTMLElement, bookEl: HTMLElement, errorEl: HTMLElement;
let panelOnClose: (() => void) | null = null;
let skipHandler: (() => void) | null = null;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PanelOptions {
  variant: 'parchment' | 'patronus' | 'contact' | 'project';
  eyebrow?: string;
  title: string;
  body: HTMLElement;
  /** Label for the close / return control. */
  closeLabel?: string;
  onClose?: () => void;
  /** Side on desktop. Mobile always uses a bottom sheet. */
  side?: 'right' | 'left' | 'center';
}

export const ui = {
  init(d: Director) {
    director = d;
    root = document.getElementById('ui')!;
    veilEl = $(`<div class="veil" aria-hidden="true"><div class="veil-loading"><span></span>The path is being prepared…</div></div>`);
    hintEl = $(`<p class="hint" role="status" aria-live="polite"></p>`);
    actionsEl = $(`<div class="actions"></div>`);
    skipEl = $(`<button class="skip" type="button" aria-label="Skip this scene">Skip <span aria-hidden="true">›</span><kbd>S</kbd></button>`);
    panelEl = $(`<aside class="panel" aria-hidden="true" tabindex="-1"><div class="panel-inner"></div></aside>`);
    panelBody = panelEl.querySelector('.panel-inner')!;
    errorEl = $(`<div class="error-card" role="alert" hidden></div>`);
    const bookBtn = $(`<button class="book-btn" type="button" aria-haspopup="dialog" aria-label="Open the spellbook (menu)">${icons.book}<span>Spellbook</span></button>`);
    const soundBtn = $(`<button class="sound-btn" type="button"></button>`);
    bookEl = buildSpellbook();

    root.append(hintEl, actionsEl, skipEl, panelEl, bookBtn, soundBtn, bookEl, errorEl, veilEl);

    skipEl.addEventListener('click', () => {
      audio.ui();
      (skipHandler ?? (() => director.skip()))();
    });
    bookBtn.addEventListener('click', () => ui.toggleBook());
    const paintSound = () => {
      const on = settings.get().sound;
      soundBtn.innerHTML = on ? icons.soundOn : icons.soundOff;
      soundBtn.setAttribute('aria-label', on ? 'Mute sound' : 'Turn sound on');
      soundBtn.setAttribute('aria-pressed', String(on));
    };
    paintSound();
    settings.on(paintSound);
    soundBtn.addEventListener('click', () => {
      audio.unlock();
      settings.set('sound', !settings.get().sound);
    });
    document.addEventListener('keydown', onKey);
    director.onChange(() => refreshBook());
  },

  /* ── Veil between scenes ──────────────────────────────────────────── */
  veil: {
    async cover(kind: VeilKind) {
      veilEl.dataset.kind = kind;
      veilEl.classList.add('on');
      await wait(dur(kind === 'steam' ? 1100 : 800, 300));
    },
    async reveal() {
      veilEl.classList.remove('on');
      await wait(dur(1200, 300));
    },
    loading(on: boolean) {
      veilEl.classList.toggle('loading', on);
    },
  },

  /* ── Hints ────────────────────────────────────────────────────────── */
  hint(text: string | null) {
    if (!text) {
      hintEl.classList.remove('on');
      return;
    }
    hintEl.textContent = text;
    hintEl.classList.add('on');
  },

  /* ── Skip control ─────────────────────────────────────────────────── */
  setSkippable(on: boolean, handler?: () => void, label = 'Skip') {
    skipHandler = handler ?? null;
    skipEl.firstChild!.textContent = label + ' ';
    skipEl.classList.toggle('on', on);
  },

  /* ── Bottom-centre actions (cast / continue) ──────────────────────── */
  showCast(spell: string, onCast: () => void, sub?: string, secondary?: { label: string; onClick: () => void }) {
    actionsEl.innerHTML = '';
    const b = $<HTMLButtonElement>(
      `<button class="cast" type="button" data-primary><span class="cast-glyph">${icons.wand}</span><span class="cast-text"><span class="cast-verb">Cast</span><span class="cast-name">${spell}</span>${sub ? `<span class="cast-sub">${sub}</span>` : ''}</span><kbd>Space</kbd></button>`,
    );
    b.addEventListener('click', () => {
      audio.unlock();
      ui.hideActions();
      onCast();
    });
    actionsEl.append(b);
    if (secondary) {
      const g = $<HTMLButtonElement>(`<button class="go ghost" type="button">${secondary.label}</button>`);
      g.addEventListener('click', () => {
        audio.ui();
        secondary.onClick();
      });
      actionsEl.append(g);
    }
    actionsEl.classList.add('on');
  },

  /** Cinematic title card: fades in, holds, fades out. */
  caption(c: { eyebrow?: string; title: string; sub?: string }, holdMs = 4200) {
    const el = $(`<div class="caption" aria-live="polite">${c.eyebrow ? `<p class="cap-eyebrow">${c.eyebrow}</p>` : ''}<p class="cap-title">${c.title}</p>${c.sub ? `<p class="cap-sub">${c.sub}</p>` : ''}</div>`);
    root.querySelectorAll('.caption').forEach((o) => {
      o.classList.remove('on');
      setTimeout(() => o.remove(), 1200);
    });
    root.append(el);
    void el.offsetWidth;
    el.classList.add('on');
    setTimeout(() => {
      el.classList.remove('on');
      setTimeout(() => el.remove(), 1400);
    }, dur(holdMs / 1000, holdMs / 1000) * 1000);
  },

  clearCaptions() {
    root.querySelectorAll('.caption').forEach((o) => o.remove());
  },

  showAction(label: string, onClick: () => void, secondary?: { label: string; onClick: () => void }) {
    actionsEl.innerHTML = '';
    const b = $<HTMLButtonElement>(`<button class="go" type="button" data-primary>${label} <span aria-hidden="true">→</span></button>`);
    b.addEventListener('click', () => {
      audio.ui();
      ui.hideActions();
      onClick();
    });
    actionsEl.append(b);
    if (secondary) {
      const s = $<HTMLButtonElement>(`<button class="go ghost" type="button">${secondary.label}</button>`);
      s.addEventListener('click', () => {
        audio.ui();
        ui.hideActions();
        secondary.onClick();
      });
      actionsEl.append(s);
    }
    actionsEl.classList.add('on');
  },

  hideActions() {
    actionsEl.classList.remove('on');
  },

  /* ── Content panel ────────────────────────────────────────────────── */
  openPanel(o: PanelOptions) {
    panelOnClose = o.onClose ?? null;
    panelEl.className = `panel panel-${o.variant} side-${o.side ?? 'right'}`;
    panelBody.innerHTML = '';
    const head = $(`<header class="panel-head">${o.eyebrow ? `<p class="eyebrow">${o.eyebrow}</p>` : ''}<h2>${o.title}</h2></header>`);
    const close = $<HTMLButtonElement>(`<button class="panel-close" type="button">${o.closeLabel ?? 'Close'} <kbd>Esc</kbd></button>`);
    close.addEventListener('click', () => {
      audio.ui();
      ui.closePanel();
    });
    panelBody.append(head, o.body, close);
    panelEl.scrollTop = 0;
    panelBody.scrollTop = 0;
    panelEl.setAttribute('aria-hidden', 'false');
    panelEl.setAttribute('role', 'dialog');
    panelEl.setAttribute('aria-label', o.title.replace(/<[^>]+>/g, ''));
    void panelEl.offsetWidth; // commit the closed state so the transition runs
    panelEl.classList.add('open');
    panelEl.focus({ preventScroll: true });
    audio.page();
  },

  get panelOpen() {
    return panelEl.classList.contains('open');
  },

  closePanel(silent = false) {
    if (!panelEl.classList.contains('open')) return;
    panelEl.classList.remove('open');
    panelEl.setAttribute('aria-hidden', 'true');
    const cb = panelOnClose;
    panelOnClose = null;
    if (!silent) cb?.();
  },

  /* ── Spellbook ────────────────────────────────────────────────────── */
  toggleBook(force?: boolean) {
    const open = force ?? !bookEl.classList.contains('open');
    bookEl.classList.toggle('open', open);
    bookEl.setAttribute('aria-hidden', String(!open));
    audio.unlock();
    audio.page();
    if (open) {
      refreshBook();
      (bookEl.querySelector('button.chapter') as HTMLButtonElement | null)?.focus();
    }
  },

  /* ── Errors ───────────────────────────────────────────────────────── */
  showError(msg: string, retry?: () => void) {
    errorEl.hidden = false;
    errorEl.innerHTML = `<p>${msg}</p>`;
    const row = $(`<div class="error-actions"></div>`);
    if (retry) {
      const r = $<HTMLButtonElement>(`<button type="button">Try again</button>`);
      r.addEventListener('click', () => {
        errorEl.hidden = true;
        retry();
      });
      row.append(r);
    }
    const f = $<HTMLButtonElement>(`<button type="button" class="ghost">Read the parchment version</button>`);
    f.addEventListener('click', () => showFallback('chosen'));
    row.append(f);
    errorEl.append(row);
  },
};

/* ── Spellbook construction ─────────────────────────────────────────── */

const CHAPTERS: { s: Section; num: string; spell?: string; title: string }[] = [
  { s: 'station', num: 'I', title: 'Platform 9¾' },
  { s: 'lake', num: 'II', title: 'The Black Lake' },
  { s: 'about', num: 'III', spell: 'Lumos', title: 'About me' },
  { s: 'projects', num: 'IV', spell: 'Accio', title: 'Projects' },
  { s: 'aspirations', num: 'V', spell: 'Expecto Patronum', title: 'Aspirations' },
  { s: 'contact', num: 'VI', spell: 'Lumos Maxima', title: 'Contact' },
];

function buildSpellbook() {
  const el = $(`<div class="spellbook" role="dialog" aria-modal="false" aria-label="Spellbook" aria-hidden="true">
    <div class="book-page">
      <header><p class="eyebrow">Index of enchantments</p><h2>The Spellbook</h2></header>
      <nav class="chapters" aria-label="Jump to a section"></nav>
      <section class="book-settings" aria-label="Settings">
        <label><input type="checkbox" data-k="sound"> Sound</label>
        <label><input type="checkbox" data-k="reducedMotion"> Reduce motion</label>
        <label><input type="checkbox" data-k="lightGraphics"> Lighter graphics</label>
      </section>
      <p class="book-keys"><kbd>Space</kbd> cast / continue · <kbd>Esc</kbd> back · <kbd>S</kbd> skip · <kbd>M</kbd> spellbook</p>
      <div class="book-foot">
        <button type="button" class="link-btn" data-fallback>Read the parchment version</button>
        <button type="button" class="book-close" aria-label="Close spellbook">Close</button>
      </div>
    </div>
  </div>`);
  const nav = el.querySelector('.chapters')!;
  for (const c of CHAPTERS) {
    const b = $<HTMLButtonElement>(
      `<button type="button" class="chapter" data-s="${c.s}"><span class="num">${c.num}</span><span class="ct">${c.spell ? `<em>${c.spell}</em>` : ''}${c.title}</span><span class="seen" aria-hidden="true">✦</span></button>`,
    );
    b.addEventListener('click', () => {
      audio.ui();
      ui.toggleBook(false);
      director.goTo(c.s);
    });
    nav.append(b);
  }
  el.querySelectorAll<HTMLInputElement>('input[data-k]').forEach((inp) => {
    inp.addEventListener('change', () => {
      audio.unlock();
      settings.set(inp.dataset.k as 'sound', inp.checked);
    });
  });
  el.querySelector('.book-close')!.addEventListener('click', () => ui.toggleBook(false));
  el.querySelector('[data-fallback]')!.addEventListener('click', () => {
    ui.toggleBook(false);
    showFallback('chosen');
  });
  el.addEventListener('click', (e) => {
    if (e.target === el) ui.toggleBook(false);
  });
  return el;
}

function refreshBook() {
  if (!bookEl) return;
  const s = settings.get();
  bookEl.querySelectorAll<HTMLInputElement>('input[data-k]').forEach((inp) => {
    inp.checked = !!s[inp.dataset.k as keyof typeof s];
  });
  bookEl.querySelectorAll<HTMLButtonElement>('.chapter').forEach((b) => {
    b.classList.toggle('visited', director.visited.has(b.dataset.s as Section));
  });
}

/* ── Keyboard ───────────────────────────────────────────────────────── */

function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const key = e.key.toLowerCase();
  if (key === 'escape') {
    if (bookEl.classList.contains('open')) return ui.toggleBook(false);
    if (director.scene?.back?.()) return;
    if (ui.panelOpen) return ui.closePanel();
    return;
  }
  if (key === 'm') return ui.toggleBook();
  if (bookEl.classList.contains('open')) return;
  if (key === 's' && skipEl.classList.contains('on')) {
    skipEl.click();
    return;
  }
  if (key === ' ' || key === 'enter') {
    // Let focused buttons/links behave natively.
    if (tag === 'BUTTON' || tag === 'A') return;
    const primary = actionsEl.classList.contains('on') ? actionsEl.querySelector<HTMLButtonElement>('[data-primary]') : null;
    e.preventDefault();
    if (primary) primary.click();
    else director.scene?.primary?.();
  }
  if (key === 'arrowright' || key === 'arrowleft') {
    root.dispatchEvent(new CustomEvent('nav-arrow', { detail: key === 'arrowright' ? 1 : -1 }));
  }
}

export const onArrow = (fn: (dir: number) => void) => {
  const h = (e: Event) => fn((e as CustomEvent<number>).detail);
  root.addEventListener('nav-arrow', h);
  return () => root.removeEventListener('nav-arrow', h);
};

export { $ };
