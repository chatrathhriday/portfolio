/** The railway ticket that carries the visitor's name and starts the journey. */
import { portfolio } from '../content/portfolio';
import { esc } from './content';
import { audio } from '../core/audio';
import { settings } from '../core/settings';

let el: HTMLElement | null = null;

export function showTicket(onBoard: () => void) {
  hideTicket(true);
  const t = portfolio.ticket;
  el = document.createElement('div');
  el.className = 'ticket-wrap';
  el.innerHTML = `
    <article class="ticket" aria-label="Your ticket">
      <div class="ticket-stub" aria-hidden="true"><span>No. 0934</span></div>
      <div class="ticket-body">
        <p class="t-line">Hogwarts Express · One way</p>
        <h1 class="t-name">${esc(portfolio.name)}</h1>
        <p class="t-role">${esc(portfolio.role)}</p>
        <dl class="t-grid">
          <div><dt>From</dt><dd>${esc(t.from)}</dd></div>
          <div><dt>To</dt><dd>${esc(t.to)}</dd></div>
          <div><dt>Platform</dt><dd class="big">${esc(t.platform)}</dd></div>
          <div><dt>Departs</dt><dd>${esc(t.departs)}</dd></div>
        </dl>
        <button type="button" class="board" data-primary>Punch ticket &amp; board <span aria-hidden="true">→</span></button>
        <button type="button" class="sound-invite" aria-pressed="false"></button>
      </div>
      <span class="punch" aria-hidden="true"></span>
    </article>`;
  document.getElementById('ui')!.append(el);
  void el.offsetWidth;
  el.classList.add('on');
  const btn = el.querySelector<HTMLButtonElement>('.board')!;
  const invite = el.querySelector<HTMLButtonElement>('.sound-invite')!;
  const paint = () => {
    const on = settings.get().sound;
    invite.textContent = on ? '♪ Sound and music on · tap to mute' : '♪ Turn sound and music on';
    invite.setAttribute('aria-pressed', String(on));
  };
  paint();
  const off = settings.on(paint);
  invite.addEventListener('click', () => {
    audio.unlock();
    settings.set('sound', !settings.get().sound);
  });
  btn.addEventListener('click', () => {
    audio.unlock();
    audio.ticketPunch();
    el?.classList.add('punched');
    btn.disabled = true;
    setTimeout(() => {
      hideTicket();
      onBoard();
    }, 550);
  });
  // Make Space/Enter work even without focusing the ticket.
  const key = (e: KeyboardEvent) => {
    if ((e.key === ' ' || e.key === 'Enter') && el && !btn.disabled && document.activeElement?.tagName !== 'BUTTON') {
      e.preventDefault();
      e.stopImmediatePropagation();
      btn.click();
    }
  };
  document.addEventListener('keydown', key, true);
  (el as HTMLElement & { _off?: () => void })._off = () => {
    document.removeEventListener('keydown', key, true);
    off();
  };
}

export function hideTicket(instant = false) {
  if (!el) return;
  const old = el as HTMLElement & { _off?: () => void };
  old._off?.();
  el = null;
  old.classList.remove('on');
  setTimeout(() => old.remove(), instant ? 0 : 700);
}
