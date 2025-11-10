// src/components/KaiRealms/KaiKasino.tsx
// Replaces the old "KaiKasino" with a non-casino skill game: Pulse Forge,
// and adds a Kai-Maze (Pac-Man–style) mode toggle.

"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useKaiPulse } from "./KaiPulseEngine";
import { KaiMaze } from "./KaiMaze";
import "./styles/pulse-forge.css";

type Props = {
  currentPhi: number;
  onPhiChange: (newAmount: number) => void;
};

/** Breath period in ms (Kai) */
const BREATH_MS = 5236;

/** Economy */
const ATTEMPT_COST = 3;
const BASE_REWARD = ATTEMPT_COST * (3 - 1); // +6 Φ baseline on success
const CRIT_MULTIPLIER = 2;                   // crit pays 2× reward
const STREAK_BONUS_PER = 0.15;               // +15% per streak step

/** Dial visuals */
const DIAL_SIZE = 220;                        // px
const TARGET_ARC_BASE_DEG = 60;              // base width
const TARGET_ARC_EVEN_BONUS = 20;            // more generous on even pulses

/** Deterministic PRNG seeded by pulseIndex (keeps target stable during a pulse) */
function seededRandom01(seed: number): number {
  const n = Math.imul(seed ^ 0x9e3779b9, 2654435761) >>> 0;
  return (n % 100000) / 100000;
}

/** Normalize an angle difference to [0, 180] */
function angularDistanceDeg(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

const PulseForge: React.FC<Props> = ({ currentPhi, onPhiChange }) => {
  const [mode, setMode] = useState<"forge" | "maze">("forge");

  const [lastPulse, setLastPulse] = useState<number | null>(null);
  const [lastPulseAt, setLastPulseAt] = useState<number>(performance.now());
  const [angle, setAngle] = useState<number>(0); // marker live angle [0,360)
  const [isLocking, setIsLocking] = useState<boolean>(false);
  const [result, setResult] = useState<null | { kind: "hit" | "crit" | "miss"; delta: number }>(null);
  const [streak, setStreak] = useState<number>(0);

  // pulse listener
  useKaiPulse({
    onPulse: (pulseIndex: number) => {
      setLastPulse(pulseIndex);
      setLastPulseAt(performance.now());
      setResult((r) => (r ? { ...r, delta: r.delta } : r));
    },
  });

  // marker angle (raf loop; derives from lastPulseAt)
  useEffect(() => {
    if (mode !== "forge") return; // pause dial animation while in maze
    let rafId = 0;
    let mounted = true;

    const tick = () => {
      if (!mounted) return;
      const now = performance.now();
      const t = Math.max(0, now - lastPulseAt);
      const phase = (t % BREATH_MS) / BREATH_MS; // 0..1
      setAngle((phase * 360) % 360);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
    };
  }, [lastPulseAt, mode]);

  // target arc center & width are stable per pulse
  const target = useMemo(() => {
    const pulse = lastPulse ?? 0;
    const center = Math.floor(seededRandom01(pulse) * 360); // 0..359
    const width =
      TARGET_ARC_BASE_DEG +
      (pulse % 2 === 0 ? TARGET_ARC_EVEN_BONUS : 0) -
      Math.min(20, Math.floor(streak * 6)); // narrower with streak for difficulty
    return {
      centerDeg: center,
      halfWidthDeg: Math.max(10, width / 2),
    };
  }, [lastPulse, streak]);

  const canAttempt = useMemo(
    () => mode === "forge" && !isLocking && currentPhi >= ATTEMPT_COST && lastPulse !== null,
    [mode, isLocking, currentPhi, lastPulse]
  );

  /** Compute current reward (with streak). Floor to integer Φ. */
  const computeReward = useCallback(
    (crit: boolean): number => {
      const base = BASE_REWARD;
      const streakBonus = 1 + streak * STREAK_BONUS_PER;
      const mult = crit ? CRIT_MULTIPLIER : 1;
      return Math.floor(base * streakBonus * mult);
    },
    [streak]
  );

  /** Lock attempt — skill timing */
  const onLock = useCallback((): void => {
    if (!canAttempt) return;

    // Spend cost immediately
    const afterCost = currentPhi - ATTEMPT_COST;
    onPhiChange(afterCost);

    setIsLocking(true);
    setResult(null);

    // judge timing vs target arc
    const dist = angularDistanceDeg(angle, target.centerDeg);
    const critWindow = Math.max(4, target.halfWidthDeg * 0.25); // inner quarter is crit zone
    const isHit = dist <= target.halfWidthDeg;
    const isCrit = isHit && dist <= critWindow;

    window.setTimeout(() => {
      if (isHit) {
        const gain = computeReward(isCrit);
        onPhiChange(afterCost + gain);
        setStreak((s) => s + 1);
        setResult({ kind: isCrit ? "crit" : "hit", delta: gain });
      } else {
        setStreak(0);
        setResult({ kind: "miss", delta: -ATTEMPT_COST });
      }
      setIsLocking(false);
    }, 650);
  }, [canAttempt, currentPhi, onPhiChange, angle, target.centerDeg, target.halfWidthDeg, computeReward]);

  // Space/Enter to lock (enabled only in Forge mode)
  useEffect(() => {
    if (mode !== "forge") return;
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === " " || key === "enter") {
        e.preventDefault();
        onLock();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, onLock]);

  // ────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────
  return (
    <div className="pf-wrap" role="group" aria-label="Pulse Forge">
      {mode === "forge" ? (
        <>
          <div className="pf-header">
            <div className="pf-title">⚒️ Pulse Forge</div>
            <div className="pf-sub">Time your lock to the target arc. Breathe, focus, forge.</div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button
                type="button"
                className="pf-lock-btn"
                onClick={() => setMode("maze")}
                title="Switch to Kai-Maze"
              >
                Play Kai-Maze
              </button>
            </div>
          </div>

          <div className="pf-board">
            <div className="pf-dial" style={{ width: DIAL_SIZE, height: DIAL_SIZE }}>
              {/* target arc */}
              <div
                className="pf-arc"
                style={
                  {
                    ["--arc-center" as string]: `${target.centerDeg}deg`,
                    ["--arc-half" as string]: `${target.halfWidthDeg}deg`,
                  } as React.CSSProperties
                }
                aria-hidden
              />

              {/* marker */}
              <div
                className={`pf-marker ${isLocking ? "pf-marker--lock" : ""}`}
                style={{ transform: `rotate(${angle}deg)` }}
                aria-hidden
              >
                <div className="pf-marker-head" />
              </div>

              {/* rim + ticks */}
              <div className="pf-rim" aria-hidden />
              <div className="pf-ticks" aria-hidden>
                {Array.from({ length: 12 }).map((_, i) => (
                  <span key={i} style={{ transform: `rotate(${i * 30}deg)` }} />
                ))}
              </div>
            </div>

            {/* HUD */}
            <div className="pf-hud">
              <div className="pf-chip" title="Your Φ">
                <span className="pf-chip__label">Φ</span>
                <span className="pf-chip__val">{currentPhi}</span>
              </div>
              <div className="pf-chip" title="Streak">
                <span className="pf-chip__label">Streak</span>
                <span className="pf-chip__val">{streak}</span>
              </div>
              <div className="pf-chip" title="Pulse">
                <span className="pf-chip__label">Pulse</span>
                <span className="pf-chip__val">{lastPulse ?? "—"}</span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="pf-cta">
            <button
              className="pf-lock-btn"
              onClick={onLock}
              disabled={!canAttempt}
              aria-disabled={!canAttempt}
              title={canAttempt ? "Press Space/Enter to Lock" : "Insufficient Φ or syncing…"}
            >
              {isLocking ? "Locking…" : `Lock (−${ATTEMPT_COST} Φ)`}
            </button>
            <div className="pf-hint">
              Press <kbd>Space</kbd> or <kbd>Enter</kbd> at the right moment. Even pulses widen the target.
            </div>
          </div>

          {/* Outcome */}
          {result && (
            <div className={`pf-result pf-result--${result.kind}`} role="status" aria-live="polite">
              {result.kind === "hit" && (
                <>
                  <span className="pf-result__emoji">✅</span>
                  <span className="pf-result__text">Resonant lock! +{result.delta} Φ</span>
                </>
              )}
              {result.kind === "crit" && (
                <>
                  <span className="pf-result__emoji">💥</span>
                  <span className="pf-result__text">Perfect lock! +{result.delta} Φ</span>
                </>
              )}
              {result.kind === "miss" && (
                <>
                  <span className="pf-result__emoji">❌</span>
                  <span className="pf-result__text">Miss — breathe again.</span>
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <KaiMaze
          currentPhi={currentPhi}
          onPhiChange={onPhiChange}
          onExit={() => setMode("forge")}
        />
      )}
    </div>
  );
};

export default PulseForge;
