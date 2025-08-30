// src/utils/kaiMath.ts
import { PULSES_STEP } from "./kai_pulse";

export function stepsToPulses(steps: number) {
  return Math.max(0, Math.floor(steps)) * PULSES_STEP;
}
export function breathsToPulses(breaths: number) {
  return Math.max(0, Math.floor(breaths));
}

export function stepIndexFromPulse(pulse: number, stepsPerBeat: number) {
  const pulsesPerBeat = PULSES_STEP * stepsPerBeat;
  const into = ((pulse % pulsesPerBeat) + pulsesPerBeat) % pulsesPerBeat;
  return Math.floor(into / PULSES_STEP);
}
export function stepProgressWithinStepFromPulse(pulse: number, stepsPerBeat: number) {
  const pulsesPerBeat = PULSES_STEP * stepsPerBeat;
  const into = ((pulse % pulsesPerBeat) + pulsesPerBeat) % pulsesPerBeat;
  const intoStep = into % PULSES_STEP;
  return intoStep / PULSES_STEP;
}
