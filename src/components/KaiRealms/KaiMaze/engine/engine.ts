// src/components/KaiRealms/KaiMaze/engine/engine.ts
import {
  ENTRY_COST_PHI,
  GHOST_REWARD,
  PELLET_REWARD,
  POWER_DURATION_MS,
  POWER_REWARD,
  SPEED_GHOST,
  SPEED_PLAYER,
  TICK_HZ,
} from "./constants";
import type { GameState, Player, Ghost, Grid, Vec2 } from "./types";
import { makeGrid, countPellets } from "./map";
import { atSameTile, eatTile, stepEntity } from "./physics";
import { chooseGhostDir } from "./ai";

/* ------------------------------------------------------------------ */
/* Spawns & tuning (local to engine)                                   */
/* ------------------------------------------------------------------ */

const INITIAL_LIVES = 3;
const RESPAWN_INVULN_MS = 1500;

// Keep these in one place so newGame() and respawns match perfectly.
const PLAYER_SPAWN: Vec2 = { x: 14, y: 23 };
const GHOST_SPAWNS: Array<{ name: Ghost["name"]; pos: Vec2; dir: Ghost["dir"]; scatterTarget: Vec2 }> = [
  { name: "Archivist", pos: { x: 14, y: 14 }, dir: "up",    scatterTarget: { x: 1,  y: 1  } },
  { name: "Steward",   pos: { x: 13, y: 14 }, dir: "left",  scatterTarget: { x: 26, y: 1  } },
  { name: "Sentinel",  pos: { x: 15, y: 14 }, dir: "right", scatterTarget: { x: 1,  y: 29 } },
  { name: "Herald",    pos: { x: 16, y: 14 }, dir: "down",  scatterTarget: { x: 26, y: 29 } },
];

/* ------------------------------------------------------------------ */
/* Game construction                                                   */
/* ------------------------------------------------------------------ */

export function newGame(seed: number, level: number): GameState {
  const grid: Grid = makeGrid(seed, level);

  const player: Player = {
    kind: "player",
    pos: { ...PLAYER_SPAWN },
    dir: "left",
    nextDir: "none",
    speedTps: SPEED_PLAYER,
    lives: INITIAL_LIVES,
    invulnerableUntil: 0,
  };

  const ghosts: Ghost[] = GHOST_SPAWNS.map(g => ({
    kind: "ghost",
    name: g.name,
    pos: { ...g.pos },
    dir: g.dir,
    nextDir: "none",
    speedTps: SPEED_GHOST,
    scatterTarget: { ...g.scatterTarget },
  }));

  return {
    grid,
    player,
    ghosts,
    pelletsRemaining: countPellets(grid),
    powerUntil: 0,
    rngSeed: seed,
    alive: true,
    level,
    scorePhi: 0,
  };
}

/* ------------------------------------------------------------------ */
/* Handlers                                                            */
/* ------------------------------------------------------------------ */

export type EngineHandlers = {
  onWalletChange: (deltaPhi: number) => void;
  nowMs: () => number;
};

/* ------------------------------------------------------------------ */
/* Core tick                                                           */
/* ------------------------------------------------------------------ */

export function tick(state: GameState, dtSec: number, h: EngineHandlers): void {
  if (!state.alive) return;

  // Move player first
  stepEntity(state.grid, state.player, dtSec);

  // Eat pellets / power pellets
  const ate = eatTile(state.grid, state.player.pos);
  if (ate === 2) {
    state.pelletsRemaining--;
    state.scorePhi += PELLET_REWARD;
    h.onWalletChange(PELLET_REWARD);
  } else if (ate === 3) {
    state.pelletsRemaining--;
    state.scorePhi += POWER_REWARD;
    state.powerUntil = h.nowMs() + POWER_DURATION_MS;
    h.onWalletChange(POWER_REWARD);
  }

  const now = h.nowMs();
  const fearful = now < state.powerUntil;
  const invulnerable = now < (state.player.invulnerableUntil ?? 0);

  // Move ghosts and resolve collisions
  for (const g of state.ghosts) {
    const target = fearful ? g.scatterTarget : state.player.pos;
    g.dir = chooseGhostDir(state.grid, g, target, fearful);
    stepEntity(state.grid, g, dtSec);

    if (atSameTile(g.pos, state.player.pos)) {
      if (fearful) {
        // Banish: reward & send ghost to its scatter corner
        state.scorePhi += GHOST_REWARD;
        h.onWalletChange(GHOST_REWARD);
        g.pos = { ...g.scatterTarget };
        g.dir = "up";
        g.nextDir = "none";
      } else if (!invulnerable) {
        // Player hit: lose a life or game over
        state.player.lives -= 1;
        if (state.player.lives <= 0) {
          state.alive = false;
          return;
        }
        // Respawn: reset player and ghosts, brief invulnerability
        respawnRound(state, now);
        // After respawn, skip further collision handling this tick
        // (avoids instant re-collide on same frame)
        return;
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function respawnRound(state: GameState, nowMs: number): void {
  // Reset player
  state.player.pos = { ...PLAYER_SPAWN };
  state.player.dir = "left";
  state.player.nextDir = "none";
  state.player.invulnerableUntil = nowMs + RESPAWN_INVULN_MS;

  // Calm ghosts back to their corners and orientations
  for (const g of state.ghosts) {
    // Send to scatter corners to give the player breathing room
    g.pos = { ...g.scatterTarget };
    g.dir = "left";
    g.nextDir = "none";
  }

  // Power effect ends on respawn
  state.powerUntil = 0;
}

export function entryCostPhi(): number {
  return ENTRY_COST_PHI;
}

export const DT_SEC = 1 / TICK_HZ;
