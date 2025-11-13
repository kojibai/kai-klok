// src/pages/sigilstream/identity/SigilActionUrl.tsx
"use client";

import type React from "react";
import { readStringProp, isRecord } from "../core/utils";
import { isLikelySigilUrl } from "../core/alias";

type Props = {
  /** Parsed sigil metadata object (or null if none available) */
  meta: Record<string, unknown> | null;
  /** Raw SVG text for fallback URL extraction (or null) */
  svgText: string | null;
};

type ReturnShape = {
  /** The best-effort URL string we found ("" if none) */
  value: string;
  /** True iff `value` already looks like a canonical/short sigil link we accept */
  isCanonical: boolean;
  /** Ready-to-render UI block (readonly input + warning if needed) */
  node: React.JSX.Element;
};

/** Pick the first useful URL-ish field out of sigil metadata. */
function extractFromMeta(meta: Record<string, unknown> | null): string {
  if (!meta || !isRecord(meta)) return "";
  // Priority order (most specific first)
  const keys = [
    "sigilActionUrl",
    "sigilUrl",
    "actionUrl",
    "claimedUrl",
    "loginUrl",
    "sourceUrl",
    "originUrl",
    "url",
    "link",
    "href",
  ];
  for (const k of keys) {
    const v = readStringProp(meta, k);
    if (typeof v === "string" && v.trim().length) return v.trim();
  }
  return "";
}

/** Fallback URL scrape from raw SVG text (first http/https absolute URL). */
function extractFromSvg(svgText: string | null): string {
  if (!svgText) return "";
  try {
    const m = svgText.match(/https?:\/\/[^\s"'<>)#]+/i);
    return m?.[0] ?? "";
  } catch {
    return "";
  }
}

/**
 * SigilActionUrl — extracts a canonical sigil/action URL and returns both the value
 * and a prebuilt UI node. Consumers can either use `.node` directly or read `.value`
 * and `.isCanonical` for custom layouts.
 */
export function SigilActionUrl({ meta, svgText }: Props): ReturnShape {
  const candidate = extractFromMeta(meta) || extractFromSvg(svgText) || "";
  const value = candidate;
  const isCanonical = value.length > 0 && isLikelySigilUrl(value);

  const node = value ? (
    <div className="sf-reply-row">
      <label className="sf-label">
        Sigil Verifikation <span className="sf-muted">(URL)</span>
      </label>
      <input className="sf-input sf-input--locked" type="url" value={value} readOnly />
      {!isCanonical && (
        <div className="sf-warn" role="status">
          No canonical sigil link found; a fallback will be used.
        </div>
      )}
    </div>
  ) : (
    <div className="sf-warn" role="status">
      No sigil verifikation URL detected; a fallback will be used.
    </div>
  );

  return { value, isCanonical, node };
}

export default SigilActionUrl;
