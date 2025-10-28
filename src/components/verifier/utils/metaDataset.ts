// src/components/verifier/utils/metaDataset.ts
/* ────────────────────────────────────────────────────────────────
   metaDataset.ts
   • Tiny DOM-aware helpers for pulling data-* attrs off the inline <svg>
   • Also small object path getters for optional nested valuation fields
────────────────────────────────────────────────────────────────── */

import type { SigilMetadataWithOptionals } from "../types/local";

export const isBrowser =
  typeof window !== "undefined" &&
  typeof document !== "undefined";

type Dict = Record<string, unknown>;

/** Safe deep path lookup: "valuationSource.frequencyHz" etc. */
export function getPath(
  obj: unknown,
  path: string
): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Dict)) {
      cur = (cur as Dict)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

/** Turn unknown -> ""/string for display */
export function toStr(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}

/** Try multiple paths; return first non-empty string */
export function getFirst(
  obj: unknown,
  paths: string[]
): string {
  for (const p of paths) {
    const v = getPath(obj, p);
    if (v !== undefined && v !== null && v !== "") {
      return toStr(v);
    }
  }
  return "";
}

/**
 * Read inline SVG dataset attributes.
 * We build an element id of the form `ks-${pulse}-${beat}-${stepIndex}`.
 */
export function fromSvgDataset(
  m: SigilMetadataWithOptionals,
  dashedAttr: string
): string {
  if (!isBrowser) return "";

  const pulse = toStr(getPath(m, "pulse"));
  const beat = toStr(getPath(m, "beat"));
  const stepIndex = toStr(getPath(m, "stepIndex"));

  const svgId =
    pulse && beat && stepIndex
      ? `ks-${pulse}-${beat}-${stepIndex}`
      : "";

  const el = svgId
    ? (document.getElementById(svgId) as
        | HTMLElement
        | null)
    : null;
  if (!el) return "";

  // convert "data-frequency-hz" to "frequencyHz"
  const camelKey = dashedAttr
    .replace(/^data-/, "")
    .replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());

  const ds =
    (el.dataset as Record<string, string | undefined>) || {};

  return (
    ds[camelKey] ??
    el.getAttribute(dashedAttr) ??
    ""
  );
}
