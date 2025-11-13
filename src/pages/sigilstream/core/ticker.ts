// src/pages/sigilstream/core/ticker.ts
"use client";

import { useEffect, useRef, useState } from "react";
import { computeLocalKai, GENESIS_TS, PULSE_MS, KAI_PULSE_SEC } from "./kai_time";
import type { LocalKai } from "./types";

/**
 * Returns seconds (float) until the next Kai pulse boundary, or null if inactive.
 * Uses a light interval (≈120ms) and snaps to 0.000000 at boundary.
 * Resyncs on tab visibility change to avoid background drift.
 */
export function useKaiPulseCountdown(active: boolean): number | null {
  const [secsLeft, setSecsLeft] = useState<number | null>(active ? KAI_PULSE_SEC : null);
  const tickRef = useRef<number | null>(null);

  // Boundary aligned to GENESIS_TS + n * PULSE_MS
  const nextBoundary = () => {
    const now = Date.now();
    const periods = Math.ceil((now - GENESIS_TS) / PULSE_MS);
    return GENESIS_TS + periods * PULSE_MS;
  };

  useEffect(() => {
    // Disable / cleanup
    if (!active) {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
      setSecsLeft(null);
      return;
    }

    const run = () => {
      const next = nextBoundary();
      const now = Date.now();
      if (now >= next) {
        setSecsLeft(0);
      } else {
        setSecsLeft((next - now) / 1000);
      }
    };

    // Initial tick + interval
    run();
    tickRef.current = window.setInterval(run, 120) as unknown as number;

    // Resync when tab becomes visible
    const vis = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", vis);

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
      document.removeEventListener("visibilitychange", vis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return secsLeft;
}

/**
 * μpulse-true Kai ticker.
 * - Schedules exactly at each pulse boundary using setTimeout(nextBoundary - now).
 * - Updates CSS vars on :root to phase-lock animations:
 *     --pulse-dur: PULSE_MS
 *     --pulse-offset: negative ms lag to align CSS timelines
 * - Reschedules on visibility change to stay in lockstep after backgrounding.
 */
export function useAlignedKaiTicker(): LocalKai {
  const [kai, setKai] = useState<LocalKai>(() => computeLocalKai(new Date()));
  const timerRef = useRef<number | null>(null);

  const setCssPhaseVars = () => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const now = Date.now();
    const lag = (PULSE_MS - ((now - GENESIS_TS) % PULSE_MS)) % PULSE_MS; // ms until boundary
    root.style.setProperty("--pulse-dur", `${PULSE_MS}ms`);
    // Negative delay causes CSS animations to appear already in-progress by `lag`
    root.style.setProperty("--pulse-offset", `-${Math.round(lag)}ms`);
  };

  const schedule = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);

    const now = Date.now();
    const elapsed = now - GENESIS_TS;
    const next = GENESIS_TS + Math.ceil(elapsed / PULSE_MS) * PULSE_MS;
    const delay = Math.max(0, next - now);

    // Keep CSS phase vars fresh (useful for pure-CSS progress)
    setCssPhaseVars();

    timerRef.current = window.setTimeout(() => {
      // Update state exactly at boundary, then immediately schedule the next one
      setKai(computeLocalKai(new Date()));
      schedule();
    }, delay) as unknown as number;
  };

  useEffect(() => {
    schedule();

    const onVis = () => {
      if (document.visibilityState === "visible") {
        // Recompute immediately and reschedule to avoid any drift after background throttling.
        setKai(computeLocalKai(new Date()));
        schedule();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return kai;
}
