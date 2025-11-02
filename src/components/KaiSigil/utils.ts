/* Generic util bundle (DOM-safe, JSON-safe, attrs flattening, etc.) */

export type JSONLike =
  | string
  | number
  | boolean
  | null
  | JSONLike[]
  | { [k: string]: JSONLike | undefined };
export type JSONDict = { [k: string]: JSONLike | undefined };

export const isPlainObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export const safeStringify = (v: unknown): string =>
  JSON.stringify(v, (_k, val) => {
    if (val instanceof Date) return (val as Date).toISOString();
    if (typeof val === "bigint") return (val as bigint).toString();
    return val as unknown;
  });

export const getStrField = (obj: unknown, key: string): string | undefined => {
  if (!isPlainObj(obj)) return undefined;
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
};

export const getNumField = (obj: unknown, key: string): number | undefined => {
  if (!isPlainObj(obj)) return undefined;
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
};

export const cdata = (s: string) => `<![CDATA[${s}]]>`;

const toIsoIfDate = (v: unknown): string =>
  v instanceof Date ? v.toISOString() : String(v);

export type DataAttrs = Record<`data-${string}`, string | number | undefined>;

export function flattenAsDataAttrs(
  root: string,
  obj: Record<string, unknown>,
  maxDepth = 6
): DataAttrs {
  const out: DataAttrs = {};
  const setKV = (k: string, v: string | number | undefined) => {
    out[`data-${k}` as `data-${string}`] = v;
  };
  const walk = (prefix: string, value: unknown, depth: number) => {
    if (depth > maxDepth) return;
    if (Array.isArray(value)) {
      setKV(prefix, JSON.stringify(value.map((x) => (x instanceof Date ? x.toISOString() : x))));
      return;
    }
    if (isPlainObj(value)) {
      for (const [k, v] of Object.entries(value)) {
        const key = k.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
        walk(`${prefix}-${key}`, v, depth + 1);
      }
      return;
    }
    if (
      typeof value === "number" ||
      typeof value === "string" ||
      value === undefined ||
      value === "null" ||
      value === null
    ) {
      setKV(prefix, value === null ? undefined : typeof value === "number" ? value : toIsoIfDate(value));
    } else {
      setKV(prefix, toIsoIfDate(value));
    }
  };
  for (const [k, v] of Object.entries(obj)) {
    const key = `${root}-${k.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase()}`;
    walk(key, v, 1);
  }
  return out;
}

/* small cleaners */
export const clean = (s?: string, max = 220) =>
  s ? s.replace(/\s+/g, " ").trim().slice(0, max) : undefined;

/* coercers */
export const coerceInt = (v: unknown, fallback = Number.NaN) =>
  typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : fallback;

export const coercePct = (v: unknown, fallback = Number.NaN) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1 - Number.EPSILON, v)) : fallback;

/* base64 utf8 (browser) */
export function b64Utf8(s: string): string {
  if (typeof window === "undefined" || typeof window.btoa !== "function") {
    throw new Error("Base64 encoding unavailable in this environment");
  }
  return window.btoa(
    encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (_m, h) =>
      String.fromCharCode(parseInt(h, 16))
    )
  );
}