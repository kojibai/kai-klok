// src/components/KaiRealms/RealmView.tsx
"use client";

/// <reference types="react" />

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { GlyphData } from "./GlyphUtils";
import { useKaiPulse } from "./KaiPulseEngine";
import { drawSigilGlyph } from "./SigilAvatar";
import KaiKasino from "./KaiKasino";
import { useGameSession } from "./useGameSession";
import type { RemotePlayerState } from "./types";

import "./styles/realm-view.css";
import "./styles/realm-view.custom.css";

/* ----------------------------- Constants ----------------------------- */

const BASE_W = 800;
const BASE_H = 500;
const ASPECT = BASE_W / BASE_H;

const PLAYER_RADIUS = 28;
const ORB_RADIUS = 10;

const MOVE_SPEED = 360;           // px / second
const SEND_FPS = 10;              // network send throttle

// Breath timing
const BREATH_MS = 5236;           // golden breath (Kai)
const PERFECT_WINDOW = 0.08;      // ±8% around mid-breath counts as "Perfect Breath"

// Flow gameplay (breath-paced, not gravity)
const MAX_ORBS = 22;              // on-screen cap (mobile tuned)
const BASE_VY = 90;               // px/s at breath average for basic
const GOLD_VY = 80;               // px/s at breath average for gold
const PULSE_SPAWN = 2;            // orbs spawned each pulse
const GOLD_EVERY = 4;             // every Nth pulse includes a gold orb
const STREAK_SPEED_BONUS = 10;    // extra vy per streak step (small)

// Meta systems
const MAX_LIVES = 3;
const MISS_PENALTY = 1;           // lose Φ on miss (soft)
const GOLD_REWARD = 3;            // Φ for catching gold
const BASIC_REWARD = 1;           // Φ for catching basic
const PERFECT_BONUS = 1;          // +Φ when caught near mid-breath

/* Utility */
const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

/* Local orb type (breath-paced falling) */
type OrbKind = "basic" | "gold";
type Orb = {
  id: string;
  x: number;
  y: number;
  vx: number;
  baseVy: number;    // baseline speed; breath modulates actual vy
  kind: OrbKind;
  bornAt: number;    // ms
};

/* ----------------------------- Component ----------------------------- */

interface Props {
  glyphData: GlyphData;
  onExit?: () => void;
}

const RealmView: React.FC<Props> = ({ glyphData, onExit }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // responsive size (CSS pixels)
  const [size, setSize] = useState<{ w: number; h: number }>({ w: BASE_W, h: BASE_H });
  const sizeRef = useRef(size);
  useEffect(() => { sizeRef.current = size; }, [size]);

  // HUD/game state
  const [collected, setCollected] = useState<number>(0); // banked Φ (score)
  const [currentPulse, setCurrentPulse] = useState<number>(0);
  const [paused, setPaused] = useState<boolean>(false);
  const [lives, setLives] = useState<number>(MAX_LIVES);
  const [streak, setStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [gameOver, setGameOver] = useState<boolean>(false);

  // Breath timing anchor
  const lastPulseAtRef = useRef<number>(performance.now()); // ms since last onPulse()

  // Networking (keep refs stable to avoid render loops)
  const { sendState, remoteStates } = useGameSession();
  const remoteStatesRef = useRef<RemotePlayerState[]>([]);
  useEffect(() => { remoteStatesRef.current = remoteStates ?? []; }, [remoteStates]);

  // Game refs (no re-render on every frame)
  const playerXRef = useRef<number>(BASE_W / 2);
  const orbsRef = useRef<Orb[]>([]);
  const keysRef = useRef<Record<string, boolean>>({});
  const rafIdRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const lastSentRef = useRef<{ x: number; pulseIndex: number } | null>(null);
  const lastSendAtRef = useRef<number>(0);
  const pulseCountRef = useRef<number>(0);

  // Catch feedback (canvas-drawn, no re-render)
  const catchFlashRef = useRef<{ t: number; x: number; kind: "perfect" | "good" } | null>(null);

  /* --------------------------- Responsive canvas --------------------------- */
  useEffect(() => {
    const host = wrapRef.current;
    if (!host) return;

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      // keep aspect; clamp to reasonable bounds
      const w = Math.max(320, Math.min(960, cr.width));
      const h = Math.round(w / ASPECT);
      setSize({ w, h });
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  // Apply DPR scaling whenever size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    canvas.width = Math.floor(size.w * dpr);
    canvas.height = Math.floor(size.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // reset & scale
    ctxRef.current = ctx;

    // keep player bounded when size changes
    playerXRef.current = clamp(playerXRef.current, PLAYER_RADIUS, size.w - PLAYER_RADIUS);
  }, [size]);

  /* --------------------------- Controls --------------------------- */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
      if (e.key.toLowerCase() === "p") setPaused((p) => !p);
      if (e.key.toLowerCase() === "r") {
        if (gameOver) hardReset();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [gameOver]);

  // Pointer / touch control (tap/drag anywhere to steer)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toLocalX = (clientX: number): number => {
      const rect = canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * sizeRef.current.w;
      return clamp(x, PLAYER_RADIUS, sizeRef.current.w - PLAYER_RADIUS);
    };

    let dragging = false;
    const onPointerDown = (e: PointerEvent) => { dragging = true; playerXRef.current = toLocalX(e.clientX); };
    const onPointerMove = (e: PointerEvent) => { if (dragging) playerXRef.current = toLocalX(e.clientX); };
    const onPointerUp = () => { dragging = false; };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  /* ------------------------- Breath helpers ------------------------- */

  // 0..1 phase since last pulse; 0 = start of breath, 0.5 = mid (exhale apex)
  const breathPhase = (nowMs: number): number => {
    const t = Math.max(0, nowMs - lastPulseAtRef.current);
    return (t % BREATH_MS) / BREATH_MS;
  };

  // Smooth speed factor over breath: slow at edges, fast at center.
  // Using sin^2 for a clean symmetrical ease (0..1..0).
  const breathSpeedFactor = (phase01: number): number => {
    const s = Math.sin(Math.PI * phase01); // 0..1..0
    // map to ~[0.65, 1.35] so it never "stops" and never races too hard.
    return 0.65 + 0.70 * (s * s);
  };

  /* ------------------------- Spawning (breath-paced) ------------------------- */

  const spawnOrb = (kind: OrbKind): void => {
    const { w } = sizeRef.current;
    const now = performance.now();
    const x = Math.random() * (w - 2 * ORB_RADIUS) + ORB_RADIUS;
    const y = -ORB_RADIUS * 2; // just above the top
    const vx = (Math.random() - 0.5) * 40; // small side drift (gentle for mobile)
    const baseVy = (kind === "gold" ? GOLD_VY : BASE_VY) + streak * (STREAK_SPEED_BONUS * 0.2);
    const id = `${kind}-${now}-${Math.floor(Math.random() * 1e6)}`;
    const next: Orb = { id, x, y, vx, baseVy, kind, bornAt: now };
    const capped = orbsRef.current.slice(-(MAX_ORBS - 1));
    capped.push(next);
    orbsRef.current = capped;
  };

  useKaiPulse({
    onPulse: (pulseIndex: number) => {
      setCurrentPulse(pulseIndex);
      lastPulseAtRef.current = performance.now();
      pulseCountRef.current += 1;

      // Breath-paced batch spawns
      for (let i = 0; i < PULSE_SPAWN; i++) spawnOrb("basic");
      if (pulseCountRef.current % GOLD_EVERY === 0) spawnOrb("gold");
    },
  });

  /* ------------------------ Networking send ------------------------ */
  const trySendState = (nowMs: number): void => {
    const last = lastSentRef.current;
    const x = playerXRef.current;
    const pulseIndex = currentPulse;

    const shouldSend =
      !last ||
      Math.abs(last.x - x) >= 1 ||
      last.pulseIndex !== pulseIndex ||
      nowMs - lastSendAtRef.current > 1000 / SEND_FPS;

    if (!shouldSend) return;

    lastSentRef.current = { x, pulseIndex };
    lastSendAtRef.current = nowMs;

    try {
      sendState({
        id: "you",
        x,
        pulseIndex,
        chakraDay: glyphData.meta.chakraDay,
        glyph: glyphData,
      });
    } catch {
      // swallow transient transport errors
    }
  };

  /* ------------------------------ Loop ------------------------------ */

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    let mounted = true;

    const loop = (ts: number): void => {
      if (!mounted) return;
      rafIdRef.current = requestAnimationFrame(loop);

      const last = lastTsRef.current ?? ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      lastTsRef.current = ts;

      const { w, h } = sizeRef.current;
      const playerY = h - PLAYER_RADIUS - 10;

      if (!paused && !gameOver) {
        // INPUT → update player
        const k = keysRef.current;
        const movingLeft = Boolean(k["ArrowLeft"] || k["a"] || k["A"]);
        const movingRight = Boolean(k["ArrowRight"] || k["d"] || k["D"]);

        if (movingLeft) {
          playerXRef.current = clamp(
            playerXRef.current - MOVE_SPEED * dt,
            PLAYER_RADIUS,
            w - PLAYER_RADIUS
          );
        }
        if (movingRight) {
          playerXRef.current = clamp(
            playerXRef.current + MOVE_SPEED * dt,
            PLAYER_RADIUS,
            w - PLAYER_RADIUS
          );
        }

        // UPDATE ORBS (breath-paced vertical speed)
        const px = playerXRef.current;
        const nowMs = performance.now();
        const phase = breathPhase(nowMs);
        const speedF = breathSpeedFactor(phase);

        const kept: Orb[] = [];
        let gained = 0;
        let bonus = 0;
        let missed = 0;

        for (let i = 0; i < orbsRef.current.length; i++) {
          const o = orbsRef.current[i];

          // breath-paced velocity (downwards only, modulated by phase)
          const vy = (o.baseVy + streak * (STREAK_SPEED_BONUS * 0.15)) * speedF;

          // integrate
          o.x += o.vx * dt;
          o.y += vy * dt;

          // clamp x bounds with soft bounce
          if (o.x < ORB_RADIUS) { o.x = ORB_RADIUS; o.vx = Math.abs(o.vx) * 0.9; }
          if (o.x > w - ORB_RADIUS) { o.x = w - ORB_RADIUS; o.vx = -Math.abs(o.vx) * 0.9; }

          // catch?
          const dx = o.x - px;
          const dy = o.y - playerY;
          const dist = Math.hypot(dx, dy);
          const catchRadius = PLAYER_RADIUS + ORB_RADIUS;
          if (dist < catchRadius) {
            const baseGain = (o.kind === "gold" ? GOLD_REWARD : BASIC_REWARD);
            gained += baseGain;

            // Perfect Breath bonus near phase 0.5
            const dPhase = Math.abs(phase - 0.5);
            if (dPhase <= PERFECT_WINDOW) {
              bonus += PERFECT_BONUS;
              catchFlashRef.current = { t: nowMs, x: px, kind: "perfect" };
            } else {
              catchFlashRef.current = { t: nowMs, x: px, kind: "good" };
            }
            continue; // collected (not kept)
          }

          // missed?
          if (o.y > h + ORB_RADIUS) {
            missed += 1; // fell past player
            continue;
          }

          kept.push(o);
        }

        if (gained > 0 || bonus > 0) {
          const total = gained + bonus;
          setCollected((c) => c + total);
          setStreak((s) => {
            const ns = s + 1;
            setBestStreak((b) => (ns > b ? ns : b));
            return ns;
          });
        }

        if (missed > 0) {
          // soft Φ penalty + streak reset + life loss
          setCollected((c) => Math.max(0, c - MISS_PENALTY * missed));
          setStreak(0);
          setLives((L) => {
            const n = Math.max(0, L - missed);
            if (n === 0) setGameOver(true);
            return n;
          });
        }

        orbsRef.current = kept;

        // Networking (throttled)
        trySendState(ts);
      }

      // RENDER
      drawScene(
        ctx,
        glyphData,
        playerXRef.current,
        playerY,
        paused || gameOver,
        orbsRef.current,
        remoteStatesRef.current,
        sizeRef.current,
        lastPulseAtRef.current,
        catchFlashRef.current
      );
    };

    rafIdRef.current = requestAnimationFrame(loop);
    return () => {
      mounted = false;
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      lastTsRef.current = null;
    };
  }, [glyphData, paused, gameOver, size.w, size.h]);

  /* ----------------------------- Helpers ----------------------------- */

  const hardReset = (): void => {
    orbsRef.current = [];
    setLives(MAX_LIVES);
    setStreak(0);
    setBestStreak((b) => b); // keep best
    setGameOver(false);
  };

  /* ----------------------------- View ----------------------------- */

  const hud = useMemo(
    () => ({
      pulse: currentPulse,
      chakraDay: glyphData?.meta?.chakraDay ?? "—",
    }),
    [currentPulse, glyphData?.meta?.chakraDay]
  );

  return (
    <div className="realm-wrap" ref={wrapRef}>
      <div className="realm-hud">
        <div className="hud-chip hud-chip--score" title="Banked Φ">
          <span className="hud-chip__label">Φ</span>
          <span className="hud-chip__value">{collected}</span>
        </div>

        <div className="hud-chip" title="Streak">
          <span className="hud-chip__label">Streak</span>
          <span className="hud-chip__value">{streak}</span>
        </div>

        <div className="hud-chip" title="Lives">
          <span className="hud-chip__label">Lives</span>
          <span className="hud-chip__value">{lives}</span>
        </div>

        <div className="hud-chip" title="Current Pulse">
          <span className="hud-chip__label">Pulse</span>
          <span className="hud-chip__value">{hud.pulse}</span>
        </div>

        <div className="hud-chip" title="Chakra Day">
          <span className="hud-chip__label">Day</span>
          <span className="hud-chip__value">{hud.chakraDay}</span>
        </div>

        <button
          className="hud-button"
          onClick={() => setPaused((p) => !p)}
          aria-pressed={paused}
          title="Pause (P)"
        >
          {paused ? "Resume" : "Pause"}
        </button>
      </div>

      <div className="realm-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="realm-canvas"
          aria-label="Kai Realms Canvas"
        />
        {(paused || gameOver) && (
          <div className="realm-pause-overlay" aria-hidden>
            <div className="pause-card">
              <div className="pause-title">{gameOver ? "Game Over" : "Paused"}</div>
              <div className="pause-sub">
                {gameOver ? (
                  <>
                    Best Streak: <strong>{bestStreak}</strong> — Press <kbd>R</kbd> to Restart
                  </>
                ) : (
                  <>Press <kbd>P</kbd> or click Resume</>
                )}
              </div>
              {gameOver && (
                <button className="hud-button" onClick={hardReset} style={{ marginTop: 12 }}>
                  Restart
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pass banked Φ into Forge/Maze module */}
      <KaiKasino
        currentPhi={collected}
        onPhiChange={(newVal: number) => setCollected(newVal)}
      />

      <button className="exit-button" onClick={onExit}>
        Exit Realm
      </button>
    </div>
  );
};

export default RealmView;

/* ---------------------------- Drawing code ---------------------------- */

function drawScene(
  ctx: CanvasRenderingContext2D,
  glyph: GlyphData,
  playerX: number,
  playerY: number,
  dimOverlay: boolean,
  orbs: Orb[],
  remotes: RemotePlayerState[],
  size: { w: number; h: number },
  lastPulseAt: number,
  flash: { t: number; x: number; kind: "perfect" | "good" } | null
): void {
  const { w, h } = size;

  // bg
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#020211");
  g.addColorStop(1, "#0b0f2a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // stars/fog
  ctx.save();
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 40; i++) {
    const x = ((i * 197) % w) + (i % 3);
    const y = ((i * 127) % h) + ((i * 11) % 7);
    ctx.fillStyle = "white";
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();

  // small breath meter at top (shows phase; helpful on mobile)
  drawBreathMeter(ctx, w, Math.max(36, Math.round(h * 0.06)), lastPulseAt);

  // orbs (with subtle tails)
  for (let i = 0; i < orbs.length; i++) {
    drawOrb(ctx, orbs[i]);
  }

  // player
  drawSigilGlyph(ctx, glyph, playerX, playerY, PLAYER_RADIUS);

  // remotes (ghosts)
  for (let i = 0; i < remotes.length; i++) {
    const r = remotes[i];
    drawSigilGlyph(
      ctx,
      r.glyph,
      clamp(r.x, PLAYER_RADIUS, w - PLAYER_RADIUS),
      playerY,
      PLAYER_RADIUS
    );
  }

  // catch flash
  if (flash) {
    const age = performance.now() - flash.t;
    if (age < 650) {
      const a = 1 - age / 650;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = flash.kind === "perfect" ? "#ffd36e" : "#00ffd0";
      ctx.font = "bold 16px ui-sans-serif,system-ui,Segoe UI,Roboto";
      ctx.textAlign = "center";
      ctx.fillText(flash.kind === "perfect" ? "Perfect Breath!" : "+Φ", flash.x, playerY - PLAYER_RADIUS - 16);
      ctx.restore();
    }
  }

  // floor glow
  ctx.save();
  const grd = ctx.createLinearGradient(0, playerY + PLAYER_RADIUS + 6, 0, playerY + PLAYER_RADIUS + 18);
  grd.addColorStop(0, "rgba(0,255,208,0.25)");
  grd.addColorStop(1, "rgba(0,255,208,0.0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, playerY + PLAYER_RADIUS + 6, w, 12);
  ctx.restore();

  if (dimOverlay) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

function drawBreathMeter(ctx: CanvasRenderingContext2D, w: number, h: number, lastPulseAt: number): void {
  const now = performance.now();
  const phase = ((now - lastPulseAt) % BREATH_MS) / BREATH_MS; // 0..1
  const cx = w / 2;
  const y = Math.round(h * 0.6);
  const barW = Math.min(420, Math.max(200, Math.round(w * 0.5)));
  const half = barW / 2;

  // track
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = "rgba(0,255,208,.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - half, y);
  ctx.lineTo(cx + half, y);
  ctx.stroke();

  // marker (beats to center)
  const px = cx - half + phase * barW;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#00ffd0";
  ctx.beginPath();
  ctx.arc(px, y, 4, 0, Math.PI * 2);
  ctx.fill();

  // mid-breath guide (perfect window)
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#ffd36e";
  const mid = cx;
  const win = barW * PERFECT_WINDOW;
  ctx.fillRect(mid - win, y - 3, win * 2, 6);

  ctx.restore();
}

function drawOrb(ctx: CanvasRenderingContext2D, o: Orb): void {
  ctx.save();
  const r = ORB_RADIUS;

  // Tail (downwards)
  ctx.globalAlpha = 0.35;
  const tail = 12; // steady tail for clarity on mobile
  const grad = ctx.createLinearGradient(o.x, o.y - tail, o.x, o.y + r);
  grad.addColorStop(0, "rgba(0,255,208,0.0)");
  grad.addColorStop(1, o.kind === "gold" ? "rgba(255,211,110,0.35)" : "rgba(0,255,208,0.35)");
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(o.x, o.y - tail);
  ctx.lineTo(o.x, o.y + r * 0.2);
  ctx.stroke();

  // Core glow (gold has warmer tint)
  ctx.globalAlpha = 1;
  const inner = ctx.createRadialGradient(o.x, o.y, r * 0.15, o.x, o.y, r);
  inner.addColorStop(0, "#fff");
  if (o.kind === "gold") {
    inner.addColorStop(0.5, "#ffd36e");
    inner.addColorStop(1, "rgba(255,211,110,0.0)");
  } else {
    inner.addColorStop(0.5, "#00ffd0");
    inner.addColorStop(1, "rgba(0,255,208,0.0)");
  }
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
  ctx.fill();

  // Rim
  ctx.strokeStyle = o.kind === "gold" ? "rgba(255,211,110,.75)" : "rgba(0,255,208,.65)";
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.restore();
}
