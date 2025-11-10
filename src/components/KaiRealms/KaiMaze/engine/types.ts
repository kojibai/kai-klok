// src/components/KaiRealms/KaiMaze/engine/types.ts

/* ───────────────────────────
 * Core math / directions
 * ─────────────────────────── */

export type Vec2 = { x: number; y: number };

export type Dir = "up" | "down" | "left" | "right" | "none";

/* ───────────────────────────
 * Grid / tiles
 * ─────────────────────────── */

export type Tile =
  | 0 // empty path
  | 1 // wall
  | 2 // pellet
  | 3 // power pellet (Decree)
  ;

export type Grid = Tile[][];

/* ───────────────────────────
 * Entities
 * ─────────────────────────── */

export type EntityKind = "player" | "ghost";

export interface Entity {
  kind: EntityKind;
  pos: Vec2;          // tile coordinates (float for sub-tile motion)
  dir: Dir;           // current move dir
  nextDir: Dir;       // buffered input / intended next dir
  speedTps: number;   // tiles per second baseline
}

/* Optional roles & modes for advanced AI */
export type GhostName   = "Archivist" | "Steward" | "Sentinel" | "Herald";
export type GhostRole   = "hunter" | "ambusher" | "herder" | "lurker";
export type GhostMode   = "chase" | "scatter" | "fright";

export interface GhostAwareness {
  lastPlayerSeenAt: Vec2;
  lastBreathIdx: number;  // integer breath counter from the shared anchor
  awareness01: number;    // 0..1 “consciousness”/focus level
}

export interface Ghost extends Entity {
  kind: "ghost";
  name: GhostName;
  scatterTarget: Vec2;

  /* Optional advanced AI fields (ignored if unused) */
  role?: GhostRole;
  mode?: GhostMode;
  memory?: GhostAwareness;
  colorHex?: string;

  /* Fright timing (epoch ms). Optional to keep legacy code compiling. */
  frightUntil?: number;
}

export interface Player extends Entity {
  kind: "player";
  lives: number;
  invulnerableUntil?: number; // epoch ms, optional
}

/* ───────────────────────────
 * Breath / difficulty / economy
 * ─────────────────────────── */

export interface BreathState {
  anchorMs: number;     // shared Kai-breath anchor (epoch ms)
  phase01?: number;     // computed phase (0..1), optional cache
  index?: number;       // breath index (…,-1,0,1,2,…) from anchor
}

export interface ComboState {
  streak: number;       // current consecutive successes
  bestStreak: number;   // session best streak
  multiplier: number;   // computed, clamped (e.g., 1.0..1.6)
}

export interface PointsState {
  points: number;       // internal points (skill score)
  scorePhi: number;     // Φ accrued this session (to sync with wallet)
}

export interface EconomyTuning {
  entryCostPhi: number;       // Φ to start a run
  pointsPerPellet: number;    // base points for pellets
  pointsPerPowerPellet: number;
  pointsPerBanish: number;
  perfectWindow: number;      // ±window around mid-breath (e.g., 0.085)
  phiPerLevelBonus: number;   // bonus Φ for clearing a level
  ptsToPhiCurve: "sqrt" | "log" | "piecewise";
}

export interface DifficultyTuning {
  playerBaseTps: number;      // baseline player speed (tiles/sec)
  ghostBaseTps: number;       // baseline ghost speed (tiles/sec)
  streakSpeedStep: number;    // +% speed per streak step (e.g., 0.10)
  streakMaxFactor: number;    // max speed factor from streak (e.g., 1.6)
  powerDurationMs: number;    // fright duration (≈ one breath)
  ghostFrightSpeedFactor: { min: number; max: number }; // 0..1 range
  levelSpeedRamp: number;     // per-level speed multiplier (e.g., 1.06)
}

/* Optional RNG wrapper (keep rngSeed for backward compat) */
export interface RNGState {
  seed: number;
  next(): number; // returns 0..1
}

/* Heads-up display preferences */
export interface HUDState {
  message?: string;
  showBreathMeter: boolean;
}

/* ───────────────────────────
 * GameState (backward compatible)
 * ─────────────────────────── */

export interface GameState {
  grid: Grid;

  player: Player;
  ghosts: Ghost[];

  /* Progress / timing */
  pelletsRemaining: number;
  powerUntil: number;        // epoch ms until which power (fright) is active

  /* RNG (keep existing rngSeed; optional RNG object for deterministic engines) */
  rngSeed: number;
  rng?: RNGState;

  /* Lifecycle */
  alive: boolean;
  over?: boolean;            // optional to avoid breakage if not used

  /* Leveling */
  level: number;

  /* Scoring / Φ */
  scorePhi: number;          // kept for compatibility with existing wallet code
  points?: PointsState;      // optional richer score model
  combo?: ComboState;        // optional streak/multiplier model

  /* System states (optional, non-breaking) */
  breath?: BreathState;
  hud?: HUDState;

  /* Tuning bundles (optional; if present, engine reads from here) */
  tuning?: {
    economy: EconomyTuning;
    difficulty: DifficultyTuning;
  };
}

/* ───────────────────────────
 * AI context (for breath-conscious pathing)
 * ─────────────────────────── */

export interface AIContext {
  nowMs: number;
  breathAnchorMs: number;
  level: number;
  mode: GhostMode; // "chase" | "scatter" | "fright"
  player: { pos: Vec2; dir: Dir; speedTilesPerSec: number };
  ghosts: ReadonlyArray<Ghost>;
}
