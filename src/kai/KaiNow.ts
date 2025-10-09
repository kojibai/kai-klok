// src/kai/KaiNow.ts
// STRICT: no any, browser/SSR-safe (guards), no empty catches.

import { PULSE_MS, STEPS_BEAT } from "../utils/kai_pulse";
import type { ChakraName } from "../utils/sigilCapsule";

export type KaiNow = {
  pulse: number;
  beat: number;
  stepIndex: number;
  stepPct: number;
  chakraDay: ChakraName;
};

/** Local mapping of weekday → chakra (tweak as desired). */
const CHAKRAS: readonly ChakraName[] = [
  "Root",         // Sunday    (0)
  "Sacral",       // Monday    (1)
  "Solar Plexus", // Tuesday   (2)
  "Heart",        // Wednesday (3)
  "Throat",       // Thursday  (4)
  "Third Eye",    // Friday    (5)
  "Crown",        // Saturday  (6)
] as const;

/** Compute the current Kai cadence from local time. */
export function getKaiNow(date: Date = new Date()): KaiNow {
  const ms = date.getTime();
  const pulse = Math.floor(ms / PULSE_MS);

  // Distribute steps within a beat, then beats cyclically (12-beat cycle by convention)
  const stepIndex = pulse % STEPS_BEAT;
  const stepPct = Math.min(1, Math.max(0, stepIndex / Math.max(1, STEPS_BEAT - 1)));
  const beat = Math.floor(pulse / STEPS_BEAT) % 12;

  // Simple weekday mapping (local time); swap to getUTCDay() if you prefer UTC.
  const chakraDay = CHAKRAS[date.getDay()];

  return { pulse, beat, stepIndex, stepPct, chakraDay };
}
