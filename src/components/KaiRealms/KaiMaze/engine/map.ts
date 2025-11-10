// src/components/KaiRealms/KaiMaze/engine/map.ts
import type { Grid, Tile } from "./types";
import { GRID_COLS, GRID_ROWS } from "./constants";

// Simple symmetric template (0 empty, 1 wall, 2 pellet, 3 power)
const BASE: Tile[][] = (() => {
  const g: Tile[][] = Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => 2 as Tile) // fill pellets
  );

  // Outer walls
  for (let x = 0; x < GRID_COLS; x++) {
    g[0][x] = 1; g[GRID_ROWS - 1][x] = 1;
  }
  for (let y = 0; y < GRID_ROWS; y++) {
    g[y][0] = 1; g[y][GRID_COLS - 1] = 1;
  }

  // Simple inner blocks (you can elaborate later)
  for (let x = 4; x < GRID_COLS - 4; x += 6) {
    for (let y = 4; y < GRID_ROWS - 4; y += 6) {
      g[y][x] = 1;
      g[y][x + 1] = 1;
      g[y + 1][x] = 1;
      g[y + 1][x + 1] = 1;
    }
  }

  // Clear a center corridor
  for (let x = 2; x < GRID_COLS - 2; x++) g[Math.floor(GRID_ROWS / 2)][x] = 0;

  // Place power pellets at four corners
  g[1][1] = 3; g[1][GRID_COLS - 2] = 3;
  g[GRID_ROWS - 2][1] = 3; g[GRID_ROWS - 2][GRID_COLS - 2] = 3;

  // Ensure walkable paths (convert walls to empty in a cross)
  for (let y = 2; y < GRID_ROWS - 2; y++) g[y][Math.floor(GRID_COLS / 2)] = 0;
  for (let x = 2; x < GRID_COLS - 2; x++) g[Math.floor(GRID_ROWS / 2) - 4][x] = 0;

  return g;
})();

export function makeGrid(seed: number, level: number): Grid {
  // Deterministic small variations by seed/level:
  const g: Grid = BASE.map((row) => row.slice());
  const mod = (seed + level) % 3;

  // Swap some pellets to walls/power in a symmetric pattern for variety
  for (let y = 2; y < GRID_ROWS - 2; y += 5) {
    for (let x = 2; x < GRID_COLS - 2; x += 7) {
      if (mod === 0) g[y][x] = 0;
      if (mod === 1 && g[y][x] === 2) g[y][x] = 3;
      if (mod === 2 && g[y][x] === 2) g[y][x] = 1;
    }
  }
  return g;
}

export function countPellets(grid: Grid): number {
  let n = 0;
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      if (grid[y][x] === 2 || grid[y][x] === 3) n++;
    }
  }
  return n;
}
