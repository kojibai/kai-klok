// src/components/KaiRealms/KaiMaze/engine/physics.ts
import type { Dir, Entity, Grid, Tile, Vec2 } from "./types";
import { GRID_COLS, GRID_ROWS } from "./constants";

export function isWall(grid: Grid, tx: number, ty: number): boolean {
  if (ty < 0 || ty >= GRID_ROWS || tx < 0 || tx >= GRID_COLS) return true;
  return grid[ty][tx] === 1;
}

export function dirToVec(d: Dir): Vec2 {
  switch (d) {
    case "up": return { x: 0, y: -1 };
    case "down": return { x: 0, y: 1 };
    case "left": return { x: -1, y: 0 };
    case "right": return { x: 1, y: 0 };
    default: return { x: 0, y: 0 };
  }
}

export function canTurn(grid: Grid, e: Entity, d: Dir): boolean {
  if (d === "none") return false;
  const target = dirToVec(d);
  const nx = Math.round(e.pos.x) + target.x;
  const ny = Math.round(e.pos.y) + target.y;
  return !isWall(grid, nx, ny);
}

export function stepEntity(grid: Grid, e: Entity, dtSec: number): void {
  // turn if possible
  if (e.nextDir !== "none" && canTurn(grid, e, e.nextDir)) {
    e.dir = e.nextDir;
  }
  const v = dirToVec(e.dir);
  const nx = e.pos.x + v.x * e.speedTps * dtSec;
  const ny = e.pos.y + v.y * e.speedTps * dtSec;

  // prevent entering walls by clamping around center lines
  const tx = Math.floor(nx + 0.5);
  const ty = Math.floor(ny + 0.5);
  if (!isWall(grid, tx, ty)) {
    e.pos.x = nx; e.pos.y = ny;
  } else {
    // snap to center if blocked
    e.pos.x = Math.round(e.pos.x);
    e.pos.y = Math.round(e.pos.y);
  }
}

export function atSameTile(a: Vec2, b: Vec2): boolean {
  return Math.floor(a.x + 0.5) === Math.floor(b.x + 0.5) &&
         Math.floor(a.y + 0.5) === Math.floor(b.y + 0.5);
}

export function eatTile(grid: Grid, p: Vec2): Tile {
  const tx = Math.floor(p.x + 0.5);
  const ty = Math.floor(p.y + 0.5);
  const t = grid[ty][tx];
  if (t === 2 || t === 3) grid[ty][tx] = 0;
  return t;
}
