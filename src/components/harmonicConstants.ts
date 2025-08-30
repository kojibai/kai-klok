// harmonicConstants.ts

export const PHI = (1 + Math.sqrt(5)) / 2;
export const BREATH_SEC = (3 + Math.sqrt(5)) * 1000;
export const PULSE_INTERVAL_MS = Math.round(BREATH_SEC * 1000);
export const PULSES_PER_DAY = Math.floor(91_584 / BREATH_SEC);
export const PHI_FADE = PHI;
