// src/utils/sigilRegistry.ts
/* ─────────────────────────────────────────────────────────────
   sigilRegistry.ts — Shared bridge into the Sigil Explorer
   - Single entrypoint for “a sigil/stream URL was just created”
   - Canonical storage in localStorage (with legacy fallback key)
   - BroadcastChannel for cross-tab sync
   - DOM CustomEvent("sigil:url-registered") for same-tab listeners
   - Optional global hook: window.__SIGIL__.registerSigilUrl
   - SSR-safe: everything is guarded behind window checks
   ───────────────────────────────────────────────────────────── */

export type SigilRegistryGlobal = {
  registerSigilUrl?: (url: string) => void;
};

/** Canonical localStorage key for the sigil registry. */
export const SIGIL_REGISTRY_LS_KEY = "kai:sigils:v1" as const;

/** Legacy/fallback key for older code paths (kept in sync). */
export const SIGIL_REGISTRY_FALLBACK_LS_KEY = "sigil:urls" as const;

/** BroadcastChannel name for cross-tab notifications. */
export const SIGIL_REGISTRY_CHANNEL_NAME = "kai-sigil-registry" as const;

const hasWindow = typeof window !== "undefined";

/* ───────── Internal helpers ───────── */

function getSigilGlobalBag(): SigilRegistryGlobal {
  if (!hasWindow) return {};
  const w = window as unknown as { __SIGIL__?: SigilRegistryGlobal };
  if (!w.__SIGIL__) w.__SIGIL__ = {};
  return w.__SIGIL__!;
}

/** Read a JSON string[] list from localStorage under the given key. */
function readList(key: string): string[] {
  if (!hasWindow) return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed.filter((x) => typeof x === "string") as string[]).map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/** Write a JSON string[] list to localStorage under the given key. */
function writeList(key: string, list: string[]): void {
  if (!hasWindow) return;
  try {
    const unique = Array.from(new Set(list.map((s) => s.trim()).filter(Boolean)));
    window.localStorage.setItem(key, JSON.stringify(unique));
  } catch {
    // ignore LS errors (e.g. quota, private mode)
  }
}

/** Add a URL to a list if it's not already present. Returns true if inserted. */
function pushUnique(list: string[], url: string): boolean {
  if (list.includes(url)) return false;
  list.push(url);
  return true;
}

/** Canonicalize to an absolute URL when possible. */
function canonicalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (!hasWindow) return trimmed;

  try {
    const u = new URL(trimmed, window.location.origin);
    return u.toString();
  } catch {
    // If URL constructor fails (e.g. custom schemes), fall back to raw
    return trimmed;
  }
}

/** Lazy BroadcastChannel (shared instance). */
let _bc: BroadcastChannel | null = null;
function getBroadcastChannel(): BroadcastChannel | null {
  if (!hasWindow) return null;
  if (!("BroadcastChannel" in window)) return null;
  if (_bc) return _bc;
  _bc = new BroadcastChannel(SIGIL_REGISTRY_CHANNEL_NAME);
  return _bc;
}

/* ───────── Core API: registerSigilUrl / registerSigilUrls ───────── */

/**
 * Main bridge: call this whenever you mint/exhale a sigil or stream URL.
 *
 * Responsibilities:
 *  1. Normalize to an absolute, canonical URL.
 *  2. Append to canonical localStorage list (kai:sigils:v1).
 *  3. Mirror into legacy/fallback list (sigil:urls).
 *  4. Fire a DOM CustomEvent("sigil:url-registered", { detail: { url } }).
 *  5. Broadcast to other tabs via BroadcastChannel("kai-sigil-registry").
 *  6. Expose itself on window.__SIGIL__.registerSigilUrl for old callers.
 *
 * All steps are best-effort and silently ignored on failure.
 */
export function registerSigilUrl(url: string): void {
  if (!hasWindow) return;
  const abs = canonicalizeUrl(url);
  if (!abs) return;

  // 1) Append to canonical list
  const canon = readList(SIGIL_REGISTRY_LS_KEY);
  const changedCanon = pushUnique(canon, abs);
  if (changedCanon) {
    writeList(SIGIL_REGISTRY_LS_KEY, canon);
  }

  // 2) Mirror into fallback list for older code paths
  const fallback = readList(SIGIL_REGISTRY_FALLBACK_LS_KEY);
  const changedFallback = pushUnique(fallback, abs);
  if (changedFallback) {
    writeList(SIGIL_REGISTRY_FALLBACK_LS_KEY, fallback);
  }

  // 3) DOM event for same-tab listeners
  try {
    const evt = new CustomEvent<{ url: string }>("sigil:url-registered", {
      detail: { url: abs },
    });
    window.dispatchEvent(evt);
  } catch {
    /* ignore event errors */
  }

  // 4) BroadcastChannel for cross-tab listeners
  try {
    const bc = getBroadcastChannel();
    bc?.postMessage({ type: "sigil:add", url: abs });
  } catch {
    /* ignore broadcast errors */
  }

  // 5) Ensure window.__SIGIL__.registerSigilUrl points to this function
  try {
    const bag = getSigilGlobalBag();
    if (bag.registerSigilUrl !== registerSigilUrl) {
      bag.registerSigilUrl = registerSigilUrl;
    }
  } catch {
    /* ignore */
  }
}

/**
 * Convenience helper for bulk registration.
 * Loops through the array and calls registerSigilUrl for each.
 */
export function registerSigilUrls(urls: string[]): void {
  for (const u of urls) {
    if (typeof u === "string" && u.trim()) {
      registerSigilUrl(u);
    }
  }
}

/* Back-compat export names (old callers can keep using them) */
export function registerSigilUrlForExplorer(url: string): void {
  registerSigilUrl(url);
}

export function registerSigilUrlsForExplorer(urls: string[]): void {
  registerSigilUrls(urls);
}

/* ───────── Query helpers: getRegisteredSigilUrls ───────── */

/**
 * Returns the current merged registry:
 *  - Reads both canonical and fallback LS keys
 *  - Normalizes to absolute URLs
 *  - De-dupes preserving insertion order (canonical first, then fallback)
 */
export function getRegisteredSigilUrls(): string[] {
  if (!hasWindow) return [];
  const primary = readList(SIGIL_REGISTRY_LS_KEY);
  const fallback = readList(SIGIL_REGISTRY_FALLBACK_LS_KEY);

  const out: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    const abs = canonicalizeUrl(raw);
    if (!abs) return;
    if (seen.has(abs)) return;
    seen.add(abs);
    out.push(abs);
  };

  for (const u of primary) push(u);
  for (const u of fallback) push(u);

  return out;
}

/* ───────── Subscription helpers: subscribeSigilRegistry ───────── */

export type SigilRegistrySource = "event" | "storage" | "broadcast";

/**
 * Subscribe to sigil registry updates.
 *
 * Fires handler(url, source) on:
 *  - CustomEvent "sigil:url-registered" (same tab)      => source = "event"
 *  - BroadcastChannel "kai-sigil-registry" messages    => source = "broadcast"
 *  - "storage" events for registry LS keys (other tab) => source = "storage"
 *
 * Returns an unsubscribe function.
 */
export function subscribeSigilRegistry(
  handler: (url: string, source: SigilRegistrySource) => void,
): () => void {
  if (!hasWindow) return () => {};

  // 1) Same-tab CustomEvent
  const onEvent = (e: Event) => {
    const ce = e as CustomEvent<{ url?: string }>;
    const u = ce?.detail?.url;
    if (typeof u === "string" && u.trim()) {
      const abs = canonicalizeUrl(u);
      if (abs) handler(abs, "event");
    }
  };

  // 2) BroadcastChannel
  const bc = getBroadcastChannel();
  const onMsg = (ev: MessageEvent) => {
    const data = ev?.data as { type?: string; url?: string } | undefined;
    if (!data || data.type !== "sigil:add") return;
    if (typeof data.url === "string" && data.url.trim()) {
      const abs = canonicalizeUrl(data.url);
      if (abs) handler(abs, "broadcast");
    }
  };

  // 3) storage events (other tabs mutating LS)
  const onStorage = (ev: StorageEvent) => {
    if (!ev.key) return;
    if (
      ev.key !== SIGIL_REGISTRY_LS_KEY &&
      ev.key !== SIGIL_REGISTRY_FALLBACK_LS_KEY
    ) {
      return;
    }
    if (typeof ev.newValue !== "string") return;
    try {
      const arr = JSON.parse(ev.newValue) as unknown;
      if (!Array.isArray(arr)) return;
      for (const u of arr) {
        if (typeof u !== "string" || !u.trim()) continue;
        const abs = canonicalizeUrl(u);
        if (abs) handler(abs, "storage");
      }
    } catch {
      /* ignore parse errors */
    }
  };

  window.addEventListener("sigil:url-registered", onEvent as EventListener);
  if (bc) bc.addEventListener("message", onMsg as EventListener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener("sigil:url-registered", onEvent as EventListener);
    if (bc) bc.removeEventListener("message", onMsg as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}

/* ───────── Ensure global hook is wired once on module load ───────── */

if (hasWindow) {
  try {
    const bag = getSigilGlobalBag();
    if (bag.registerSigilUrl !== registerSigilUrl) {
      bag.registerSigilUrl = registerSigilUrl;
    }
  } catch {
    /* ignore */
  }
}
