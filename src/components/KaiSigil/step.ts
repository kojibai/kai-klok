import { STEPS_BEAT, PULSES_BEAT, PULSES_STEP } from "../../utils/kai_pulse";

/* SAFE steps per beat (>=1), integer */
export const STEPS_SAFE =
  Number.isFinite(STEPS_BEAT) && STEPS_BEAT > 0 ? Math.trunc(STEPS_BEAT) : 6;

/* Exact integer step from absolute pulse (0..43), clamped to STEPS_SAFE range */
export function stepIndexFromPulseExact(pulse: number): number {
  const p = Number.isFinite(pulse) ? Math.trunc(pulse) : 0;
  const pulsesIntoBeat = ((p % PULSES_BEAT) + PULSES_BEAT) % PULSES_BEAT; // 0..483
  const idx = Math.floor(pulsesIntoBeat / PULSES_STEP);                    // 0..43
  return Math.min(Math.max(0, idx), Math.max(1, STEPS_SAFE) - 1);
}

/* Fractional pct into current step [0,1) using absolute pulse */
export function percentIntoStepFromPulseExact(pulse: number): number {
  const p = Number.isFinite(pulse) ? Math.trunc(pulse) : 0;
  const pulsesIntoBeat = ((p % PULSES_BEAT) + PULSES_BEAT) % PULSES_BEAT;  // 0..483
  const pulsesIntoStep = pulsesIntoBeat % PULSES_STEP;                      // 0..10
  const v = pulsesIntoStep / PULSES_STEP;
  return v >= 1 ? 1 - Number.EPSILON : (v < 0 ? 0 : v);
}
