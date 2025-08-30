// src/pages/SigilPage/utils.ts
import { CHAKRA_THEME } from "../../components/sigil/theme";

/* Base-64 for small buffers */
export const b64 = (buf: ArrayBuffer) =>
  typeof window === "undefined"
    ? ""
    : window.btoa(String.fromCharCode(...new Uint8Array(buf)));

export function signal(setToast: (s: string) => void, msg: string) {
  setToast(msg);
  window.setTimeout(() => setToast(""), 1400);
}

export async function loadJSZip() {
  const mod = await import("jszip");
  return mod.default;
}

/* Tiny seeded RNG + deterministic seed */
export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seedFrom(seal: { computedAtPulse?: number; stamp?: string } | null, routeHash?: string) {
  const base = `${seal?.computedAtPulse ?? 0}|${routeHash ?? ""}|${seal?.stamp ?? ""}`;
  let h = 2166136261;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* Idle helpers (perf on mobile) */
type IdleDL = { didTimeout: boolean; timeRemaining: () => number };
type WindowIdle = Window & {
  requestIdleCallback?: (cb: (dl: IdleDL) => void, opts?: { timeout?: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};
export const requestIdle = (cb: (dl: IdleDL) => void, timeout = 600): number => {
  const w = window as unknown as WindowIdle;
  if (typeof w.requestIdleCallback === "function") {
    return w.requestIdleCallback(cb, { timeout });
  }
  return window.setTimeout(() => cb({ didTimeout: true, timeRemaining: () => 0 }), 90);
};
export const cancelIdle = (id: number): void => {
  const w = window as unknown as WindowIdle;
  if (typeof w.cancelIdleCallback === "function") w.cancelIdleCallback(id);
  else window.clearTimeout(id);
};

/* Generic SHA-256 → hex (async) */
export const sha256Hex = async (text: string) => {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/* Moment-accurate badge color */
function hslCss(h: number, s: number, l: number) {
  return `hsl(${h} ${s}% ${l}%)`;
}
function hashNibbleMod12(hex?: string) {
  if (!hex) return 0;
  const n = parseInt(hex.slice(-2), 16);
  return Number.isFinite(n) ? n % 12 : 0;
}
export function momentBadgeColor(
  chakraDay: keyof typeof CHAKRA_THEME,
  stepPct: number,
  payloadHashHex?: string | null
) {
  const baseHue = (CHAKRA_THEME[chakraDay]?.hue ?? 180) as number;
  const nibble = hashNibbleMod12(payloadHashHex || undefined);
  const hue = (baseHue + nibble * 2.5) % 360;
  const light = 50 + 15 * Math.sin(stepPct * 2 * Math.PI);
  return hslCss(hue, 100, light);
}

/* Currency (unchanged: no Φ prefix) */
export const currency = (n: number) => n.toFixed(6);
/** Ensure history/hash strings use the "h:" prefix (local-only helper). */
export function ensureHPrefixLocal(hRaw: string): string {
  const s = String(hRaw || "");
  return s.startsWith("h:") ? s : `h:${s}`;
}
