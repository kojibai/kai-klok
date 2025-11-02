// src/components/KaiSigil/helpers.ts
import type { KaiSigilProps, WeekdayName } from "./types";
import {
  flattenAsDataAttrs,
  getNumField,
  getStrField,
  isPlainObj,
  safeStringify,
} from "./utils";
import { hsl } from "./constants";

export const WEEKDAYS = [
  "Solhara",
  "Aquaris",
  "Flamora",
  "Verdari",
  "Sonari",
  "Kaelith",
] as const;

export const isWeekdayName = (v: unknown): v is WeekdayName =>
  typeof v === "string" && (WEEKDAYS as readonly string[]).includes(v);

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export const qMap = (q: KaiSigilProps["quality"]): "low" | "med" | "high" =>
  q === "low" ? "low" : q === "ultra" || q === "high" ? "high" : "med";

export const hexToBinaryBits = (h: string): string =>
  h
    .replace(/^0x/i, "")
    .split("")
    .map((c) => parseInt(c, 16).toString(2).padStart(4, "0"))
    .join("");

export function makeSummary(
  eternalSeal: string | undefined | null,
  beat: number,
  stepIndex: number,
  pulse: number
) {
  return eternalSeal
    ? `Eternal Seal • ${eternalSeal}`
    : `Day Seal: ${beat}:${stepIndex} • Kai-Pulse ${pulse}`;
}

/* ---------- UTF-8 safe Base64 with no any/Buffer/btoa/atob ---------- */

/** Minimal Base64 alphabet */
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Encode raw bytes to base64 */
function base64FromBytes(bytes: Uint8Array): string {
  let out = "";
  const len = bytes.length;
  let i = 0;
  for (; i + 2 < len; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      B64[(n >>> 18) & 63] +
      B64[(n >>> 12) & 63] +
      B64[(n >>> 6) & 63] +
      B64[n & 63];
  }
  const remain = len - i;
  if (remain === 1) {
    const n = bytes[i] << 16;
    out += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63] + "==";
  } else if (remain === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63] + B64[(n >>> 6) & 63] + "=";
  }
  return out;
}

/** Decode base64 to raw bytes */
function bytesFromBase64(b64: string): Uint8Array {
  // strip whitespace and validate characters
  const s = b64.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length % 4 !== 0) return new Uint8Array(0);

  const outLen = (s.length / 4) * 3 - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0);
  const out = new Uint8Array(outLen);

  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const c0 = B64.indexOf(s[i]);
    const c1 = B64.indexOf(s[i + 1]);
    const c2 = s[i + 2] === "=" ? -1 : B64.indexOf(s[i + 2]);
    const c3 = s[i + 3] === "=" ? -1 : B64.indexOf(s[i + 3]);

    const n = (c0 << 18) | (c1 << 12) | ((c2 & 63) << 6) | (c3 & 63);
    out[o++] = (n >>> 16) & 0xff;
    if (c2 >= 0 && o < outLen) out[o++] = (n >>> 8) & 0xff;
    if (c3 >= 0 && o < outLen) out[o++] = n & 0xff;
  }
  return out;
}

// Normalize bullet variants to one glyph to prevent equality drift
const normalizeBullets = (s: string) => s.replace(/·|\u2022/g, "•");

export function toSummaryB64(input: string): string {
  if (!input) return "";
  const normalized = normalizeBullets(input);
  const bytes = new TextEncoder().encode(normalized);
  return base64FromBytes(bytes);
}

export function fromSummaryB64(b64: string): string {
  if (!b64) return "";
  try {
    const bytes = bytesFromBase64(b64);
    const text = new TextDecoder().decode(bytes);
    return normalizeBullets(text);
  } catch {
    return "";
  }
}

/* --------------------------------------------------------------------------- */

export function precomputeLedgerDht(embeddedMetaJson: string | undefined) {
  const none = "null";
  if (!embeddedMetaJson) return { ledgerJson: none, dhtJson: none };
  try {
    const j = JSON.parse(embeddedMetaJson) as { ledger?: unknown; dht?: unknown };
    return {
      ledgerJson: JSON.stringify(j.ledger ?? null),
      dhtJson: JSON.stringify(j.dht ?? null),
    };
  } catch {
    return { ledgerJson: none, dhtJson: none };
  }
}

/**
 * Convert a possibly mixed-value data-attrs object (string | number | undefined)
 * into a strict Record<string, string>, dropping undefined and stringifying numbers.
 */
function toStrictStringDataAttrs(
  src: Record<string, unknown>
): Record<string, string> {
  const entries = Object.entries(src).flatMap(([k, v]) => {
    if (v === undefined || v === null) return [];
    return [[k, String(v)] as const];
  });
  return Object.fromEntries(entries);
}

export function getSnapshots(
  klock: unknown,
  kaiData: unknown
): {
  klockIsoSnapshot: Record<string, unknown> | null;
  apiSnapshot: Record<string, unknown> | null;
  klockDataAttrs: Record<string, string>;
  eternalMonth: string | undefined;
  harmonicDay: string | undefined;
  kaiPulseEternal: number | undefined;
  solarChakraStepString: string | undefined;
  chakraArc: string | undefined;
} {
  const klockIsoSnapshot = isPlainObj(klock)
    ? (JSON.parse(safeStringify(klock)) as Record<string, unknown>)
    : null;

  const apiSnapshot = isPlainObj(kaiData)
    ? (JSON.parse(safeStringify(kaiData)) as Record<string, unknown>)
    : null;

  const rawDataAttrs =
    klockIsoSnapshot ? flattenAsDataAttrs("klock", klockIsoSnapshot) : {};

  const klockDataAttrs = toStrictStringDataAttrs(
    rawDataAttrs as Record<string, unknown>
  );

  const eternalMonth = getStrField(klock, "eternalMonth");
  const harmonicDay = getStrField(klock, "harmonicDay");
  const kaiPulseEternal = getNumField(klock, "kaiPulseEternal");
  const solarChakraStepString = getStrField(klock, "solarChakraStepString");
  const chakraArc = getStrField(klock, "chakraArc");

  return {
    klockIsoSnapshot,
    apiSnapshot,
    klockDataAttrs,
    eternalMonth,
    harmonicDay,
    kaiPulseEternal:
      typeof kaiPulseEternal === "number" ? kaiPulseEternal : undefined,
    solarChakraStepString,
    chakraArc,
  };
}

export function makeOuterRingText(
  payloadHashHex: string | undefined,
  stateKeyOk: boolean,
  chakraDayKey: string,
  frequencyHz: number,
  pulse: number,
  beat: number,
  zkPoseidonHash?: string
): string {
  const dayToken = String(chakraDayKey).replace(/\s+/g, "_");
  const sig = stateKeyOk ? payloadHashHex ?? "pending" : "pending";
  const parts = [
    `sig=${sig}`,
    `pulse=${pulse}`,
    `beat=${beat}`,
    `day=${dayToken}`,
    `hz=${frequencyHz}`,
  ];
  if (zkPoseidonHash) parts.push(`poseidon=${zkPoseidonHash}`);
  return parts.join(" | ");
}

export function phaseColorFrom(
  hue: number,
  visualClamped: number,
  payloadHashHex?: string
) {
  const coreHue = hue;
  const shift = payloadHashHex
    ? (parseInt(payloadHashHex.slice(-2), 16) % 12) * 2.5
    : 0;
  const phaseHue = (coreHue + shift) % 360;
  return hsl(phaseHue, 100, 50 + 15 * Math.sin(visualClamped * 2 * Math.PI));
}