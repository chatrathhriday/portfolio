/**
 * Owns the journey: which scene is live, lazy-loading and preloading of
 * scene modules, veiled transitions between them, and spellbook jumps.
 */
import type { Engine } from './Engine';
import type { SceneFactory, SceneId, Section, VeilKind, WorldScene } from './types';
import { ui } from '../ui/ui';
import { audio } from './audio';

const loaders: Record<SceneId, () => Promise<{ default: SceneFactory }>> = {
  station: () => import('../scenes/station/StationScene'),
  lake: () => import('../scenes/lake/LakeScene'),
  hall: () => import('../scenes/hall/GreatHallScene'),
};

const ORDER: SceneId[] = ['station', 'lake', 'hall'];

/** Veil used when arriving at a scene along the natural journey. */
const ARRIVAL_VEIL: Record<SceneId, VeilKind> = {
  station: 'dark',
  lake: 'steam',
  hall: 'dark',
};

export const sceneOf = (s: Section): SceneId =>
  s === 'station' ? 'station' : s === 'lake' ? 'lake' : 'hall';

export class Director {
  private current: WorldScene | null = null;
  private pending = new Map<SceneId, Promise<WorldScene>>();
  private busy = false;
  /** Sections the visitor has already revealed — shown as marked in the spellbook. */
  readonly visited = new Set<Section>();
  private listeners = new Set<() => void>();

  constructor(private engine: Engine) {}

  get scene() {
    return this.current;
  }
  get transitioning() {
    return this.busy;
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
  }
  private emit() {
    this.listeners.forEach((f) => f());
  }

  markVisited(s: Section) {
    this.visited.add(s);
    this.emit();
  }

  /** Load (or reuse a preloaded) scene. */
  private obtain(id: SceneId, onProgress?: (p: number) => void): Promise<WorldScene> {
    let p = this.pending.get(id);
    if (!p) {
      p = (async () => {
        onProgress?.(0.15);
        const mod = await loaders[id]();
        onProgress?.(0.45);
        // Yield so the loader can paint before the heavy build.
        await new Promise((r) => setTimeout(r, 16));
        const ws = await mod.default({ engine: this.engine, director: this });
        onProgress?.(0.8);
        await this.engine.warm(ws);
        onProgress?.(1);
        return ws;
      })();
      this.pending.set(id, p);
      p.catch(() => this.pending.delete(id));
    }
    return p;
  }

  /** Build the next scene in the background while the visitor is busy. */
  preloadAfter(id: SceneId) {
    const next = ORDER[ORDER.indexOf(id) + 1];
    // Free any scene built ahead of time that is no longer the next stop (e.g. after a spellbook jump).
    for (const [k, p] of this.pending) {
      if (k !== next) {
        this.pending.delete(k);
        p.then((ws) => ws !== this.current && ws.dispose()).catch(() => {});
      }
    }
    if (!next || this.pending.has(next)) return;
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: object) => void }).requestIdleCallback;
    const go = () => {
      // The visitor may already have moved on before the idle callback fired.
      if (this.current && ORDER.indexOf(this.current.id) + 1 !== ORDER.indexOf(next)) return;
      if (this.pending.has(next)) return;
      this.obtain(next).catch(() => {/* retried on demand */});
    };
    if (idle) idle(go, { timeout: 4000 });
    else setTimeout(go, 1500);
  }

  /** First scene, shown behind the loading screen. */
  async boot(onProgress: (p: number) => void) {
    const ws = await this.obtain('station', onProgress);
    this.engine.setScene(ws);
    this.current = ws;
    this.pending.delete('station');
    ws.enter();
    this.preloadAfter('station');
    this.emit();
  }

  /** Natural progression: the current scene finished its outro. */
  next(veil?: VeilKind) {
    if (!this.current) return;
    const nextId = ORDER[ORDER.indexOf(this.current.id) + 1];
    if (nextId) this.transition(nextId, veil ?? ARRIVAL_VEIL[nextId]);
  }

  /** Spellbook / keyboard jump. */
  goTo(section: Section) {
    if (this.busy) return;
    const target = sceneOf(section);
    if (this.current?.id === target) {
      if (this.current.goToSection) this.current.goToSection(section);
      else if (section === 'station' || section === 'lake') this.transition(target, 'dark', section, true);
      return;
    }
    this.transition(target, ARRIVAL_VEIL[target] === 'steam' ? 'steam' : 'dark', section);
  }

  restart() {
    this.transition('station', 'dark', 'station', true);
  }

  skip() {
    this.current?.skip();
  }

  private async transition(id: SceneId, veil: VeilKind, section?: Section, rebuild = false) {
    if (this.busy) return;
    this.busy = true;
    ui.setSkippable(false);
    ui.hideActions();
    ui.closePanel(true);
    try {
      await ui.veil.cover(veil);
      if (rebuild) this.pending.delete(id);
      const slow = window.setTimeout(() => ui.veil.loading(true), 350);
      let ws: WorldScene;
      try {
        ws = await this.obtain(id);
      } finally {
        clearTimeout(slow);
        ui.veil.loading(false);
      }
      const old = this.current;
      this.pending.delete(id);
      this.engine.setScene(ws);
      this.current = ws;
      if (old && old !== ws) old.dispose();
      // the old scene may have queued UI while the veil was covering it
      ui.hideActions();
      ui.hint(null);
      ui.setSkippable(false);
      ui.closePanel(true);
      audio.ambience(id);
      ws.enter(section);
      this.emit();
      await ui.veil.reveal();
      this.preloadAfter(id);
    } catch (err) {
      console.error('[director] scene failed to load', err);
      ui.showError('The path ahead is blocked — part of the castle failed to load.', () => {
        this.busy = false;
        this.transition(id, veil, section, true);
      });
      ui.veil.reveal();
    } finally {
      this.busy = false;
    }
  }
}
