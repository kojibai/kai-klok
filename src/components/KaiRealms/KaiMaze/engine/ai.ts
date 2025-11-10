// src/components/KaiRealms/KaiMaze/engine/ai.ts
import type { Dir, Ghost, Grid, Vec2 } from "./types";
import { dirToVec, isWall } from "./physics";

/** ────────────────────────────────────────────────────────────────────
 *  Kai-AI: Breath-Conscious Ghosts
 *  - Backward compatible: (grid, ghost, target, fearful) still works
 *  - Advanced mode: pass ctx to enable breath-aware, role-based A* AI
 *  - No `any`, TS-strict safe
 *  - Roles (hunter/ambusher/herder/lurker) coordinate behavior
 *  - Consciousness grows each breath; mid-breath = peak aggression
 *  - A* with reverse-penalty, breath modulation, intercept prediction
 *  - Fear mode = maximize distance, avoid player vectors
 *  - Scatter/chase ready: ctx.mode can steer behavior too
 *  ─────────────────────────────────────────────────────────────────── */

const BREATH_MS = 5236 as const;

/* Types local to AI (augment core Ghost without using `any`) */
export type GhostRole = "hunter" | "ambusher" | "herder" | "lurker";
export type GhostAwareness = {
  lastPlayerSeenAt: Vec2;
  lastBreathIdx: number;
  awareness01: number; // 0..1 grows as breaths pass without losing the trail
};

export type GhostMode = "chase" | "scatter" | "fright";

export type AIContext = {
  nowMs: number;
  breathAnchorMs: number;   // shared breath anchor (or per-level anchor)
  level: number;
  mode: GhostMode;          // current global mode (or ghost.mode if you prefer)
  player: { pos: Vec2; dir: Dir; speedTilesPerSec: number };
  ghosts: ReadonlyArray<Ghost & Partial<AIExtGhost>>;
};

type AIExtGhost = {
  role: GhostRole;
  memory: GhostAwareness;
  scatterTarget: Vec2; // many game models already carry this; keep here to be explicit
};

/* Utilities */
function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x; }

function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function breathPhase(nowMs: number, anchorMs: number): number {
  const dt = (nowMs - anchorMs + BREATH_MS) % BREATH_MS;
  return dt / BREATH_MS; // 0..1
}

function breathIdx(nowMs: number, anchorMs: number): number {
  const dt = nowMs - anchorMs;
  return dt >= 0 ? Math.floor(dt / BREATH_MS) : Math.ceil(dt / BREATH_MS) - 1;
}

function opposite(d: Dir): Dir {
  if (d === "up") return "down";
  if (d === "down") return "up";
  if (d === "left") return "right";
  if (d === "right") return "left";
  return "none";
}

function same(a: Vec2, b: Vec2): boolean {
  return Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y);
}

/* Grid helpers */
function neighbors(grid: Grid, p: Vec2): Vec2[] {
  const result: Vec2[] = [];
  const dirs: Dir[] = ["up", "down", "left", "right"];
  for (const d of dirs) {
    const dv = dirToVec(d);
    const nx = Math.round(p.x) + dv.x;
    const ny = Math.round(p.y) + dv.y;
    if (!isWall(grid, nx, ny)) result.push({ x: nx, y: ny });
  }
  return result;
}

/* A* pathfinding (returns the next *tile* step from `from` toward `to`) */
function nextStepAStar(
  grid: Grid,
  from: Vec2,
  to: Vec2,
  avoidReverseDir: Dir | "none",
  reversePenalty = 0.35
): Vec2 | null {
  // trivial
  if (same(from, to)) return null;

  const startKey = (p: Vec2) => `${p.x}|${p.y}`;
  const h = (p: Vec2) => manhattan(p, to);

  const open: Vec2[] = [{ x: Math.round(from.x), y: Math.round(from.y) }];
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const came = new Map<string, Vec2>();

  const sKey = startKey(open[0]);
  gScore.set(sKey, 0);
  fScore.set(sKey, h(open[0]));

  const visited = new Set<string>();

  while (open.length) {
    // get node with smallest fScore
    let bestIdx = 0;
    let bestF = fScore.get(startKey(open[0])) ?? Number.POSITIVE_INFINITY;
    for (let i = 1; i < open.length; i++) {
      const k = startKey(open[i]);
      const f = fScore.get(k) ?? Number.POSITIVE_INFINITY;
      if (f < bestF) { bestF = f; bestIdx = i; }
    }

    const current = open.splice(bestIdx, 1)[0];
    const ck = startKey(current);
    if (same(current, to)) {
      // reconstruct first step toward goal
      let cur = current;
      let prev = came.get(ck);
      while (prev && !same(prev, from)) {
        cur = prev;
        prev = came.get(startKey(cur));
      }
      return cur;
    }
    visited.add(ck);

    for (const nb of neighbors(grid, current)) {
      const nk = startKey(nb);
      if (visited.has(nk)) continue;

      // cost 1 per step, plus a small penalty for reversing the initial direction
      let base = 1;
      if (avoidReverseDir !== "none") {
        // If the *first* edge would reverse the current direction, add penalty.
        // Identify that first edge by checking when "current" is the start.
        if (same(current, from)) {
          const stepDir = stepToDir(from, nb);
          if (stepDir !== "none" && stepDir === opposite(avoidReverseDir)) {
            base += reversePenalty;
          }
        }
      }

      const tentativeG = (gScore.get(ck) ?? Number.POSITIVE_INFINITY) + base;
      const prevBest = gScore.get(nk);
      if (prevBest === undefined || tentativeG < prevBest) {
        came.set(nk, current);
        gScore.set(nk, tentativeG);
        fScore.set(nk, tentativeG + h(nb));
        if (!open.some(p => p.x === nb.x && p.y === nb.y)) open.push(nb);
      }
    }
  }
  return null; // no path
}

function stepToDir(from: Vec2, to: Vec2): Dir {
  const dx = Math.round(to.x) - Math.round(from.x);
  const dy = Math.round(to.y) - Math.round(from.y);
  if (dx === 1 && dy === 0) return "right";
  if (dx === -1 && dy === 0) return "left";
  if (dx === 0 && dy === 1) return "down";
  if (dx === 0 && dy === -1) return "up";
  return "none";
}

/* Role assignment (stable across a session) */
function defaultRoleForColor(color: string): GhostRole {
  const c = color.toLowerCase();
  if (c.includes("ff4d4d") || c.includes("red")) return "hunter";
  if (c.includes("4dd2ff") || c.includes("cyan") || c.includes("blue")) return "ambusher";
  if (c.includes("ffd166") || c.includes("yellow") || c.includes("orange")) return "herder";
  return "lurker";
}

/* Target computation per role, modulated by breath phase & awareness */
function computeRoleTarget(
  role: GhostRole,
  player: { pos: Vec2; dir: Dir; speedTilesPerSec: number },
  grid: Grid,
  phase01: number,
  awareness01: number,
  level: number,
  ghosts: ReadonlyArray<Ghost & Partial<AIExtGhost>>,
  self: Ghost & Partial<AIExtGhost>
): Vec2 {
  const leadTilesBase = 2 + Math.floor(phase01 * 2);   // 2..4 tiles lead mid-breath
  const leadTiles = Math.min(6, leadTilesBase + Math.floor(awareness01 * 2) + Math.floor(level / 3));
  const dv = dirToVec(player.dir);
  const ahead: Vec2 = { x: Math.round(player.pos.x) + dv.x * leadTiles, y: Math.round(player.pos.y) + dv.y * leadTiles };

  const leftOf = (origin: Vec2, dir: Dir, n = 2): Vec2 => {
    // 90° left offset from dir
    const m = dir === "up" ? { x: -1, y: 0 }
      : dir === "down" ? { x: 1, y: 0 }
      : dir === "left" ? { x: 0, y: 1 }
      : dir === "right" ? { x: 0, y: -1 }
      : { x: 0, y: 0 };
    return { x: origin.x + m.x * n, y: origin.y + m.y * n };
  };

  const rightOf = (origin: Vec2, dir: Dir, n = 2): Vec2 => {
    const m = dir === "up" ? { x: 1, y: 0 }
      : dir === "down" ? { x: -1, y: 0 }
      : dir === "left" ? { x: 0, y: -1 }
      : dir === "right" ? { x: 0, y: 1 }
      : { x: 0, y: 0 };
    return { x: origin.x + m.x * n, y: origin.y + m.y * n };
  };

  switch (role) {
    case "hunter": {
      // Direct pursuit with breath-amplified lead
      return withinGridOrNearestOpen(grid, ahead);
    }
    case "ambusher": {
      // Aim slightly ahead and to the side (offset based on phase)
      const side = phase01 < 0.5 ? leftOf(ahead, player.dir, 2) : rightOf(ahead, player.dir, 2);
      return withinGridOrNearestOpen(grid, side);
    }
    case "herder": {
      // Coordinate: target a point that pushes player toward nearest ghost (other than self)
      let nearest: Ghost | null = null;
      let best = Number.POSITIVE_INFINITY;
      for (const g of ghosts) {
        if (g === self) continue;
        const d = manhattan({ x: Math.round(g.pos.x), y: Math.round(g.pos.y) }, { x: Math.round(player.pos.x), y: Math.round(player.pos.y) });
        if (d < best) { best = d; nearest = g; }
      }
      const pivot = nearest ? { x: Math.round((nearest.pos.x + player.pos.x) / 2), y: Math.round((nearest.pos.y + player.pos.y) / 2) } : ahead;
      return withinGridOrNearestOpen(grid, pivot);
    }
    case "lurker":
    default: {
      // Patrol chokepoints: pick the closest 3-way intersection to the player’s ahead tile
      const choke = nearestIntersectionTo(grid, ahead);
      return choke ?? withinGridOrNearestOpen(grid, ahead);
    }
  }
}

/* Choose a farthest corner (fear mode) */
function farthestCornerFrom(grid: Grid, from: Vec2): Vec2 {
  const corners: Vec2[] = [
    { x: 1, y: 1 },
    { x: grid[0].length - 2, y: 1 },
    { x: 1, y: grid.length - 2 },
    { x: grid[0].length - 2, y: grid.length - 2 },
  ];
  let best = corners[0];
  let bestD = -Infinity;
  for (const c of corners) {
    const d = manhattan({ x: Math.round(from.x), y: Math.round(from.y) }, c);
    if (d > bestD) { bestD = d; best = c; }
  }
  return withinGridOrNearestOpen(grid, best);
}

/* Center to valid tile if target is wall/out-of-bounds */
function withinGridOrNearestOpen(grid: Grid, t: Vec2): Vec2 {
  const tx = Math.max(0, Math.min(grid[0].length - 1, Math.round(t.x)));
  const ty = Math.max(0, Math.min(grid.length - 1, Math.round(t.y)));
  if (!isWall(grid, tx, ty)) return { x: tx, y: ty };
  // flood small ring to find open
  const ring: Vec2[] = [
    { x: tx + 1, y: ty }, { x: tx - 1, y: ty }, { x: tx, y: ty + 1 }, { x: tx, y: ty - 1 },
  ];
  for (const r of ring) {
    const rx = Math.max(0, Math.min(grid[0].length - 1, r.x));
    const ry = Math.max(0, Math.min(grid.length - 1, r.y));
    if (!isWall(grid, rx, ry)) return { x: rx, y: ry };
  }
  return { x: tx, y: ty }; // fallback (blocked)
}

function isIntersection(grid: Grid, p: Vec2): boolean {
  let open = 0;
  const dirs: Dir[] = ["up", "down", "left", "right"];
  for (const d of dirs) {
    const dv = dirToVec(d);
    const nx = Math.round(p.x) + dv.x, ny = Math.round(p.y) + dv.y;
    if (!isWall(grid, nx, ny)) open++;
  }
  return open >= 3;
}

function nearestIntersectionTo(grid: Grid, anchor: Vec2): Vec2 | null {
  // limited BFS to find the closest intersection tile
  const q: Vec2[] = [{ x: Math.round(anchor.x), y: Math.round(anchor.y) }];
  const seen = new Set<string>([`${q[0].x}|${q[0].y}`]);
  while (q.length) {
    const cur = q.shift()!;
    if (isIntersection(grid, cur)) return cur;
    for (const nb of neighbors(grid, cur)) {
      const k = `${nb.x}|${nb.y}`;
      if (seen.has(k)) continue;
      seen.add(k);
      q.push(nb);
    }
  }
  return null;
}

/* Awareness / consciousness update once per breath */
function updateAwareness(
  ghost: Ghost & Partial<AIExtGhost>,
  ctx: AIContext
): GhostAwareness {
  const bi = breathIdx(ctx.nowMs, ctx.breathAnchorMs);
  const last = ghost.memory?.lastBreathIdx ?? Number.MIN_SAFE_INTEGER;
  const prevA = ghost.memory?.awareness01 ?? 0;
  const lastSeen = ghost.memory?.lastPlayerSeenAt ?? ctx.player.pos;

  // if we switched breath, gently increase awareness; if the player is close, increase faster
  const phase = breathPhase(ctx.nowMs, ctx.breathAnchorMs);
  const proximity = 1 / Math.max(1, manhattan({ x: Math.round(ghost.pos.x), y: Math.round(ghost.pos.y) }, { x: Math.round(ctx.player.pos.x), y: Math.round(ctx.player.pos.y) }));
  const delta = bi !== last ? clamp01(0.12 + 0.18 * proximity + (phase > 0.4 && phase < 0.6 ? 0.08 : 0)) : 0;
  const awareness01 = clamp01(prevA * 0.92 + delta); // slow decay toward stability

  return {
    lastPlayerSeenAt: same(ctx.player.pos, lastSeen) ? lastSeen : ctx.player.pos,
    lastBreathIdx: bi,
    awareness01
  };
}

/* MAIN: Advanced (with ctx) + Legacy (without ctx) */
export function chooseGhostDir(
  grid: Grid,
  ghost: Ghost,
  legacyTarget: Vec2,
  fearful: boolean,
  ctx?: AIContext
): Dir {
  // Legacy behavior (no context): simple greedy manhattan toward/away
  if (!ctx) return legacyGreedy(grid, ghost, legacyTarget, fearful);

  // Fear overrides advanced logic: run to farthest corner or away from player
  if (fearful || ctx.mode === "fright") {
    const awayTarget = farthestCornerFrom(grid, ctx.player.pos);
    const step = nextStepAStar(grid, ghost.pos, awayTarget, ghost.dir, 0.15);
    const dir = step ? stepToDir(ghost.pos, step) : greedyStepAway(grid, ghost, ctx.player.pos);
    return dir === "none" ? ghost.dir : dir;
  }

  // Conscious role & memory
  const role: GhostRole =
    (("role" in ghost && (ghost as unknown as { role: GhostRole }).role) ? (ghost as unknown as { role: GhostRole }).role
    : defaultRoleForColor((ghost as unknown as { color?: string }).color ?? ""));

  const mem = updateAwareness(ghost as Ghost & Partial<AIExtGhost>, ctx);
  // hydrate a self struct without mutating external ghost
  const self: Ghost & Partial<AIExtGhost> = { ...ghost, role, memory: mem };

  // Breath-weighted aggression: center of breath = highest push
  const phase = breathPhase(ctx.nowMs, ctx.breathAnchorMs);
  const aggression01 = Math.sin(Math.PI * phase) ** 2; // 0..1 peaking mid-breath

  // Compute dynamic target for this role
  const target = computeRoleTarget(
    role, ctx.player, grid, phase, mem.awareness01, ctx.level, ctx.ghosts, self
  );

  // Give herder/lurker a mild preference for chokepoints when aggression is low (more control)
  const preferChoke =
    (role === "herder" || role === "lurker") && aggression01 < 0.45;

  // Path with reverse penalty tuned by aggression (more aggressive = less afraid to reverse)
  const reversePenalty = preferChoke ? 0.25 : (0.35 - 0.18 * aggression01);

  const step = nextStepAStar(grid, ghost.pos, target, ghost.dir, reversePenalty);
  if (step) return stepToDir(ghost.pos, step);

  // Fallbacks: intercept or greedy
  const intercept = interceptStep(grid, ghost.pos, ctx.player);
  if (intercept !== "none") return intercept;

  const greedyDir = greedyStepToward(grid, ghost, target);
  return greedyDir === "none" ? ghost.dir : greedyDir;
}

/* ── Legacy path (kept intact) ─────────────────────────────────────── */

function legacyGreedy(grid: Grid, ghost: Ghost, target: Vec2, fearful: boolean): Dir {
  const dirs: Dir[] = ["up", "left", "down", "right"];
  let best: Dir = "none";
  let bestScore = fearful ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;

  for (const d of dirs) {
    const v = dirToVec(d);
    const nx = Math.round(ghost.pos.x) + v.x;
    const ny = Math.round(ghost.pos.y) + v.y;
    if (isWall(grid, nx, ny)) continue;

    const score = manhattan({ x: nx, y: ny }, target);
    if (fearful) {
      if (score > bestScore) { bestScore = score; best = d; }
    } else {
      if (score < bestScore) { bestScore = score; best = d; }
    }
  }
  return best === "none" ? ghost.dir : best;
}

/* ── Fallback helpers ──────────────────────────────────────────────── */

function greedyStepToward(grid: Grid, ghost: Ghost, target: Vec2): Dir {
  const dirs: Dir[] = ["up", "left", "down", "right"];
  let best: Dir = "none";
  let bestScore = Number.POSITIVE_INFINITY;

  for (const d of dirs) {
    if (opposite(d) === ghost.dir) continue; // avoid instant reverse if possible
    const dv = dirToVec(d);
    const nx = Math.round(ghost.pos.x) + dv.x;
    const ny = Math.round(ghost.pos.y) + dv.y;
    if (isWall(grid, nx, ny)) continue;
    const s = manhattan({ x: nx, y: ny }, target);
    if (s < bestScore) { bestScore = s; best = d; }
  }
  return best;
}

function greedyStepAway(grid: Grid, ghost: Ghost, from: Vec2): Dir {
  const dirs: Dir[] = ["up", "left", "down", "right"];
  let best: Dir = "none";
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const d of dirs) {
    const dv = dirToVec(d);
    const nx = Math.round(ghost.pos.x) + dv.x;
    const ny = Math.round(ghost.pos.y) + dv.y;
    if (isWall(grid, nx, ny)) continue;
    const s = manhattan({ x: nx, y: ny }, from);
    if (s > bestScore) { bestScore = s; best = d; }
  }
  return best;
}

/* Intercept: take the step that minimizes distance to the player's *next* tile */
function interceptStep(
  grid: Grid,
  from: Vec2,
  player: { pos: Vec2; dir: Dir; speedTilesPerSec: number }
): Dir {
  const pv = dirToVec(player.dir);
  const nextP: Vec2 = { x: Math.round(player.pos.x) + pv.x, y: Math.round(player.pos.y) + pv.y };
  const dirs: Dir[] = ["up", "left", "down", "right"];
  let best: Dir = "none";
  let bestD = Number.POSITIVE_INFINITY;

  for (const d of dirs) {
    const dv = dirToVec(d);
    const nx = Math.round(from.x) + dv.x;
    const ny = Math.round(from.y) + dv.y;
    if (isWall(grid, nx, ny)) continue;
    const dd = manhattan({ x: nx, y: ny }, nextP);
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}
