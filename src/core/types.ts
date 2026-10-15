import type * as THREE from 'three';
import type { Engine } from './Engine';
import type { Director } from './Director';

export type SceneId = 'station' | 'lake' | 'hall';

/** Every place the spellbook can jump to. */
export type Section = 'station' | 'lake' | 'about' | 'projects' | 'aspirations' | 'contact';

export type VeilKind = 'steam' | 'dark' | 'silver' | 'gold';

export interface SceneContext {
  engine: Engine;
  director: Director;
}

export interface BloomSettings {
  strength: number;
  radius: number;
  threshold: number;
}

/** The contract every journey scene implements. */
export interface WorldScene {
  readonly id: SceneId;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  bloom: BloomSettings;
  exposure: number;
  /** Start the scene. `section` is set when arriving from the spellbook. */
  enter(section?: Section): void;
  update(dt: number, elapsed: number): void;
  resize(w: number, h: number): void;
  /** Skip the cinematic that is currently playing (if any). */
  skip(): void;
  /** Whether a skippable cinematic is running right now. */
  readonly cinematic: boolean;
  /** Jump within the scene (Great Hall sections). */
  goToSection?(section: Section): void;
  /** Escape key / back gesture. Return true if handled. */
  back?(): boolean;
  /** Primary action key (Space/Enter). */
  primary?(): void;
  dispose(): void;
}

export type SceneFactory = (ctx: SceneContext) => Promise<WorldScene> | WorldScene;
