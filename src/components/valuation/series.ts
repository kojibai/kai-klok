// src/components/valuation/series.ts
import type { SigilMetadataLite, ValueSeal } from "../../utils/valuation";
import { mulberry32, seedFrom, linreg } from "./math";

export type ChartPoint = { i: number; value: number; premium: number };
export type ChartBundle = {
  sparkData: Array<{ i: number; value: number }>;
  lineData: Array<ChartPoint>;
  stats: { slope: number; r2: number; change: number; vol: number };
};

export function bootstrapSeries(
  seal: ValueSeal,
  meta: SigilMetadataLite,
  nowPulse: number,
  N = 64
): ChartBundle {
  const seed = seedFrom(meta, nowPulse);
  const rnd = mulberry32(seed);
  const target = seal.valuePhi;
  const start = target * 0.78;

  const arr: number[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const drift = start + (target - start) * Math.pow(t, 1.2);
    const noise = (rnd() - 0.5) * 0.03 * target; // ±3%
    arr.push(Math.max(0, drift + noise));
  }
  arr[arr.length - 1] = target;

  const sparkData = arr.map((v, i) => ({ i, value: v }));
  const lineData = arr.map((v, i) => ({
    i,
    value: v,
    premium: v * (0.92 + 0.16 * (i / (N - 1))),
  }));

  const { slope, r2 } = linreg(arr);
  const change = ((arr[arr.length - 1] - arr[0]) / (arr[0] || 1)) * 100;
  const vol =
    arr.reduce((a, _, k) => (k ? a + Math.abs(arr[k] - arr[k - 1]) : 0), 0) /
    (arr.length - 1 || 1);

  return { sparkData, lineData, stats: { slope, r2, change, vol } };
}
