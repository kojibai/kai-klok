// src/pages/sigilstream/data/seed.ts
// Loads initial link seeds from /links.json with strict validation.

import { report, isRecord } from "../core/utils";

export type Source = { url: string };

/**
 * Load seed links from /links.json (no-cache). Returns [] on any error.
 * The expected shape is: Array<{ url: string }>
 */
export async function loadLinksJson(): Promise<Source[]> {
  try {
    const res = await fetch("/links.json", { cache: "no-store" });
    if (!res.ok) return [];
    const data: unknown = await res.json();

    if (!Array.isArray(data)) return [];

    const rows: Source[] = [];
    for (const row of data) {
      if (isRecord(row) && typeof row.url === "string" && row.url.trim().length) {
        rows.push({ url: row.url });
      }
    }
    return rows;
  } catch (e) {
    report("loadLinksJson", e);
    return [];
  }
}
