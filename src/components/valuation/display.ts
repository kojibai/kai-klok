// src/components/valuation/display.ts
export const currency = (n: number) => `Φ ${n.toFixed(6)}`;

export const fmtPct = (n?: number | null, digits = 3) =>
  typeof n === "number" ? `${(n * 100).toFixed(digits)}%` : "—";

export const fmt = (n?: number | null, digits = 3) =>
  typeof n === "number" ? n.toFixed(digits) : "—";

export const pctSigned = (x: number, d = 2) =>
  `${x >= 0 ? "+" : ""}${(x * 100).toFixed(d)}%`;

// For values already expressed in percent (e.g., sessionChangePct)
export const pct = (n: number, digits = 2) =>
  `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
