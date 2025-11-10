// src/components/KaiRealms/KaiMaze/KaiMaze.tsx
// v1.5 — Mobile D-pad + Focus Bus + Breath-banking Altar (useMemo applied)

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import "./styles/kai-maze.css";
import { useGameFocus } from "../lib/gameFocus";

declare global {
  interface Window { __kai_breath_anchor?: number; }
}

/** ------------------------------------------------------------------
 *  Kai-Maze — Skill-gated Φ Banking (Vertical-First)
 *  - Earn POINTS by pellets / power / banish (+streak +perfect)
 *  - Convert POINTS→Φ only on ALTAR (⟐) by channeling 1 full breath
 *  - Risk/Reward: death wipes % of unbanked points; Φ is permanent
 *  - Ghost cycles (chase/scatter), level difficulty ramps
 *  - Breath-synced speed + perfect-breath "KaiCharge" boosts payout
 *  - Desktop: arrows/WASD + B/Space to Channel
 *  - Mobile: on-screen D-pad + big CHANNEL button on altar
 *  - Focus bus: only one Realm game runs at a time
 * ------------------------------------------------------------------ */

type Dir = "up" | "down" | "left" | "right" | "none";
type Tile = 0 | 1 | 2 | 3 | 4; // 0 empty, 1 wall, 2 pellet, 3 power, 4 altar
type Vec2 = { x: number; y: number };

type GhostMode = "chase" | "scatter" | "fright";
type Ghost = {
  pos: Vec2;
  dir: Dir;
  speed: number;        // tiles/sec baseline
  scatterTarget: Vec2;
  mode: GhostMode;
  frightUntil: number;  // ms timestamp
  color: string;
};

type Player = {
  pos: Vec2;     // float tile coords
  dir: Dir;      // current move dir
  next: Dir;     // requested next dir
  speed: number; // tiles/sec baseline
};

type GhostCycle = { phase: "chase" | "scatter"; nextSwitchAt: number };

type GameState = {
  grid: Tile[][];
  pellets: number;
  level: number;
  lives: number;

  // economy
  points: number;        // unbanked points (risked)
  bankable: number;      // alias of points
  scorePhi: number;      // total Φ earned (wallet handled externally)

  // mastery
  streak: number;
  bestStreak: number;
  comboUntil: number;    // ms when combo window expires
  kaiCharge: number;     // 0..44 perfect-breath charge

  // flow
  alive: boolean;
  over: boolean;
  ghosts: Ghost[];
  player: Player;

  // altar/channel
  onAltar: boolean;        // player centered on altar tile
  channelingUntil: number; // >0 while channeling; finish time ms

  // cycle
  cycle: GhostCycle;
};

/* ----------------------------- Constants ----------------------------- */

const BREATH_MS = 5236;                   // Golden breath cadence
const PERFECT_WINDOW = 0.085;             // ±8.5% around mid-breath
const ENTRY_COST_PHI = 1;

const FPS_CAP = 60;

// Base tile speed at mid-breath
const PLAYER_BASE_SPEED = 6.1;
const GHOST_BASE_SPEED  = 5.6;

// Streak speed bonus (movement) — keeps flow snappy
const STREAK_SPEED_STEP = 0.10;
const STREAK_MAX_FACTOR = 1.6;

// Points values (not Φ)
const PTS_PELLET        = 10;
const PTS_POWER         = 50;
const PTS_BANISH        = 150;
const PTS_PERFECT_BONUS = 10;

// Combo & decay
const COMBO_WINDOW_MS  = Math.floor(BREATH_MS * 1.25); // ~1.25 breaths
const STREAK_MULT_STEP = 0.145; // φ^(-2)≈0.146 — harmonic ramp
const STREAK_MULT_CAP  = 2.618; // φ^2 — graceful ceiling

// Power pellet fright duration shrinks with level
const POWER_DURATION_MS = BREATH_MS;

// Banking
const ALTAR_CHANNEL_MS  = BREATH_MS;     // hold one breath
const BANK_BASE_THRESH  = 1000;          // points required per Φ @ L1
const BANK_THRESH_STEP  = 0.12;          // +12% threshold per level
const CHARGE_MAX        = 44;            // harmonic cap
const CHARGE_BONUS_MAX  = 0.618;         // +61.8% max payout bonus
const DEATH_POINTS_LOSS = 0.35;          // lose 35% unbanked on death

const MAX_LIVES = 3;
const HUD_FONT = "600 12px ui-sans-serif,system-ui,-apple-system";

/* ----------------------------- Helpers ----------------------------- */

const v = {
  up:    { x: 0,  y: -1 },
  down:  { x: 0,  y:  1 },
  left:  { x: -1, y:  0 },
  right: { x: 1,  y:  0 },
  none:  { x: 0,  y:  0 },
} as const;

const opposite: Record<Dir, Dir> = {
  up: "down", down: "up", left: "right", right: "left", none: "none",
};

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

function breathPhase(nowMs: number, anchorMs: number): number {
  const dt = (nowMs - anchorMs + BREATH_MS) % BREATH_MS;
  return dt / BREATH_MS;
}

function breathSpeedFactor(phase01: number): number {
  const s = Math.sin(Math.PI * phase01);
  return 0.78 + 0.44 * (s * s);
}

function keyToDir(key: string): Dir {
  const k = key.toLowerCase();
  if (k === "arrowup" || k === "w") return "up";
  if (k === "arrowdown" || k === "s") return "down";
  if (k === "arrowleft" || k === "a") return "left";
  if (k === "arrowright" || k === "d") return "right";
  return "none";
}

function canEnter(grid: Tile[][], x: number, y: number): boolean {
  const yy = Math.round(y), xx = Math.round(x);
  if (yy < 0 || yy >= grid.length || xx < 0 || xx >= grid[0].length) return false;
  return grid[yy][xx] !== 1;
}

function tileCenter(p: Vec2): Vec2 { return { x: Math.round(p.x), y: Math.round(p.y) }; }

function dist2(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/* ----------------------------- Maze Layout ----------------------------- */

function buildMaze(): Tile[][] {
  // 23 rows x 27 cols
  const rows = 23, cols = 27;
  const g: Tile[][] = Array.from({ length: rows }, () => Array<Tile>(cols).fill(1));

  // carve corridors
  const carve = (x: number, y: number, w: number, h: number) => {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (yy > 0 && yy < rows - 1 && xx > 0 && xx < cols - 1) g[yy][xx] = 0;
      }
    }
  };

  // outer hollow + interior bands
  carve(1, 1, cols - 2, rows - 2);
  for (let x = 2; x < cols - 2; x++) { g[5][x] = 1; g[rows - 6][x] = 1; }
  for (let y = 2; y < rows - 2; y++) { g[y][4] = 1; g[y][cols - 5] = 1; }

  // cross corridors
  for (let x = 6; x < cols - 6; x++) g[Math.floor(rows / 2)][x] = 0;
  for (let y = 4; y < rows - 4; y++) g[y][Math.floor(cols / 2)] = 0;

  // pellets everywhere that is corridor
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) if (g[y][x] === 0) g[y][x] = 2;
  }

  // power pellets in inner-box corners
  const corners: Vec2[] = [
    { x: 6, y: 6 }, { x: cols - 7, y: 6 }, { x: 6, y: rows - 7 }, { x: cols - 7, y: rows - 7 },
  ];
  for (const c of corners) g[c.y][c.x] = 3;

  // ALTARS (⟐): safe-ish banking spots near quadrant edges
  const altars: Vec2[] = [
    { x: 2, y: 2 }, { x: cols - 3, y: 2 }, { x: 2, y: rows - 3 }, { x: cols - 3, y: rows - 3 },
  ];
  for (const a of altars) if (g[a.y]?.[a.x] !== 1) g[a.y][a.x] = 4;

  return g;
}

/* ----------------------------- Game init ----------------------------- */

function createPlayer(spawn: Vec2): Player {
  return { pos: { x: spawn.x, y: spawn.y }, dir: "left", next: "left", speed: PLAYER_BASE_SPEED };
}

function createGhost(spawn: Vec2, color: string, scatterTarget: Vec2): Ghost {
  return { pos: { x: spawn.x, y: spawn.y }, dir: "left", speed: GHOST_BASE_SPEED, scatterTarget, mode: "chase", frightUntil: 0, color };
}

function countPellets(grid: Tile[][]): number {
  let n = 0;
  for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[0].length; x++) if (grid[y][x] === 2) n++;
  return n;
}

function newGameState(level: number, now: number): GameState {
  const grid = buildMaze();
  const rows = grid.length, cols = grid[0].length;

  const playerSpawn = { x: Math.floor(cols / 2), y: rows - 4 };
  const ghostHouse  = { x: Math.floor(cols / 2), y: Math.floor(rows / 2) - 1 };

  const ghosts: Ghost[] = [
    createGhost({ x: ghostHouse.x - 2, y: ghostHouse.y }, "#ff4d4d", { x: 2, y: 2 }),
    createGhost({ x: ghostHouse.x + 2, y: ghostHouse.y }, "#4dd2ff", { x: cols - 3, y: 2 }),
    createGhost({ x: ghostHouse.x,     y: ghostHouse.y }, "#ffd166", { x: 2, y: rows - 3 }),
    createGhost({ x: ghostHouse.x,     y: ghostHouse.y + 2 }, "#bd7bff", { x: cols - 3, y: rows - 3 }),
  ];

  const cycle: GhostCycle = { phase: "chase", nextSwitchAt: now + cycleDurationMs(level, "chase") };

  return {
    grid, pellets: countPellets(grid), level,
    lives: MAX_LIVES,
    points: 0, bankable: 0, scorePhi: 0,
    streak: 0, bestStreak: 0, comboUntil: 0, kaiCharge: 0,
    alive: true, over: false, ghosts,
    player: createPlayer(playerSpawn),
    onAltar: false, channelingUntil: 0,
    cycle,
  };
}

/* ----------------------------- Difficulty & Cycles ----------------------------- */

function cycleDurationMs(level: number, phase: "chase" | "scatter"): number {
  // Shorter cycles as level rises. Chase lasts longer than scatter.
  const base = phase === "chase" ? 7000 : 5000;
  const factor = Math.max(0.55, 1 - (level - 1) * 0.06);
  return Math.floor(base * factor);
}

/* ----------------------------- AI & Movement ----------------------------- */

function atIntersection(grid: Tile[][], pos: Vec2): boolean {
  const c = tileCenter(pos);
  const dx = Math.abs(pos.x - c.x), dy = Math.abs(pos.y - c.y);
  if (dx >= 0.1 || dy >= 0.1) return false;
  let choices = 0;
  (["up", "down", "left", "right"] as Dir[]).forEach((d) => {
    const nx = c.x + v[d].x, ny = c.y + v[d].y;
    if (canEnter(grid, nx, ny)) choices++;
  });
  return choices >= 3;
}

function tryTurn(grid: Tile[][], obj: { pos: Vec2; dir: Dir; next: Dir }): void {
  if (obj.next === "none" || obj.next === obj.dir) return;
  if (obj.next === opposite[obj.dir]) { obj.dir = obj.next; return; }

  const c = tileCenter(obj.pos);
  const dx = Math.abs(obj.pos.x - c.x), dy = Math.abs(obj.pos.y - c.y);
  if (dx >= 0.12 || dy >= 0.12) return;

  const nx = c.x + v[obj.next].x, ny = c.y + v[obj.next].y;
  if (canEnter(grid, nx, ny)) { obj.pos.x = c.x; obj.pos.y = c.y; obj.dir = obj.next; }
}

function stepMove(grid: Tile[][], pos: Vec2, dir: Dir, speedTilesPerSec: number, dt: number): void {
  if (dir === "none") return;
  const mv = v[dir];
  const nextX = pos.x + mv.x * speedTilesPerSec * dt;
  const nextY = pos.y + mv.y * speedTilesPerSec * dt;

  const cols = grid[0].length;

  // horizontal wrap tunnels
  if (nextX < -1) { pos.x = cols + 1; return; }
  if (nextX > cols + 1) { pos.x = -1; return; }

  const targetX = Math.round(nextX), targetY = Math.round(nextY);
  if (canEnter(grid, targetX, targetY)) { pos.x = nextX; pos.y = nextY; }
  else { const c = tileCenter(pos); pos.x = c.x; pos.y = c.y; }
}

function chooseDir(grid: Tile[][], from: Vec2, curDir: Dir, target: Vec2): Dir {
  const options: Dir[] = ["up", "left", "down", "right"];
  let best: Dir = curDir, bestD = Infinity;
  for (const d of options) {
    if (d === opposite[curDir]) continue;
    const nx = Math.round(from.x) + v[d].x, ny = Math.round(from.y) + v[d].y;
    if (!canEnter(grid, nx, ny)) continue;
    const d2 = dist2({ x: nx, y: ny }, target);
    if (d2 < bestD) { bestD = d2; best = d; }
  }
  // if blocked, allow reverse
  if (best === curDir) {
    const back = opposite[curDir];
    const bx = Math.round(from.x) + v[back].x, by = Math.round(from.y) + v[back].y;
    if (canEnter(grid, bx, by)) return back;
  }
  return best;
}

/* ----------------------------- Component ----------------------------- */

type Props = {
  currentPhi: number;
  onPhiChange: (newAmount: number) => void;
  onExit?: () => void;
};

const KaiMaze: React.FC<Props> = ({ currentPhi, onPhiChange, onExit }) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { paused, takeFocus } = useGameFocus("KaiMaze");

  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  useEffect(() => {
    const el = stageRef.current; if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setStageSize({ w: cr.width, h: cr.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [wallet, setWallet] = useState<number>(currentPhi);
  useEffect(() => setWallet(currentPhi), [currentPhi]);

  const [state, setState] = useState<GameState>(() => newGameState(1, performance.now()));

  // Breath anchor
  const breathAnchorRef = useRef<number>(performance.now());

  // Show on-screen D-pad on coarse/touch pointers (fallback to width)
  const [showDpad, setShowDpad] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
    const small = window.matchMedia?.("(max-width: 900px)")?.matches ?? false;
    return coarse || small;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq1 = window.matchMedia("(pointer: coarse)");
    const mq2 = window.matchMedia("(max-width: 900px)");
    const apply = () => setShowDpad((mq1.matches || mq2.matches));
    mq1.addEventListener?.("change", apply);
    mq2.addEventListener?.("change", apply);
    return () => {
      mq1.removeEventListener?.("change", apply);
      mq2.removeEventListener?.("change", apply);
    };
  }, []);

  // --- useMemo applications ---
  // Stable bank-threshold function (used in game loop)
  const bankThreshold = useMemo(
    () => (level: number) => Math.floor(BANK_BASE_THRESH * (1 + BANK_THRESH_STEP * (level - 1))),
    []
  );

  // Derived UI bits
  const dpadVisible = useMemo(() => showDpad && !state.over, [showDpad, state.over]);
  const controlsHint = useMemo(
    () =>
      (showDpad ? "Tap/Swipe or D-pad" : "←↑→↓ / WASD") +
      " · B/Space to Channel on ⟐ · Esc to exit",
    [showDpad]
  );
  // -----------------------------

  // Entry cost (take focus when we start)
  useEffect(() => {
    if (ENTRY_COST_PHI > 0 && wallet >= ENTRY_COST_PHI) {
      const next = wallet - ENTRY_COST_PHI;
      setWallet(next); onPhiChange(next);
      takeFocus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----------------------------- Input ----------------------------- */

  const cancelChannel = () => {
    setState(s => (s.channelingUntil ? { ...s, channelingUntil: 0 } : s));
  };

  // Keyboard (desktop) — also takes focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const lower = e.key.toLowerCase();
      const d = keyToDir(lower);
      if (d !== "none") {
        cancelChannel();
        e.preventDefault();
        takeFocus();
        setState((s) => ({ ...s, player: { ...s.player, next: d } }));
      }
      if ((lower === "b" || lower === " ") && state.onAltar && state.channelingUntil === 0) {
        takeFocus();
        setState(s => ({ ...s, channelingUntil: performance.now() + ALTAR_CHANNEL_MS }));
      }
      if (lower === "escape" && onExit) onExit();
      if (lower === "r" && state.over) {
        takeFocus();
        setState(newGameState(1, performance.now()));
        breathAnchorRef.current = performance.now();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onExit, state.over, state.onAltar, state.channelingUntil]);

  // Mobile D-pad helpers
  const handlePadDir = (dir: Dir) => {
    cancelChannel();
    takeFocus();
    setState((s) => ({ ...s, player: { ...s.player, next: dir } }));
  };

  const startChannel = () => {
    if (state.onAltar && state.channelingUntil === 0) {
      takeFocus();
      setState(s => ({ ...s, channelingUntil: performance.now() + ALTAR_CHANNEL_MS }));
    }
  };

  /* ------------------------------ Loop ------------------------------ */

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tryConvertOnAltar = (now: number, s: GameState) => {
      if (s.channelingUntil === 0 || !s.onAltar) return s;
      if (now < s.channelingUntil) return s;

      // finished channeling successfully: convert points → Φ
      const threshold = bankThreshold(s.level);
      if (s.bankable < threshold) {
        return { ...s, channelingUntil: 0 }; // not enough yet
      }

      const chargeBonus = 1 + Math.min(1, s.kaiCharge / CHARGE_MAX) * CHARGE_BONUS_MAX; // up to +61.8%
      const payout = Math.max(0, Math.floor((s.bankable / threshold) * chargeBonus));
      if (payout > 0) {
        const consumed = Math.floor(payout * threshold);
        const newBankable = Math.max(0, s.bankable - consumed);
        const newPhi = wallet + payout;

        setWallet(newPhi);
        onPhiChange(newPhi);

        return {
          ...s,
          scorePhi: s.scorePhi + payout,
          bankable: newBankable,
          points: newBankable,
          kaiCharge: Math.max(0, Math.floor(s.kaiCharge * 0.5)), // spend half the charge
          channelingUntil: 0,
        };
      }
      return { ...s, channelingUntil: 0 };
    };

    const step = () => {
      raf = requestAnimationFrame(step);
      const now = performance.now();
      const dt = Math.min(1 / FPS_CAP, (now - last) / 1000);
      last = now;

      // If paused by focus bus, skip simulation (keeps draw cheap)
      if (paused) return;

      setState((s0) => {
        if (s0.over) return s0;
        let s = structuredClone(s0) as GameState;

        // cycle: chase/scatter (fright overrides)
        if (now >= s.cycle.nextSwitchAt) {
          const nextPhase = s.cycle.phase === "chase" ? "scatter" : "chase";
          s.cycle = { phase: nextPhase, nextSwitchAt: now + cycleDurationMs(s.level, nextPhase) };
          for (const g of s.ghosts) if (g.mode !== "fright") g.mode = nextPhase;
        }

        const phase = breathPhase(now, breathAnchorRef.current);
        const bFactor = breathSpeedFactor(phase);
        const streakSpeed = Math.min(1 + s.streak * STREAK_SPEED_STEP, STREAK_MAX_FACTOR);
        const scoreMult = Math.min(1 + s.streak * STREAK_MULT_STEP, STREAK_MULT_CAP);

        // If channeling, freeze player movement
        const playerSpeed = s.channelingUntil > 0 ? 0 : s.player.speed * bFactor * streakSpeed;

        // PLAYER
        tryTurn(s.grid, s.player);
        stepMove(s.grid, s.player.pos, s.player.dir, playerSpeed, dt);

        // ALTAR detection
        const pc = tileCenter(s.player.pos);
        s.onAltar = (s.grid[pc.y]?.[pc.x] === 4);

        // EAT / SCORE (points only)
        const tile = s.grid[pc.y]?.[pc.x] ?? 1;
        if ((tile === 2 || tile === 3) && s.channelingUntil === 0) {
          const dPhase = Math.abs(phase - 0.5);
          const isPerfect = dPhase <= PERFECT_WINDOW;

          let gain = (tile === 2 ? PTS_PELLET : PTS_POWER);
          if (isPerfect) {
            gain += PTS_PERFECT_BONUS;
            s.kaiCharge = Math.min(CHARGE_MAX, s.kaiCharge + 1);
          }
          gain = Math.floor(gain * scoreMult);

          s.points += gain;
          s.bankable = s.points;

          // streak / combo
          s.streak += 1;
          if (s.streak > s.bestStreak) s.bestStreak = s.streak;
          s.comboUntil = now + COMBO_WINDOW_MS;

          // consume pellet
          s.grid[pc.y][pc.x] = 0;
          s.pellets = Math.max(0, s.pellets - 1);

          // power mode
          if (tile === 3) {
            breathAnchorRef.current = now;
            const frightMs = Math.max(POWER_DURATION_MS * Math.max(0.55, 1 - (s.level - 1) * 0.08), BREATH_MS * 0.5);
            for (const g of s.ghosts) {
              g.mode = "fright";
              g.frightUntil = now + frightMs;
            }
          }
        }

        // streak decay if idle past combo window
        if (s.comboUntil > 0 && now > s.comboUntil) {
          s.streak = Math.max(0, Math.floor(s.streak * 0.5));
          s.comboUntil = 0;
        }

        // GHOSTS
        for (const g of s.ghosts) {
          if (g.mode === "fright" && now >= g.frightUntil) g.mode = s.cycle.phase;

          const playerTile = tileCenter(s.player.pos);

          if (atIntersection(s.grid, g.pos)) {
            if (g.mode === "scatter") {
              g.dir = chooseDir(s.grid, g.pos, g.dir, g.scatterTarget);
            } else if (g.mode === "fright") {
              // flee: maximize distance from player
              const c = tileCenter(g.pos);
              const options: Dir[] = ["up", "down", "left", "right"];
              let best: Dir = g.dir, bestD = -Infinity;
              for (const d of options) {
                if (d === opposite[g.dir]) continue;
                const nx = c.x + v[d].x, ny = c.y + v[d].y;
                if (!canEnter(s.grid, nx, ny)) continue;
                const d2 = dist2({ x: nx, y: ny }, playerTile);
                if (d2 > bestD) { bestD = d2; best = d; }
              }
              g.dir = best;
            } else {
              // chase: predict two steps ahead
              const lead: Vec2 = {
                x: playerTile.x + v[s.player.dir].x * 2,
                y: playerTile.y + v[s.player.dir].y * 2,
              };
              g.dir = chooseDir(s.grid, g.pos, g.dir, lead);
            }
          }

          // step ghost (breath-modulated; "fright" slower)
          const ghostBF = g.mode === "fright" ? lerp(0.6, 0.8, Math.sin(phase * Math.PI)) : bFactor;
          let ghostSpeed = g.speed * ghostBF;

          // level scaling
          ghostSpeed *= Math.pow(1.06, s.level - 1);

          stepMove(s.grid, g.pos, g.dir, ghostSpeed, dt);

          // collision
          const d2pg = dist2(s.player.pos, g.pos);
          if (d2pg < 0.4) {
            if (g.mode === "fright" && s.channelingUntil === 0) {
              // banish: big points, resets ghost to scatter target
              const gain = Math.floor(PTS_BANISH * scoreMult);
              s.points += gain; s.bankable = s.points;
              s.streak += 1; if (s.streak > s.bestStreak) s.bestStreak = s.streak;
              s.comboUntil = now + COMBO_WINDOW_MS;

              g.pos = { ...g.scatterTarget };
              g.dir = "left"; g.mode = "scatter"; g.frightUntil = 0;
            } else {
              // hit: lose % unbanked points; life down; cancel channel
              s.lives -= 1;
              s.streak = 0; s.comboUntil = 0;
              s.points = Math.max(0, Math.floor(s.points * (1 - DEATH_POINTS_LOSS)));
              s.bankable = s.points;
              s.channelingUntil = 0;

              if (s.lives <= 0) {
                s.alive = false; s.over = true;
              } else {
                const center = { x: Math.floor(s.grid[0].length / 2), y: s.grid.length - 4 };
                s.player.pos = { ...center }; s.player.dir = "left"; s.player.next = "left";
                for (const gg of s.ghosts) gg.mode = "scatter";
                breathAnchorRef.current = now;
              }
            }
          }
        }

        // Level complete
        if (s.pellets <= 0 && !s.over) {
          // level bonus: auto-convert small slice of bankable (20%) for momentum
          const threshold = bankThreshold(s.level);
          const auto = Math.floor((s.bankable * 0.2) / threshold);
          if (auto > 0) {
            const consumed = auto * threshold;
            const newBankable = Math.max(0, s.bankable - consumed);
            const newPhi = wallet + auto;
            setWallet(newPhi); onPhiChange(newPhi);
            s.scorePhi += auto;
            s.bankable = newBankable; s.points = newBankable;
          }

          const next = newGameState(s.level + 1, now);
          next.scorePhi = s.scorePhi;
          next.lives = Math.max(1, s.lives);
          next.bestStreak = Math.max(s.bestStreak, s.streak);
          next.player.speed = s.player.speed * 1.06;
          for (const g of next.ghosts) g.speed *= 1.06;
          breathAnchorRef.current = now;
          return next;
        }

        // Try finish channeling if on altar
        s = tryConvertOnAltar(now, s);

        return s;
      });
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [onPhiChange, wallet, paused, bankThreshold]);

  /* ------------------------------ Drawing ------------------------------ */

  useEffect(() => {
    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const cvs = canvasRef.current, stage = stageRef.current;
      if (!cvs || !stage) return;

      const ctx = cvs.getContext("2d"); if (!ctx) return;

      const W = Math.max(0, stageSize.w), H = Math.max(0, stageSize.h);
      if (W === 0 || H === 0) return;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cvs.width !== Math.floor(W * dpr) || cvs.height !== Math.floor(H * dpr)) {
        cvs.width = Math.floor(W * dpr); cvs.height = Math.floor(H * dpr);
        cvs.style.width = `${W}px`; cvs.style.height = `${H}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // fit maze to container
      const rows = state.grid.length, cols = state.grid[0].length;
      const TILE_PX = Math.floor(Math.min(W / cols, H / rows));
      const drawW = TILE_PX * cols, drawH = TILE_PX * rows;
      const offX = Math.floor((W - drawW) / 2), offY = Math.floor((H - drawH) / 2);

      // background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#07071a"); bg.addColorStop(1, "#0c1231");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      drawPhiSpiral(ctx, W, H);

      // grid
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const t = state.grid[y][x], gx = offX + x * TILE_PX, gy = offY + y * TILE_PX;
        if (t === 1) {
          ctx.fillStyle = "rgba(255,255,255,0.06)";
          ctx.fillRect(gx, gy, TILE_PX, TILE_PX);
          ctx.strokeStyle = "rgba(255,255,255,0.20)";
          ctx.lineWidth = 1; ctx.strokeRect(gx + 0.5, gy + 0.5, TILE_PX - 1, TILE_PX - 1);
        } else if (t === 2) {
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.beginPath(); ctx.arc(gx + TILE_PX / 2, gy + TILE_PX / 2, Math.max(2, TILE_PX * 0.09), 0, Math.PI * 2); ctx.fill();
        } else if (t === 3) {
          const grd = ctx.createRadialGradient(gx + TILE_PX / 2, gy + TILE_PX / 2, 0, gx + TILE_PX / 2, gy + TILE_PX / 2, Math.max(9, TILE_PX * 0.38));
          grd.addColorStop(0, "rgba(255,255,255,0.90)"); grd.addColorStop(1, "rgba(255,209,110,0.22)");
          ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(gx + TILE_PX / 2, gy + TILE_PX / 2, Math.max(5, TILE_PX * 0.22), 0, Math.PI * 2); ctx.fill();
        } else if (t === 4) {
          // ALTAR (⟐)
          const r = Math.max(8, TILE_PX * 0.36);
          ctx.save();
          ctx.globalAlpha = 0.9;
          const halo = ctx.createRadialGradient(gx + TILE_PX/2, gy + TILE_PX/2, r*0.2, gx + TILE_PX/2, gy + TILE_PX/2, r);
          halo.addColorStop(0, "rgba(0,255,208,0.35)"); halo.addColorStop(1, "rgba(0,255,208,0.05)");
          ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(gx + TILE_PX/2, gy + TILE_PX/2, r, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = "rgba(0,255,208,0.8)"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(gx + TILE_PX/2, gy + TILE_PX/2, r*0.65, 0, Math.PI*2); ctx.stroke();
          ctx.restore();
        }
      }

      // player
      const pp = state.player.pos;
      drawSigilDisc(ctx, offX + pp.x * TILE_PX, offY + pp.y * TILE_PX, TILE_PX * 0.45, "rgba(255,255,255,0.96)");

      // ghosts
      for (const g of state.ghosts) {
        const gp = g.pos;
        const color = g.mode === "fright" ? "rgba(100,180,255,0.92)" : g.color;
        drawGhostBlob(ctx, offX + gp.x * TILE_PX, offY + gp.y * TILE_PX, TILE_PX * 0.44, color);
      }

      const now = performance.now();
      const extAnchor = typeof window !== "undefined" && typeof window.__kai_breath_anchor === "number"
        ? window.__kai_breath_anchor : undefined;

      if (extAnchor !== undefined) drawBreathMeter(ctx, W, breathPhase(now, extAnchor));
      drawBreathMeter(ctx, W, breathPhase(now, breathAnchorRef.current));

      // HUD
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = HUD_FONT;
      const mult = Math.min(1 + state.streak * STREAK_MULT_STEP, STREAK_MULT_CAP);
      ctx.fillText(
        `Φ ${wallet.toFixed(0)}  |  PTS ${state.bankable}  |  x${mult.toFixed(2)}  |  L${state.level}  |  Lives ${state.lives}  |  Streak ${state.streak}  |  Charge ${state.kaiCharge}/${CHARGE_MAX}`,
        8,
        14
      );

      // Channeling overlay progress
      if (state.channelingUntil > 0 && state.onAltar) {
        const remain = Math.max(0, state.channelingUntil - now);
        const pct = 1 - remain / ALTAR_CHANNEL_MS;
        const cx = W / 2, cy = 34, R = 16;
        ctx.strokeStyle = "rgba(0,255,208,0.9)"; ctx.lineWidth = 4; ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI/2, -Math.PI/2 + pct * Math.PI*2); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.font = "700 12px ui-sans-serif,system-ui,-apple-system";
        const msg = "Channeling…";
        ctx.fillText(msg, cx + R + 8, cy + 4);
      }

      // Paused overlay
      if (paused && !state.over) {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff";
        ctx.font = "700 16px ui-sans-serif,system-ui,-apple-system";
        const msg = "Paused — another Realm is active";
        ctx.fillText(msg, (W - ctx.measureText(msg).width) / 2, H / 2);
      }

      if (state.over) {
        ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff"; ctx.font = "700 20px ui-sans-serif,system-ui,-apple-system";
        const msg = "Game Over — Press R to restart";
        ctx.fillText(msg, (W - ctx.measureText(msg).width) / 2, H / 2);
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [state, wallet, stageSize, paused]);

  /* ----------------------------- JSX ----------------------------- */

  const showChannelBtn = state.onAltar && state.channelingUntil === 0;

  return (
    <div
      className="km-wrap"
      role="group"
      aria-label="Kai-Maze"
      onPointerDown={() => takeFocus()}
      onTouchStart={() => takeFocus()}
      onMouseDown={() => takeFocus()}
    >
      <div className="km-header">
        <div className="km-title">🌀 Kai-Maze</div>
        <div className="km-sub">Score on pulse, risk your points, then ⟐ channel to mint Φ.</div>
      </div>

      <div className="km-stage" ref={stageRef}>
        <canvas ref={canvasRef} className="km-canvas" />

        {/* Mobile D-pad */}
        {dpadVisible && (
          <div
            className="km-dpad"
            style={{
              position: "absolute", left: 12, bottom: 12, width: 132, height: 132,
              display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(3, 1fr)",
              gap: 6, touchAction: "none", userSelect: "none", zIndex: 4
            }}
            aria-label="Directional pad"
          >
            <div />
            <button
              className="km-dpad-btn"
              style={padBtnStyle}
              aria-label="Move up"
              onPointerDown={(e) => { e.preventDefault(); handlePadDir("up"); }}
            >▲</button>
            <div />

            <button
              className="km-dpad-btn"
              style={padBtnStyle}
              aria-label="Move left"
              onPointerDown={(e) => { e.preventDefault(); handlePadDir("left"); }}
            >◀</button>

            <button
              className="km-dpad-btn"
              style={{ ...padBtnStyle, opacity: 0.9 }}
              aria-label="Hold to Channel (if on altar)"
              onPointerDown={(e) => { e.preventDefault(); startChannel(); }}
              title="Channel one breath to convert points → Φ"
            >⟐</button>

            <button
              className="km-dpad-btn"
              style={padBtnStyle}
              aria-label="Move right"
              onPointerDown={(e) => { e.preventDefault(); handlePadDir("right"); }}
            >▶</button>

            <div />
            <button
              className="km-dpad-btn"
              style={padBtnStyle}
              aria-label="Move down"
              onPointerDown={(e) => { e.preventDefault(); handlePadDir("down"); }}
            >▼</button>
            <div />
          </div>
        )}

        {/* Big CHANNEL button on altar (mobile & desktop) */}
        {showChannelBtn && (
          <button
            className="km-chan-btn"
            onClick={() => { takeFocus(); setState(s => s.channelingUntil ? s : ({ ...s, channelingUntil: performance.now() + ALTAR_CHANNEL_MS })); }}
            aria-label="Channel points into Phi"
            title="Channel one breath to convert points → Φ"
          >
            ⟐ CHANNEL
          </button>
        )}
        {state.channelingUntil > 0 && (
          <button
            className="km-chan-cancel"
            onClick={() => { takeFocus(); setState(s => ({ ...s, channelingUntil: 0 })); }}
            aria-label="Cancel channeling"
            title="Cancel"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="km-footer">
        <button className="km-btn" onClick={onExit} title="Back">Back</button>
        <div className="km-hint">
          {controlsHint}
        </div>
      </div>
    </div>
  );
};

export default KaiMaze;

/* ----------------------------- Drawing helpers ----------------------------- */

function drawSigilDisc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.save(); ctx.fillStyle = fill;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1.25; ctx.stroke();
  ctx.restore();
}

function drawGhostBlob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.save(); ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0);
  ctx.lineTo(x + r, y + r * 0.85); ctx.lineTo(x - r, y + r * 0.85);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.15, r * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.35, y - r * 0.15, r * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.beginPath(); ctx.arc(x - r * 0.30, y - r * 0.15, r * 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.30, y - r * 0.15, r * 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBreathMeter(ctx: CanvasRenderingContext2D, w: number, phase: number) {
  const y = 20, barW = Math.min(460, Math.max(220, w * 0.5)), cx = w / 2, half = barW / 2;
  ctx.save();
  ctx.globalAlpha = 0.35; ctx.strokeStyle = "rgba(0,255,208,.6)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - half, y); ctx.lineTo(cx + half, y); ctx.stroke();
  const win = HALF(barW * PERFECT_WINDOW * 2);
  ctx.globalAlpha = 0.2; ctx.fillStyle = "#ffd36e"; ctx.fillRect(cx - win, y - 3, win * 2, 6);
  ctx.globalAlpha = 0.9; ctx.fillStyle = "#00ffd0";
  const px = cx - half + phase * barW; ctx.beginPath(); ctx.arc(px, y, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function HALF(n: number) { return n / 2; }

function drawPhiSpiral(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save(); ctx.globalAlpha = 0.08; ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1;
  const cx = w / 2, cy = h / 2, phi = (1 + Math.sqrt(5)) / 2;
  let a = 4;
  for (let i = 0; i < 8; i++) {
    const r = Math.min(w, h) / a;
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI); ctx.stroke();
    a *= phi;
  }
  ctx.restore();
}

/* ----------------------------- Inline pad style ----------------------------- */

const padBtnStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
  border: "1px solid rgba(255,255,255,0.25)",
  borderRadius: 10,
  color: "rgba(255,255,255,0.9)",
  fontSize: 18,
  lineHeight: 1,
  padding: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 36,
  minHeight: 36,
  touchAction: "none",
};
