/**
 * Base64 + gzip helpers, with browser/Node compatibility.
 *
 * - Base64: uses btoa/atob in browsers, Buffer in Node.
 * - Gzip: uses pako's gzip/ungzip (sync) for deterministic behavior across envs.
 *
 * NOTE: Sigil spec uses gzip+base64 for payload encoding.
 */

import { gzip as pakoGzip, ungzip as pakoUngzip } from "pako";

/**
 * Base64-encode a Uint8Array into a string.
 */
export function toBase64(u8: Uint8Array): string {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    let s = "";
    for (let i = 0; i < u8.length; i++) {
      s += String.fromCharCode(u8[i]);
    }
    return window.btoa(s);
  }
  // Node/SSR fallback
  return Buffer.from(u8).toString("base64");
}

/**
 * Decode a base64 string into a Uint8Array.
 */
export function fromBase64(b64: string): Uint8Array {
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    const bin = window.atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  }
  // Node/SSR fallback
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/**
 * gzip (RFC 1952) compress a byte array and return a base64 string.
 * Sync and deterministic across environments.
 */
export function gzipB64(bytes: Uint8Array): string {
  const gz: Uint8Array = pakoGzip(bytes);
  return toBase64(gz);
}

/**
 * gunzip: decode a base64 string of gzip-compressed bytes back to the original bytes.
 */
export function gunzipB64(b64: string): Uint8Array {
  const gz = fromBase64(b64);
  return pakoUngzip(gz);
}
