// src/pages/sigilstream/data/storage.ts
// LocalStorage helpers for the Memory Stream link list.

import { report } from "../core/utils";

export const LS_KEY = "sf-links";

/**
 * Safely parse a JSON string as string[], otherwise return [].
 */
export function parseStringArray(input: string | null): string[] {
  if (!input) return [];
  try {
    const parsed: unknown = JSON.parse(input);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
      return parsed as string[];
    }
    return [];
  } catch (e) {
    report("parseStringArray", e);
    return [];
  }
}

/**
 * Prepend unique URLs to the stored list (deduping against existing).
 * New items appear first, preserving the previous order for existing entries.
 */
export function prependUniqueToStorage(urls: string[]): void {
  try {
    if (typeof window === "undefined") return;
    const current = parseStringArray(localStorage.getItem(LS_KEY));

    // Filter inputs to non-empty strings
    const incoming = urls.filter((u) => typeof u === "string" && u.trim().length);
    if (incoming.length === 0) return;

    const seen = new Set(current);
    const fresh = incoming.filter((u) => !seen.has(u));
    if (fresh.length === 0) return;

    const next = [...fresh, ...current];
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch (e) {
    report("prependUniqueToStorage", e);
  }
}
