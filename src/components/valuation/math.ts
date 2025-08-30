// src/components/valuation/math.ts
import type { SigilMetadataLite } from "../../utils/valuation";

export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function linreg(y: number[]): { slope: number; r2: number } {
  const n = y.length;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sx += i; sy += y[i]; sxy += i * y[i]; sxx += i * i;
  }
  const denom = n * sxx - sx * sx || 1;
  const slope = (n * sxy - sx * sy) / denom;
  const mean = sy / n;
  let ssTot = 0, ssRes = 0;
  const intercept = mean - slope * ((n - 1) / 2);
  for (let i = 0; i < n; i++) {
    const fi = slope * i + intercept;
    ssTot += (y[i] - mean) ** 2;
    ssRes += (y[i] - fi) ** 2;
  }
  const r2 = 1 - ssRes / (ssTot || 1);
  return { slope, r2 };
}

export function seedFrom(meta: SigilMetadataLite, nowPulse: number): number {
  const base = `${meta.pulse ?? 0}|${meta.beat ?? 0}|${meta.stepIndex ?? 0}|${nowPulse}`;
  let h = 2166136261;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
