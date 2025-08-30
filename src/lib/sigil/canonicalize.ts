/**
 * Canonical JSON utilities for Sigil payloads.
 *
 * Rules:
 * - Objects: keys sorted lexicographically (ASCII), stable recursion
 * - Arrays: keep order
 * - `undefined` keys are DROPPED (not serialized)
 * - Dates: serialized to ISO 8601 strings
 * - Numbers: JSON default (NaN/Infinity → null)
 * - Strings: UTF-8, no trailing whitespace added
 *
 * Output:
 * - `canonicalString` returns the stable JSON string
 * - `canonicalize` returns UTF-8 bytes (Uint8Array) of that string
 */

export type JSONLike =
  | null
  | boolean
  | number
  | string
  | Date
  | JSONLike[]
  | { [k: string]: JSONLike | undefined };

/** Canonical JSON value after normalization (no Dates, no undefined). */
export type Canonical =
  | null
  | boolean
  | number
  | string
  | Canonical[]
  | { [k: string]: Canonical };

/** Convert JS value to a strictly canonical JSON-serializable structure. */
function normalize(value: JSONLike): Canonical {
  // Dates → ISO strings
  if (value instanceof Date) return value.toISOString();

  // Primitives
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    // JSON.stringify would produce null for NaN/Infinity; keep parity
    return Number.isFinite(value) ? value : null;
  }

  // Arrays: preserve order and normalize each element
  if (Array.isArray(value)) {
    const arr = value as JSONLike[];
    return arr.map((v) => normalize(v));
  }

  // Objects: drop undefined, sort keys
  // (value is object but not null and not array due to branches above)
  const rec = value as { [k: string]: JSONLike | undefined };
  const out: { [k: string]: Canonical } = {};
  const keys = Object.keys(rec).sort();
  for (const k of keys) {
    const v = rec[k];
    if (v !== undefined) out[k] = normalize(v);
  }
  return out;
}

/** Produce the canonical JSON string (stable key order, trimmed). */
export function canonicalString(value: JSONLike): string {
  const normalized = normalize(value);
  // No prettifying; no trailing spaces; stable output
  return JSON.stringify(normalized);
}

/** UTF-8 encode the canonical JSON string as bytes. */
export function canonicalize(value: JSONLike): Uint8Array {
  const enc = new TextEncoder();
  return enc.encode(canonicalString(value));
}
