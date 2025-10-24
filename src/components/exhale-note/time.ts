// time.ts — Kai pulse helpers
import { GENESIS_MS, PULSE_MS } from "./constants";

export function kaiPulseNowBridge(): number {
  const now = Date.now();
  const dp = (now - GENESIS_MS) / PULSE_MS; // pulses since genesis (float)
  return dp < 0 ? 0 : dp;
}

export function msUntilNextPulseBoundary(pulseFloat: number): number {
  const frac = pulseFloat - Math.floor(pulseFloat);
  const ms = Math.max(0, Math.round((1 - frac) * PULSE_MS));
  // ensure at least one full period when exactly on boundary
  return ms === 0 ? PULSE_MS : ms;
}
