// src/sigilstream/core/utils.ts
// Shared utilities: formatting, bigint math, guards, safe URL checks, auth coercion

/** Left-pad to 2 digits */
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** BigInt modulo that’s always non-negative (like Python %). */
export function imod(n: bigint, m: bigint): bigint {
  const r = n % m;
  return r < 0n ? r + (m < 0n ? -m : m) : r;
}

/** BigInt floor division (handles negatives correctly). */
export function floorDiv(n: bigint, d: bigint): bigint {
  const q = n / d;
  const r = n % d;
  return r !== 0n && (r > 0n) !== (d > 0n) ? q - 1n : q;
}

/**
 * Bankers’ rounding (ties-to-even) to BigInt.
 * - Non-finite → 0n
 * - Preserves sign for halves.
 */
export function roundTiesToEvenBigInt(x: number): bigint {
  if (!Number.isFinite(x)) return 0n;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const i = Math.trunc(ax);
  const frac = ax - i;
  if (frac < 0.5) return BigInt(sign * i);
  if (frac > 0.5) return BigInt(sign * (i + 1));
  // exactly .5 → round to even
  return BigInt(sign * (i % 2 === 0 ? i : i + 1));
}

/** Soft logging helper (never throws). */
export function report(where: string, err: unknown): void {
  try {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.warn(`[SigilStream:${where}] ${msg}`);
  } catch {
    /* ignore */
  }
}

/** Narrow unknown → object record */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** True for http(s) URLs only. */
export function isUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Safely read a string property either directly on the object
 * or within a nested `meta` record.
 */
export function readStringProp(
  obj: unknown,
  key: string,
): string | undefined {
  if (!isRecord(obj)) return undefined;

  const direct = obj[key];
  if (typeof direct === "string") return direct;

  const meta = obj["meta"];
  if (isRecord(meta)) {
    const mv = meta[key];
    if (typeof mv === "string") return mv;
  }
  return undefined;
}

/** Shape extracted from any auth-like structures. */
export type AuthLike = {
  meta: Record<string, unknown> | null;
  svgText: string | null;
};

/**
 * Coerce various auth shapes into { meta, svgText }.
 * Accepts:
 *  - raw { meta?, svgText? }
 *  - wrapper { auth: { meta?, svgText? } }
 */
export function coerceAuth(input: unknown): AuthLike {
  let candidate: unknown = input;

  if (isRecord(candidate) && "auth" in candidate) {
    candidate = (candidate as { auth?: unknown }).auth;
  }

  if (isRecord(candidate)) {
    const meta = candidate["meta"];
    const svgText = candidate["svgText"];
    return {
      meta: isRecord(meta) ? (meta as Record<string, unknown>) : null,
      svgText: typeof svgText === "string" ? svgText : null,
    };
  }
  return { meta: null, svgText: null };
}
