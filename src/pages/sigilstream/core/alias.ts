// src/sigilstream/core/alias.ts
// Resolve PSHORT + canonical/short bases, and handle /p~ & legacy short aliases.
//
// Public API:
//   export const PSHORT: string
//   export function shortBase(): URL
//   export function canonicalBase(): URL
//   export function isLikelySigilUrl(u: string): boolean
//   export function expandShortAliasToCanonical(hrefLike: string): string
//   export function normalizeAddParam(s: string): string
//   export function buildStreamUrl(token: string): string
//   export function currentPayloadUrl(): string | null

import { report, isUrl } from "./utils";

/** Minimal env shape for Vite-style import.meta.env reads (SSR-safe). */
type ImportMetaEnvLike = { env?: Record<string, string | undefined> };

declare global {
  interface Window {
    /** Optional global override for the short host base, e.g. "https://k.ai" */
    __PSHORT__?: string;
  }
}

/** Preferred short-host base (from global, then env VITE_PSHORT). Empty if none. */
export const PSHORT: string = (() => {
  try {
    const fromGlobal =
      typeof window !== "undefined" ? window.__PSHORT__ : undefined;
    const fromEnv =
      typeof import.meta !== "undefined"
        ? (import.meta as unknown as ImportMetaEnvLike).env?.VITE_PSHORT
        : undefined;
    const pick = (fromGlobal?.trim() || fromEnv?.trim() || "").replace(
      /\s+/g,
      "",
    );
    return pick;
  } catch (e) {
    report("Resolve PSHORT", e);
    return "";
  }
})();

/** Base URL used for expanding short links (prefers PSHORT origin). */
export function shortBase(): URL {
  try {
    if (PSHORT) return new URL("/", PSHORT);
  } catch (e) {
    report("Invalid PSHORT", e);
  }
  // Fallback to current location (SSR-safe default)
  const href =
    typeof window !== "undefined" ? window.location.href : "https://example.com";
  return new URL("/", href);
}

/** Canonical app base (same origin as current app). */
export function canonicalBase(): URL {
  const href =
    typeof window !== "undefined" ? window.location.href : "https://example.com";
  return new URL("/", href);
}

/** Quick classifier for links that look like Sigil/Kai payload links. */
export function isLikelySigilUrl(u: string): boolean {
  try {
    const url = new URL(u);
    if (!(url.protocol === "https:" || url.protocol === "http:")) return false;

    const p = url.pathname;
    // Canonical stream path or preferred short alias /p~<token>
    if (p.startsWith("/stream/p/")) return true;
    if (p.startsWith("/p~") && p.length > 3) return true;

    // Legacy short alias /p with #t= or ?t=
    if (p === "/p") {
      const hasHashT = url.hash.includes("t=");
      const hasQueryT = url.searchParams.has("t");
      return hasHashT || hasQueryT;
    }

    // Very old style ?p=token
    return url.search.includes("p=");
  } catch {
    return false;
  }
}

/**
 * Expand any short alias into the canonical form:
 *   /p~<token>        →  /stream/p/<token>[?add=...]
 *   /p#t=<token>      →  /stream/p/<token>[?add=...]
 *   /p?t=<token>      →  /stream/p/<token>[?add=...]
 * Preserves/normalizes ?add= by recursively expanding if it's a short alias.
 */
export function expandShortAliasToCanonical(hrefLike: string): string {
  try {
    const base = shortBase();
    const u = new URL(hrefLike, base);
    const dest = canonicalBase();

    // Preferred alias: /p~<token>
    if (u.pathname.startsWith("/p~") && u.pathname.length > 3) {
      const token = u.pathname.slice(3); // after "/p~"
      dest.pathname = `/stream/p/${token}`;
      // Carry add if present (from query or hash)
      const add =
        u.searchParams.get("add") ||
        (u.hash.startsWith("#add=")
          ? new URLSearchParams(u.hash.slice(1)).get("add")
          : null);
      if (add) dest.searchParams.set("add", normalizeAddParam(add));
      return dest.toString();
    }

    // Legacy alias: /p with #t= or ?t=
    if (u.pathname === "/p") {
      const hash = u.hash.startsWith("#") ? u.hash.slice(1) : u.hash;
      const qpHash = new URLSearchParams(hash);
      const tHash = qpHash.get("t");
      const tQuery = u.searchParams.get("t");
      const token = tHash || tQuery;
      if (!token) return hrefLike;

      dest.pathname = `/stream/p/${token}`;

      const addHash = qpHash.get("add");
      const addQuery = u.searchParams.get("add");
      const add = addHash || addQuery;
      if (add) dest.searchParams.set("add", normalizeAddParam(add));
      return dest.toString();
    }

    // Already canonical or a normal link
    return hrefLike;
  } catch (e) {
    report("expandShortAliasToCanonical", e);
    return hrefLike;
  }
}

/**
 * Normalize an ?add= value:
 * - If it’s a short alias (/p~..., /p#t=..., /p?t=...), expand to canonical.
 * - If it’s a full URL on a different origin but uses /p or /p~, expand.
 * - Otherwise return as-is.
 */
export function normalizeAddParam(s: string): string {
  const v = s.trim();
  if (!v) return v;
  try {
    // Preferred /p~<token>
    if (v.startsWith("/p~")) {
      const full = `${shortBase().origin}${v}`;
      return expandShortAliasToCanonical(full);
    }
    // Legacy /p#t=..., #t=..., or /p?t=...
    if (v.startsWith("/p#t=") || v.startsWith("#t=") || v.includes("/p?t=")) {
      const full = v.startsWith("#t=")
        ? `${shortBase().origin}/p${v}`
        : v.startsWith("/p")
        ? `${shortBase().origin}${v}`
        : v;
      return expandShortAliasToCanonical(full);
    }
    // Full URL: expand if it’s a short alias path on any origin
    if (isUrl(v)) {
      const u = new URL(v);
      if (u.pathname === "/p" || u.pathname.startsWith("/p~")) {
        return expandShortAliasToCanonical(v);
      }
      return v;
    }
    return v;
  } catch (e) {
    report("normalizeAddParam", e);
    return v;
  }
}

/** Build a canonical stream URL for a token. */
export function buildStreamUrl(token: string): string {
  const base = canonicalBase();
  base.pathname = `/stream/p/${token}`.replace(/\/{2,}/g, "/");
  base.search = "";
  base.hash = "";
  return base.toString();
}

/** If current page is /stream/p/<token>, return that canonical URL; else null. */
export function currentPayloadUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const m = window.location.pathname.match(/\/stream\/p\/([^/?#]+)/);
    if (!m) return null;
    const token = m[1];
    return buildStreamUrl(token);
  } catch (e) {
    report("currentPayloadUrl", e);
    return null;
  }
}
