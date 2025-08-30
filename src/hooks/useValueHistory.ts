// useValueHistory.ts (Kairos-only)
import { useCallback, useRef, useState } from "react";

export type ValuePoint = { t: number; v: number };

type Options = {
  maxPoints?: number;   // cap on buffer size (number of samples kept)
  maxBeats?: number;    // Kai retention window in beats (older beats are pruned)
};

/* ────────────────────────────────
   Kai time helpers (beats ⇄ ms)
   ──────────────────────────────── */
const HARMONIC_DAY_PULSES = 17491.270421;          // canon
const BREATH_SEC = 3 + Math.sqrt(5);               // 3 + √5
const BEATS_PER_DAY = 36;
const MS_PER_BEAT =
  (HARMONIC_DAY_PULSES * BREATH_SEC * 1000) / BEATS_PER_DAY; // ≈ 2_544_041.137 ms
const GENESIS_TS = 1715323541888;                  // 2024-05-10T06:45:41.888Z

function msToAbsBeat(ms: number): number {
  return (ms - GENESIS_TS) / MS_PER_BEAT;
}
function toAbsKaiBeats(t: number): number {
  // Heuristic: epoch-ms if very large
  return t > 1e11 ? msToAbsBeat(t) : t;
}

export function useValueHistory(opts?: Options) {
  const maxPoints = Math.max(60, Math.floor(opts?.maxPoints ?? 36 * 42 * 8));
  const maxBeats  = Math.max(1, Math.floor(opts?.maxBeats  ?? 36 * 42)); // 42 Kai days

  const bufRef = useRef<ValuePoint[]>([]);
  const [, setBump] = useState(0);

  const pushSample = useCallback((p: ValuePoint) => {
    const buf = bufRef.current;

    // Compute *Kai-beat* cutoff even if the incoming sample is in ms
    const lastBeatAbs = toAbsKaiBeats(p.t);
    const cutoffAbs = lastBeatAbs - maxBeats;

    // prune by Kai beats
    let i = 0;
    while (i < buf.length && toAbsKaiBeats(buf[i].t) < cutoffAbs) i++;
    if (i > 0) buf.splice(0, i);

    // append and cap by count
    buf.push(p);
    if (buf.length > maxPoints) buf.splice(0, buf.length - maxPoints);

    setBump((x) => x + 1); // force rerender
  }, [maxPoints, maxBeats]);

  const reset = useCallback(() => {
    bufRef.current = [];
    setBump((x) => x + 1);
  }, []);

  // Return a fresh snapshot every render so downstream memos update
  return { series: bufRef.current.slice(), pushSample, reset };
}
