// src/components/exhale-note/bridge.ts
// ─────────────────────────────────────────────────────────────────────────────
// Verifier auto-hydration bridge (strict, no any)
// Tries, in order:
//   1) Direct window.KKVerifier.getNoteData() (sync or async)
//   2) Event roundtrip: dispatch "kk:request-note-data", await "kk:note-data"
//   3) URL param ?data=<base64(json)>
//   4) LocalStorage cache ("kk:lastVerifierPayload")
// On any successful retrieval, caches to localStorage for resilience.
// ─────────────────────────────────────────────────────────────────────────────

import type { BanknoteInputs, VerifierBridge } from "./types";

export const VERIFIER_PAYLOAD_CACHE_KEY = "kk:lastVerifierPayload";

declare global {
  interface Window {
    KKVerifier?: VerifierBridge;
  }
}

/** Narrow check to avoid accepting arrays or null as payload objects. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Base64 (also handles URL-safe) → string. */
function decodeBase64ToString(b64: string): string {
  // Convert URL-safe to standard and pad
  let s = b64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad === 2) s += "==";
  else if (pad === 3) s += "=";
  else if (pad !== 0) {
    // Non-standard length; let atob throw.
  }
  return atob(s);
}

/** Persist last good payload, best-effort. */
function cachePayload(payload: BanknoteInputs): void {
  try {
    localStorage.setItem(VERIFIER_PAYLOAD_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore storage errors */
  }
}

/** Read the cached payload, if any. */
function readCachedPayload(): BanknoteInputs | null {
  try {
    const raw = localStorage.getItem(VERIFIER_PAYLOAD_CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as unknown;
    return isPlainObject(obj) ? (obj as BanknoteInputs) : null;
  } catch {
    return null;
  }
}

/** Attempt to fetch via direct bridge if available. */
async function tryDirectBridge(): Promise<BanknoteInputs | null> {
  try {
    const v = window.KKVerifier;
    if (v && typeof v.getNoteData === "function") {
      const data = await v.getNoteData();
      if (isPlainObject(data)) {
        const payload = data as BanknoteInputs;
        cachePayload(payload);
        return payload;
      }
    }
  } catch {
    // swallow
  }
  return null;
}

/** Attempt a single request/response event roundtrip. */
async function tryEventRoundtrip(timeoutMs = 300): Promise<BanknoteInputs | null> {
  try {
    const received = await new Promise<BanknoteInputs | null>((resolve) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        resolve(null);
      }, timeoutMs);

      const handler = (e: Event): void => {
        cleanup();
        try {
          const ce = e as CustomEvent<BanknoteInputs>;
          const payload = ce.detail;
          if (isPlainObject(payload)) {
            cachePayload(payload);
            resolve(payload);
            return;
          }
        } catch {
          /* ignore */
        }
        resolve(null);
      };

      const cleanup = () => {
        window.removeEventListener("kk:note-data", handler as EventListener);
        window.clearTimeout(timeout);
      };

      window.addEventListener("kk:note-data", handler as EventListener, { once: true });
      // Signal to any verifier listening that we want the current payload.
      window.dispatchEvent(new CustomEvent("kk:request-note-data"));
    });

    return received;
  } catch {
    return null;
  }
}

/** Attempt to read ?data=<base64(json)> from the current URL. */
function tryUrlParam(): BanknoteInputs | null {
  try {
    const u = new URL(window.location.href);
    const encoded = u.searchParams.get("data");
    if (!encoded) return null;
    const json = decodeBase64ToString(encoded);
    const obj = JSON.parse(json) as unknown;
    if (isPlainObject(obj)) {
      const payload = obj as BanknoteInputs;
      cachePayload(payload);
      return payload;
    }
  } catch {
    // swallow
  }
  return null;
}

/**
 * Fetch initial Note data from the verifier, best-effort.
 * Returns `null` if nothing could be obtained.
 */
export async function fetchFromVerifierBridge(): Promise<BanknoteInputs | null> {
  if (typeof window === "undefined") return null;

  // 1) Direct bridge (sync/async)
  const direct = await tryDirectBridge();
  if (direct) return direct;

  // 2) Event-based bridge (request/response)
  const viaEvent = await tryEventRoundtrip();
  if (viaEvent) return viaEvent;

  // 3) URL param ?data=base64(json)
  const viaUrl = tryUrlParam();
  if (viaUrl) return viaUrl;

  // 4) LocalStorage cache
  const cached = readCachedPayload();
  if (cached) return cached;

  return null;
}

/** Re-export for ergonomics if consumers import from this module. */
export type { VerifierBridge };
