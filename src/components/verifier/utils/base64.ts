// src/components/verifier/utils/base64.ts
/* ────────────────────────────────────────────────────────────────
   base64.ts
   • UTF-8 <-> base64 helpers without using "any"
   • Browser-safe guards w/ TextEncoder/TextDecoder
────────────────────────────────────────────────────────────────── */

import { logError } from "./log";

export function base64EncodeUtf8(str: string): string {
  try {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 1) {
      bin += String.fromCharCode(bytes[i]);
    }
    if (typeof btoa === "function") return btoa(bin);
  } catch (err) {
    logError("base64EncodeUtf8", err);
  }
  return "";
}

export function base64DecodeUtf8(b64: string): string {
  try {
    if (typeof atob !== "function") {
      throw new Error("atob is not available in this environment");
    }
    const bin: string = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) {
      bytes[i] = bin.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (err) {
    logError("base64DecodeUtf8", err);
    return "";
  }
}
