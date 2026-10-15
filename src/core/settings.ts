/** Visitor preferences. Persisted per browser when storage is available. */

type Listener = () => void;

const KEY = 'hp-portfolio-settings-v2';

function load(): Partial<SettingsState> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export interface SettingsState {
  sound: boolean;
  reducedMotion: boolean;
  lightGraphics: boolean;
}

const prefersReduced =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const state: SettingsState = {
  sound: false, // off until the visitor turns it on
  reducedMotion: prefersReduced,
  lightGraphics: false,
  ...load(),
};

const listeners = new Set<Listener>();

export const settings = {
  get: () => state as Readonly<SettingsState>,
  set<K extends keyof SettingsState>(k: K, v: SettingsState[K]) {
    state[k] = v;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage blocked — keep in memory only */
    }
    listeners.forEach((l) => l());
  },
  on(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** Duration helper: cinematic durations collapse when reduced motion is on. */
export const dur = (seconds: number, reduced = 0.5) => (state.reducedMotion ? Math.min(seconds, reduced) : seconds);
