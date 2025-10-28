// Shared micro-Φ (6dp) precision helpers — single source of truth
// Uses your existing decimal utils so Verifier + UI round IDENTICALLY.
import {
  toScaledBig,
  roundScaledToDecimals,
  fromScaledBigFixed,
} from "../components/verifier/utils/decimal";

/** Snap any Φ to exactly 6dp and return the integer micro-Φ count (Φ * 1e6). */
export const toMicroPhi = (phi: number | string): number => {
  const six = roundScaledToDecimals(toScaledBig(String(phi ?? "0")), 6);
  // "123.456789" → 123456789 (micro units)
  const s = fromScaledBigFixed(six, 6);
  return Number(s.replace(".", "")); // safe in normal ranges; keep as number for UI
};

/** Convert integer micro-Φ → Φ number with exactly 6dp */
export const fromMicroPhi = (micro: number): number =>
  Number((micro / 1_000_000).toFixed(6));

/** Snap to 6dp and return a number (Φ) */
export const snap6 = (phi: number | string): number =>
  fromMicroPhi(toMicroPhi(phi));

/** Sum/add/sub in micro space (exact) and return Φ number (6dp) */
export const addPhi = (a: number, b: number): number =>
  fromMicroPhi(toMicroPhi(a) + toMicroPhi(b));

export const subPhi = (a: number, b: number): number =>
  fromMicroPhi(Math.max(0, toMicroPhi(a) - toMicroPhi(b)));

export const sumPhi = (vals: number[]): number =>
  fromMicroPhi(vals.reduce((acc, v) => acc + toMicroPhi(v), 0));

/** Verifier bridge: get a 6dp-rounded scaled bigint and its fixed 6dp string */
export const toScaled6 = (phi: string | number): bigint =>
  roundScaledToDecimals(toScaledBig(String(phi ?? "0")), 6);

export const toStr6 = (scaled: bigint): string =>
  fromScaledBigFixed(scaled, 6);
