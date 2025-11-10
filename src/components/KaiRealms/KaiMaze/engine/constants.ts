// src/components/KaiRealms/KaiMaze/engine/constants.ts
export const TILE_SIZE = 18;             // px (scaled by DPR at render)
export const GRID_COLS = 28;
export const GRID_ROWS = 31;

export const SPEED_PLAYER = 5.2;         // tiles per second
export const SPEED_GHOST  = 5.0;

export const ENTRY_COST_PHI = 2;         // cost to start / continue
export const PELLET_REWARD  = 0.05;      // Φ per pellet
export const POWER_REWARD   = 0.2;       // Φ per decree (power pellet)
export const GHOST_REWARD   = 1.0;       // Φ per “banished agent” during power mode

export const POWER_DURATION_MS = 5200;   // harmonic
export const TICK_HZ = 60;               // simulation tick
