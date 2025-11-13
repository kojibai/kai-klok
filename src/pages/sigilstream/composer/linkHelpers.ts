// src/pages/sigilstream/composer/linkHelpers.ts
import { isUrl } from "../core/utils";
import type { AttachmentUrl } from "../attachments/types";

/** Normalize a user-entered string to a full https URL or return null if invalid. */
export function normalizeWebLink(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  // Accept custom schemes (will be handled elsewhere if needed)
  if (/^(kai|sigil):\/\//i.test(s)) {
    return s.replace(/^(kai|sigil):\/\//i, "https://");
  }

  try {
    if (isUrl(s)) return s;
    // Accept bare domains (example.com, sub.domain.tld/path)
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(s)) return `https://${s}`;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Add a normalized link to the list if it's not present.
 * Returns the next list, plus an "added" echo or error text.
 */
export function addLinkItem(
  items: AttachmentUrl[],
  normalizedUrl: string,
): { next: AttachmentUrl[]; added?: AttachmentUrl; error?: string } {
  if (!normalizedUrl) {
    return { next: items, error: "Missing URL." };
  }
  if (items.some((u) => u.url === normalizedUrl)) {
    return { next: items, error: "Link already added." };
  }
  const added: AttachmentUrl = { kind: "url", url: normalizedUrl };
  return { next: [...items, added], added };
}

/** Remove the item at an index (no-op if idx out of range). */
export function removeLinkItem(
  items: AttachmentUrl[],
  idx: number,
): AttachmentUrl[] {
  if (idx < 0 || idx >= items.length) return items;
  return [...items.slice(0, idx), ...items.slice(idx + 1)];
}
