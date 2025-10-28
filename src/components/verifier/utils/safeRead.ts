// src/components/verifier/utils/safeRead.ts
/* ────────────────────────────────────────────────────────────────
   safeRead.ts
   • Safe getters for nested metadata fields
   • Strongly typed fallbacks, zero "any"
────────────────────────────────────────────────────────────────── */

export function readStrObj(o: unknown, k: string, fb = ""): string {
  if (typeof o === "object" && o !== null) {
    const v = (o as Record<string, unknown>)[k];
    if (typeof v === "string") return v;
  }
  return fb;
}

export function readNumObj(
  o: unknown,
  k: string
): number | undefined {
  if (typeof o === "object" && o !== null) {
    const v = (o as Record<string, unknown>)[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}
