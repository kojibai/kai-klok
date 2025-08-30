// (QR-FREE) KaiSigil.tsx
"use client";

import React, {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";
import { canonicalUrlFromContext } from "../utils/sigilUrl";

import { PULSE_MS, STEPS_BEAT, API_URL } from "../utils/kai_pulse";
import { canonicalize } from "../lib/sigil/canonicalize";
import { blake3Hex } from "../lib/sigil/hash";
import { gzipB64 } from "../lib/sigil/codec";
import {
  getSigner,
  signHash as signWithProvider,
  type HarmonicSig,
} from "../lib/sigil/signature";
import { generateKeyPair, signCanonicalMessage } from "../lib/sigil/breathProof";

/* ⬇️ valuation imports */
import type { ValueSeal, SigilMetadataLite } from "../utils/valuation";
import { buildValueSeal, computeIntrinsicUnsigned } from "../utils/valuation";

/* ═════════════════ PUBLIC API ════════════════════════════════ */
export type HashMode = "moment" | "deterministic";

export interface KaiSigilProps {
  pulse: number;
  beat: number;
  stepPct: number;
  chakraDay:
    | "Root"
    | "Sacral"
    | "Solar Plexus"
    | "Heart"
    | "Throat"
    | "Third Eye"
    | "Crown";
  size?: number;

  hashOverride?: string;
  strict?: boolean;
  quality?: "ultra" | "high" | "low";
  animate?: boolean;
  debugOutline?: boolean;
  goldenId?: string;

  hashMode?: HashMode;

  userPhiKey?: string;
  kaiSignature?: string;
  intentionSigil?: string;
  creatorPublicKey?: string;

  /** Absolute origin to use when building canonical URL parity (optional). */
  origin?: string;

  /** If provided, used VERBATIM as the one-and-only URL (also embedded). */
  qrHref?: string;

  showZKBadge?: boolean;

  onReady?: (info: { hash: string; url: string; metadataJson: string }) => void;
  onError?: (err: unknown) => void;

  /* ⬇️ NEW: full EternalKlock payload to embed */
  klock?: Record<string, unknown>;

  /* ⬇️ NEW: arbitrary extras to embed (e.g., API snapshot) */
  embed?: Record<string, unknown>;
}

export interface KaiSigilHandle {
  toDataURL(): string;
  exportBlob(
    type?: "image/svg+xml" | "image/png",
    scale?: number
  ): Promise<Blob>;
  verifySvgHash(expected: string): Promise<string>;
  uid: string;
  stepIndex: number;
  payloadHashHex: string | undefined;
  sigilUrl: string | undefined; // canonical path (/s/<hash>)
  userPhiKey?: string;
  kaiSignature?: string;
}

/* ═════════════════ helpers ═════════════════ */

type JSONLike =
  | string
  | number
  | boolean
  | null
  | JSONLike[]
  | { [k: string]: JSONLike | undefined };
type JSONDict = { [k: string]: JSONLike | undefined };

type ChakraDayKey =
  | "Root"
  | "Sacral"
  | "Solar Plexus"
  | "Heart"
  | "Throat"
  | "Third Eye"
  | "Crown";

type ProofHints = {
  scheme: "groth16-poseidon" | string;
  api: string;
  explorer: string;
};

type ZkProof = {
  pi_a: [string, string, string];
  pi_b: [[string, string], [string, string], [string, string]];
  pi_c: [string, string, string];
};

type SigilPayloadExtended = {
  v: "1.0";
  kaiSignature: string;
  phikey: string;
  pulse: number;
  beat: number;
  stepIndex: number;
  chakraDay: ChakraDayKey;
  chakraGate: string;
  kaiPulse: number;
  stepsPerBeat: number;
  timestamp?: string;
  eternalRecord: string;
  creatorResolved: string;
  origin: string;
  proofHints: ProofHints;
  zkPoseidonHash: string;
  zkProof: ZkProof;
  ownerPubKey?: JsonWebKey;
  ownerSig?: string;
};

interface KaiData {
  kaiMomentSummary?: string;
  kairos_seal_day_month_percent?: string;
  kairos_seal?: string;
  [k: string]: unknown;
}
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function isKaiData(v: unknown): v is KaiData {
  return isRecord(v);
}
function getStr(obj: unknown, key: string): string | undefined {
  if (!isRecord(obj)) return undefined;
  const vv = obj[key];
  return typeof vv === "string" ? vv : undefined;
}
const clean = (s?: string, max = 220) =>
  s ? s.replace(/\s+/g, " ").trim().slice(0, max) : undefined;

const PHI = (1 + Math.sqrt(5)) / 2;
const TEAL = "#00FFD0";
const FONT_STACK =
  "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
const SPACE = 1000;
const CENTER = SPACE / 2;

const CHAKRAS = {
  Root: { sides: 4, hue: 0 },
  Sacral: { sides: 6, hue: 30 },
  "Solar Plexus": { sides: 5, hue: 53 },
  Heart: { sides: 8, hue: 122 },
  Throat: { sides: 12, hue: 180 },
  "Third Eye": { sides: 14, hue: 222 },
  Crown: { sides: 16, hue: 258 },
} as const;
type ChakraKey = keyof typeof CHAKRAS;

const CHAKRA_GATES: Record<ChakraKey, string> = {
  Root: "Earth Gate",
  Sacral: "Water Gate",
  "Solar Plexus": "Fire Gate",
  Heart: "Air Gate",
  Throat: "Will Gate",
  "Third Eye": "Light Gate",
  Crown: "Ether Gate",
};
const CHAKRA_BASE_FREQ: Record<ChakraKey, number> = {
  Root: 194.18,
  Sacral: 210.42,
  "Solar Plexus": 378.4,
  Heart: 620.9,
  Throat: 1292.3,
  "Third Eye": 1664.7,
  Crown: 2594.2,
};
const hsl = (h: number, s = 100, l = 50) => `hsl(${h} ${s}% ${l}%)`;
const polygonPath = (sides: number, rot = 0, rr = 0.38) => {
  const r = SPACE * rr;
  const cmds: string[] = [];
  for (let i = 0; i < sides; i += 1) {
    const t = (i / sides) * 2 * Math.PI + rot;
    const x = CENTER + r * Math.cos(t);
    const y = CENTER + r * Math.sin(t);
    cmds.push(`${i ? "L" : "M"}${x},${y}`);
  }
  return `${cmds.join("")}Z`;
};
const lissajousPath = (a: number, b: number, δ: number) => {
  const pts: string[] = [];
  for (let i = 0; i < 360; i += 1) {
    const t = (i / 359) * 2 * Math.PI;
    const x = ((Math.sin(a * t + δ) + 1) / 2) * SPACE;
    const y = ((Math.sin(b * t) + 1) / 2) * SPACE;
    pts.push(`${i ? "L" : "M"}${x},${y}`);
  }
  return `${pts.join("")}Z`;
};
const deriveFrequencyHz = (c: ChakraKey, stepIndex: number) =>
  +(
    CHAKRA_BASE_FREQ[c] *
    Math.pow(PHI, stepIndex / STEPS_BEAT)
  ).toFixed(3);

const bytesToHex = (bytes: Uint8Array) =>
  [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
async function sha256(data: string | Uint8Array): Promise<Uint8Array> {
  const buf = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return new Uint8Array(hash);
}

const B58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Encode(buffer: Uint8Array): string {
  let intVal = 0n;
  for (const byte of buffer) intVal = (intVal << 8n) + BigInt(byte);
  let out = "";
  while (intVal > 0n) {
    const mod = intVal % 58n;
    out = B58_ALPHABET[Number(mod)] + out;
    intVal /= 58n;
  }
  for (let i = 0; i < buffer.length && buffer[i] === 0; i += 1)
    out = B58_ALPHABET[0] + out;
  return out;
}
async function base58CheckEncode(
  payload: Uint8Array,
  version = 0x00
): Promise<string> {
  const versioned = new Uint8Array(1 + payload.length);
  versioned[0] = version;
  versioned.set(payload, 1);
  const checksumFull = await sha256(await sha256(versioned));
  const checksum = checksumFull.slice(0, 4);
  const full = new Uint8Array(versioned.length + 4);
  full.set(versioned);
  full.set(checksum, versioned.length);
  return base58Encode(full);
}
function mulberry32(a: number) {
  // Deterministic PRNG (seeded)
  let state = a >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashToUint32(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const hexToBytes = (hex: string) => {
  const h = hex.replace(/^0x/i, "");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
};
function crc32(bytes: Uint8Array): number {
  let c = ~0 >>> 0;
  for (let i = 0; i < bytes.length; i += 1) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k += 1)
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

async function deriveCreatorIdentity(opts: {
  creatorPublicKey?: string;
  userPhiKey?: string;
  kaiSignature?: string;
  origin?: string;
  pulse: number;
  beat: number;
  chakraDay: string;
  stepIndex: number;
}): Promise<{ creator: string; creatorId: string; creatorAlg: string }> {
  const {
    creatorPublicKey,
    userPhiKey,
    kaiSignature,
    origin,
    pulse,
    beat,
    chakraDay,
    stepIndex,
  } = opts;
  if (creatorPublicKey)
    return {
      creator: `did:key:${creatorPublicKey}`,
      creatorId: creatorPublicKey,
      creatorAlg: "did:key",
    };
  if (userPhiKey)
    return {
      creator: `phi:${userPhiKey}`,
      creatorId: userPhiKey,
      creatorAlg: "phi-b58chk",
    };
  if (kaiSignature) {
    const sigBytes = await sha256(kaiSignature);
    const phiLike = await base58CheckEncode(sigBytes.slice(0, 20));
    return {
      creator: `phi:${phiLike}`,
      creatorId: phiLike,
      creatorAlg: "sig→sha256→b58chk",
    };
  }
  const seed = await sha256(
    `anon:${origin ?? ""}:${pulse}|${beat}|${chakraDay}|${stepIndex}`
  );
  const anon = await base58CheckEncode(seed.slice(0, 20));
  return { creator: `anon:${anon}`, creatorId: anon, creatorAlg: "anon-b58chk" };
}

function jwkToJSONLike(jwk: JsonWebKey): { [k: string]: JSONLike } {
  const out: { [k: string]: JSONLike } = {};
  const primKeys = [
    "kty",
    "crv",
    "alg",
    "kid",
    "x",
    "y",
    "n",
    "e",
    "d",
    "p",
    "q",
    "dp",
    "dq",
    "qi",
  ] as const;
  for (const key of primKeys) {
    const v = (jwk as Record<string, unknown>)[key];
    if (typeof v === "string") out[key] = v;
  }
  if (Array.isArray(jwk.key_ops)) out.key_ops = jwk.key_ops.map((op) => String(op));
  if (typeof jwk.ext === "boolean") out.ext = jwk.ext;
  return out;
}

/* small hasher for valuation stamp (string → SHA256 hex) */
function useStableSha256() {
  return useMemo(
    () => async (s: string) => {
      const data = new TextEncoder().encode(s);
      const buf = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    },
    []
  );
}
function b64Utf8(s: string): string {
  if (typeof window === "undefined" || typeof window.btoa !== "function") {
    throw new Error("Base64 encoding unavailable in this environment");
  }
  // Encode to UTF-8 before btoa
  return window.btoa(
    encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (_m, h) =>
      String.fromCharCode(parseInt(h, 16))
    )
  );
}

/* ⬇️ NEW: tiny utils for safe embedding of “everything” */
const isPlainObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const toIsoIfDate = (v: unknown): string =>
  v instanceof Date ? v.toISOString() : String(v);

/* Data-* attrs type and helpers */
type DataAttrs = Record<`data-${string}`, string | number | undefined>;

/** Flatten nested objects into data-* friendly k/v, prefixing with `data-${root}-...` */
function flattenAsDataAttrs(
  root: string,
  obj: Record<string, unknown>,
  maxDepth = 6
): DataAttrs {
  const out: DataAttrs = {};
  const setKV = (k: string, v: string | number | undefined) => {
    out[`data-${k}` as `data-${string}`] = v;
  };

  const walk = (prefix: string, value: unknown, depth: number) => {
    if (depth > maxDepth) return;
    if (Array.isArray(value)) {
      setKV(
        prefix,
        JSON.stringify(
          value.map((x) => (x instanceof Date ? x.toISOString() : x))
        )
      );
      return;
    }
    if (isPlainObj(value)) {
      for (const [k, v] of Object.entries(value)) {
        const key = k
          .replace(/[^a-zA-Z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .toLowerCase();
        walk(`${prefix}-${key}`, v, depth + 1);
      }
      return;
    }
    if (
      typeof value === "number" ||
      typeof value === "string" ||
      value === undefined ||
      value === null
    ) {
      setKV(
        prefix,
        value === null
          ? undefined
          : typeof value === "number"
          ? value
          : toIsoIfDate(value)
      );
    } else {
      setKV(prefix, toIsoIfDate(value));
    }
  };

  for (const [k, v] of Object.entries(obj)) {
    const key = `${root}-${k
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()}`;
    walk(key, v, 1);
  }
  return out;
}

/** Safe stringify preserving Dates and BigInts as strings */
function safeStringify(v: unknown): string {
  return JSON.stringify(v, (_k, val) => {
    if (val instanceof Date) return val.toISOString();
    if (typeof val === "bigint") return val.toString();
    return val;
  });
}

/* Safe field readers (no any) */
function getStrField(obj: unknown, key: string): string | undefined {
  if (!isPlainObj(obj)) return undefined;
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}
function getNumField(obj: unknown, key: string): number | undefined {
  if (!isPlainObj(obj)) return undefined;
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/* ═════════════════ COMPONENT ════════════════════════════════ */
const KaiSigil = forwardRef<KaiSigilHandle, KaiSigilProps>((props, ref) => {
  const {
    pulse,
    beat,
    stepPct,
    chakraDay,
    size = 240,
    hashOverride,
    strict = process.env.NODE_ENV !== "production",
    quality = "high",
    animate = true,
    debugOutline = false,
    goldenId,
    hashMode = "moment",
    userPhiKey: propPhiKey,
    kaiSignature: propSignature,
    intentionSigil,
    creatorPublicKey,
    origin,
    onReady,
    onError,
    showZKBadge = true,
    qrHref,

    /* ⬇️ NEW */
    klock,
    embed,
  } = props;

  const reportNonFatal = (err: unknown): void => {
    // Non-fatal: surface to onError if provided
    if (onError) onError(err);
  };

  /* System prefs */
  const [prefersReduce, setPrefersReduce] = useState(false);
  const [prefersContrast, setPrefersContrast] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mContrast = window.matchMedia("(prefers-contrast: more)");
    const apply = () => {
      setPrefersReduce(!!mReduce.matches);
      setPrefersContrast(!!mContrast.matches);
    };
    apply();
    mReduce.addEventListener?.("change", apply);
    mContrast.addEventListener?.("change", apply);
    return () => {
      mReduce.removeEventListener?.("change", apply);
      mContrast.removeEventListener?.("change", apply);
    };
  }, []);

  /* Live Kai metadata pull (for titles/summary only) */
  const [kaiData, setKaiData] = useState<KaiData | null>(null);
  const kaiFetchErrorLoggedRef = useRef(false);
  useEffect(() => {
    if (hashMode !== "moment") return;
    const ac = new AbortController();
    const fetchKai = async () => {
      try {
        const res = await fetch(API_URL, { cache: "no-store", signal: ac.signal });
        if (!res.ok) throw new Error(res.statusText);
        const j = (await res.json()) as unknown;
        if (isKaiData(j)) setKaiData(j);
      } catch (e) {
        // Non-fatal and throttled: metadata is optional
        if (!kaiFetchErrorLoggedRef.current) {
          reportNonFatal(e);
          kaiFetchErrorLoggedRef.current = true;
        }
      }
    };
    void fetchKai();
    const id = window.setInterval(fetchKai, PULSE_MS);
    return () => {
      ac.abort();
      window.clearInterval(id);
    };
  }, [hashMode]);

  /* Derived indices (single source of truth; example step is 35) */
  const visualClamped = Math.min(Math.max(stepPct, 0), 1);
  const stepIndex = Math.min(
    Math.floor(visualClamped * STEPS_BEAT),
    STEPS_BEAT - 1
  );

  /* Seeds (use the single stepIndex for ids/filters to match UI) */
  const seedKey = `${pulse}|${beat}|${stepIndex}|${chakraDay}`;
  const seed = useMemo(() => hashToUint32(seedKey), [seedKey]);
  const rnd = useMemo(() => mulberry32(seed), [seed]);
  const a = (pulse % 7) + 1;
  const b = (beat % 5) + 2;
  const delta = visualClamped * 2 * Math.PI;
  const rotation = (PHI ** 2 * Math.PI * (pulse % 97)) % (2 * Math.PI);
  const { sides, hue } = CHAKRAS[chakraDay as ChakraKey];
  const light = 50 + 15 * Math.sin(visualClamped * 2 * Math.PI);
  const baseColor = hsl((hue + 360 * 0.03 * visualClamped) % 360, 100, light);
  const chakraGate = CHAKRA_GATES[chakraDay as ChakraKey];

  // Frequency shown/embedded follows the same single stepIndex.
  const frequencyHz = deriveFrequencyHz(chakraDay as ChakraKey, stepIndex);

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio ?? 1 : 1;
  const doAnim = animate && !prefersReduce;

  const uid = goldenId ?? `ks-${pulse}-${beat}-${stepIndex}`;
  const pad = Math.max(10, Math.floor((size ?? 240) * 0.08));
  const safeTextWidth = Math.max(40, (size ?? 240) - pad * 2);
  const outlineWidth = Math.max(0.6, (size ?? 240) * 0.003);
  const strokeCore = Math.max(1.4, (size ?? 240) * 0.009);
  const dotR = Math.max(2.5, (size ?? 240) * 0.016);

  const durMs = 5000 + Math.floor(rnd() * 800) + Math.floor((seed % 436) / 2);
  const offMs = Math.floor((seed >>> 1) % durMs);

  const corePath = useMemo(() => polygonPath(sides, rotation), [sides, rotation]);
  const auraPath = useMemo(() => lissajousPath(a, b, delta), [a, b, delta]);

  /* Dev identity fallbacks (derive from the single stepIndex) */
  const [autoSig, setAutoSig] = useState<string>();
  const [autoPhi, setAutoPhi] = useState<string>();
  useEffect(() => {
    (async () => {
      let sigLocal = propSignature;
      if (!sigLocal) {
        const base = `${pulse}|${beat}|${stepIndex}|${chakraDay}|${
          intentionSigil ?? ""
        }`;
        sigLocal = bytesToHex(await sha256(base));
        setAutoSig(sigLocal);
      }
      let phiLocal = propPhiKey;
      if (!phiLocal && sigLocal) {
        const hashBytes = await sha256(`${sigLocal}φ`);
        phiLocal = await base58CheckEncode(hashBytes.slice(0, 20));
        setAutoPhi(phiLocal);
      }
    })().catch(reportNonFatal);
  }, [propSignature, propPhiKey, pulse, beat, stepIndex, chakraDay, intentionSigil]);
  const kaiSignature = propSignature ?? autoSig;
  const userPhiKey = propPhiKey ?? autoPhi;

  /* ─────────────── valuation state ─────────────── */
  const hasher = useStableSha256();
  // freeze mint pulse once for the sealed valuation
  const mintPulseRef = useRef<number>(pulse);
  // live value (recomputed every pulse via the same math)
  const [liveValuePhi, setLiveValuePhi] = useState<number | null>(null);
  // sealed ValueSeal (embedded)
  const [mintSeal, setMintSeal] = useState<ValueSeal | null>(null);
  // remember valuation meta derived from this glyph
  const valuationMetaRef = useRef<SigilMetadataLite | null>(null);

  // keep valuation meta in sync with glyph
  useEffect(() => {
    const qMap = (q: KaiSigilProps["quality"]): "low" | "med" | "high" =>
      q === "low" ? "low" : q === "ultra" || q === "high" ? "high" : "med";
    valuationMetaRef.current = {
      pulse: mintPulseRef.current,
      kaiPulse: mintPulseRef.current,
      kaiSignature: kaiSignature ?? undefined,
      userPhiKey: userPhiKey ?? undefined,
      beat,
      stepIndex,
      stepsPerBeat: STEPS_BEAT,
      quality: qMap(quality),
      frequencyHz,
      chakraDay,
      chakraGate,
    };
  }, [
    beat,
    stepIndex,
    kaiSignature,
    userPhiKey,
    frequencyHz,
    chakraDay,
    chakraGate,
    quality,
  ]);

  /* Canonical metadata → hash → SINGLE-SOURCE share URL (+ valuation embed) */
  const [payloadHashHex, setPayloadHashHex] = useState<string>();
  const [sigilUrl, setSigilUrl] = useState<string>(); // path only (/s/<hash>)
  const [embeddedMetaJson, setEmbeddedMetaJson] = useState<string>();
  const [zkScheme, setZkScheme] = useState<string>();
  const [zkPoseidonHash, setZkPoseidonHash] = useState<string>();

  const [shareUrl, setShareUrl] = useState<string>(); // EXACT URL used by link & manifest
  const [innerRingText, setInnerRingText] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const creatorMeta = await deriveCreatorIdentity({
          creatorPublicKey,
          userPhiKey,
          kaiSignature,
          origin,
          pulse,
          beat,
          chakraDay,
          stepIndex,
        });

        const title =
          clean(getStr(kaiData, "kaiMomentSummary")) ??
          clean(getStr(kaiData, "kairos_seal_day_month_percent")) ??
          `Kairos HarmoniK Sigil • ${chakraDay} • Beat ${beat} • Step ${stepIndex}`;

        const nowIso = new Date().toISOString();
        const includeTimestamp = (hashMode ?? "moment") === "moment";

        const headerBase = {
          v: "1.0",
          title,
          creator: creatorMeta.creator,
          creatorAlg: creatorMeta.creatorAlg,
          creatorId: creatorMeta.creatorId,
          pulse,
          ...(includeTimestamp ? { timestamp: nowIso } : {}),
        } as const;

        const payloadObj: SigilPayloadExtended = {
          v: "1.0",
          kaiSignature: kaiSignature ?? "",
          phikey: userPhiKey ?? "",
          pulse,
          beat,
          stepIndex,
          chakraDay: chakraDay as ChakraDayKey,
          chakraGate,
          kaiPulse: pulse,
          stepsPerBeat: STEPS_BEAT,
          ...(includeTimestamp ? { timestamp: nowIso } : {}),
          eternalRecord:
            clean(getStr(kaiData, "kaiMomentSummary"), 300) ??
            clean(getStr(kaiData, "kairos_seal_day_month_percent"), 300) ??
            clean(getStr(kaiData, "kairos_seal"), 300) ??
            `Day Seal: ${beat}:${stepIndex} • Kai-Pulse ${pulse}`,
          creatorResolved: headerBase.creator,
          origin:
            origin ??
            (typeof window !== "undefined" ? window.location.origin : ""),
          proofHints: {
            scheme: "groth16-poseidon",
            api: "/api/proof/sigil",
            explorer: `/explorer/hash/<hash>`,
          },
          zkPoseidonHash:
            "7110303097080024260800444665787206606103183587082596139871399733998958991511",
          zkProof: {
            pi_a: ["1985613...27250", "1010639...44602", "1"],
            pi_b: [
              ["1533282...09373", "5207800...48361"],
              ["1976559...93879", "1852385...5266"],
              ["1", "0"],
            ],
            pi_c: ["1756353...9777", "8962254...24426", "1"],
          },
        };

        setZkScheme(payloadObj.proofHints.scheme);
        setZkPoseidonHash(String(payloadObj.zkPoseidonHash));

        const canonicalPayload: JSONDict = {
          v: payloadObj.v,
          kaiSignature: payloadObj.kaiSignature,
          phikey: payloadObj.phikey,
          pulse: payloadObj.pulse,
          beat: payloadObj.beat,
          stepIndex: payloadObj.stepIndex,
          chakraDay: payloadObj.chakraDay,
          chakraGate: payloadObj.chakraGate,
          kaiPulse: payloadObj.kaiPulse,
          stepsPerBeat: payloadObj.stepsPerBeat,
          timestamp: payloadObj.timestamp,
          eternalRecord: payloadObj.eternalRecord,
          creatorResolved: payloadObj.creatorResolved,
          origin: payloadObj.origin,
          proofHints: {
            scheme: payloadObj.proofHints.scheme,
            api: payloadObj.proofHints.api,
            explorer: payloadObj.proofHints.explorer,
          },
          zkPoseidonHash: payloadObj.zkPoseidonHash,
          zkProof: {
            pi_a: payloadObj.zkProof.pi_a,
            pi_b: payloadObj.zkProof.pi_b,
            pi_c: payloadObj.zkProof.pi_c,
          },
          ownerPubKey: payloadObj.ownerPubKey
            ? jwkToJSONLike(payloadObj.ownerPubKey)
            : undefined,
          ownerSig: payloadObj.ownerSig,
        };

        const canonicalBytes = canonicalize(canonicalPayload);
        const hex = await blake3Hex(canonicalBytes);
        if (cancelled) return;

        const payloadB64 = gzipB64(canonicalBytes);

        let payloadSignature: HarmonicSig | undefined;
        const signer = getSigner();
        if (signer) payloadSignature = await signWithProvider(hex);

        const integrity = {
          payloadEncoding: "gzip+base64" as const,
          payloadHash: { alg: "blake3" as const, value: hex },
          payloadSignature:
            payloadSignature ?? {
              alg: "harmonic-sig",
              public: userPhiKey ?? creatorMeta.creatorId,
              value: "",
            },
        } as const;

        const canonicalMsg = canonicalize({
          parentCanonical: "optional-parent-ref",
          parentStateRoot: "optional-state-root",
          eventKind: "mint",
          pulse,
          beat,
          stepIndex,
          chakraDay,
          childNonce: `${beat}-${stepIndex}`,
          amount: "1.000",
          expiresAtPulse: pulse + 12,
          lineageCommitment: "optional-hash-of-lineage",
        });

        const { publicKeyJwk, privateKey } = await generateKeyPair();
        const ownerSig = await signCanonicalMessage(privateKey, canonicalMsg);

        payloadObj.ownerPubKey = publicKeyJwk;
        payloadObj.ownerSig = ownerSig;

        const path = `/s/${hex}`;
        setSigilUrl(path);

        // Base canonical path (absolute), then append compact parity payload (?p=c:<b64(json)>)
        const baseUrl =
          (qrHref && qrHref.trim()) ||
          canonicalUrlFromContext(
            hex,
            origin ??
              (typeof window !== "undefined" ? window.location.origin : "")
          );

        const compactPayload = {
          u: pulse,
          b: beat,
          s: stepIndex,
          c: chakraDay,
          d: STEPS_BEAT,
        } as const;

        const compactParam = `c:${b64Utf8(JSON.stringify(compactPayload))}`;
        const parityUrl =
          typeof baseUrl === "string" && baseUrl.includes("?p=")
            ? baseUrl // already provided as full parity URL
            : `${baseUrl}?p=${encodeURIComponent(compactParam)}`;

        const header = { ...headerBase, shareUrl: parityUrl };

        /* 🧮 build sealed valuation (mint-time) and embed it + sources/runtime */
        let mintedSeal: ValueSeal | null = null;
        let valuationSource: SigilMetadataLite;
        try {
          valuationSource = (valuationMetaRef.current ??
            {
              pulse: mintPulseRef.current,
              kaiPulse: mintPulseRef.current,
              kaiSignature: kaiSignature ?? undefined,
              userPhiKey: userPhiKey ?? undefined,
              beat,
              stepIndex,
              stepsPerBeat: STEPS_BEAT,
              quality: "high" as const,
              frequencyHz,
              chakraDay,
              chakraGate,
            }) as SigilMetadataLite;
          const { seal } = await buildValueSeal(
            valuationSource,
            mintPulseRef.current,
            hasher
          );
          mintedSeal = seal;
          setMintSeal(seal);
        } catch (e) {
          // If valuation seal fails, still embed source/runtime; non-fatal
          reportNonFatal(e);
          valuationSource =
            (valuationMetaRef.current ??
              {
                pulse: mintPulseRef.current,
                kaiPulse: mintPulseRef.current,
                kaiSignature: kaiSignature ?? undefined,
                userPhiKey: userPhiKey ?? undefined,
                beat,
                stepIndex,
                stepsPerBeat: STEPS_BEAT,
                quality: "high" as const,
                frequencyHz,
                chakraDay,
                chakraGate,
              }) as SigilMetadataLite;
        }

        const embedded = {
          $schema: "https://atlantean.lumitech/schemas/kai-sigil/1.0.json",
          contentType: "application/vnd.kai-sigil+json;v=1",
          header,
          payload: payloadB64,
          integrity,

          // ✅ sealed valuation rides inside the SVG metadata
          valuation: mintedSeal ?? null,

          // ➕ embed the inputs & runtime needed to recompute value offline
          valuationSource,
          valuationRuntime: {
            PULSE_MS,
            STEPS_BEAT,
            PHI,
            algorithm: "computeIntrinsicUnsigned" as const,
            version: "1",
          },

          // snapshot of live value at export time (optional)
          valuationLiveAtExport: valuationSource
            ? computeIntrinsicUnsigned(valuationSource, pulse).unsigned.valuePhi
            : null,
        };
        const metaString = JSON.stringify(embedded);

        /* ---------- Immutable inner-ring text ---------- */
        const len = canonicalBytes.length;
        const crcHex = crc32(canonicalBytes).toString(16).padStart(8, "0");
        const hashB58 = base58Encode(hexToBytes(hex));
        const creatorShort = creatorMeta.creatorId.slice(0, 12);
        const zkShort = String(payloadObj.zkPoseidonHash).slice(0, 12);
        const inner = [
          `u=${parityUrl}`,
          `b58=${hashB58}`,
          `len=${len}`,
          `crc32=${crcHex}`,
          `creator=${creatorShort}`,
          `zk=${zkShort}`,
          `alg=${creatorMeta.creatorAlg}`,
        ].join(" · ");
        setInnerRingText(inner);
        /* --------------------------------------------- */

        if (!cancelled) {
          setPayloadHashHex(hex);
          setEmbeddedMetaJson(metaString);
          setShareUrl(parityUrl);
          onReady?.({ hash: hex, url: parityUrl, metadataJson: metaString });
        }
      } catch (e) {
        onError?.(e);
        if (strict) {
          throw e instanceof Error ? e : new Error(String(e));
        }
      }
    })().catch((e) => {
      onError?.(e);
      if (strict) throw e instanceof Error ? e : new Error(String(e));
    });
    return () => {
      cancelled = true;
    };
  }, [
    pulse,
    beat,
    stepIndex,
    chakraDay,
    chakraGate,
    kaiSignature,
    userPhiKey,
    hashMode,
    kaiData,
    creatorPublicKey,
    origin,
    qrHref,
    strict,
    onReady,
    onError,
  ]);

  /* Recompute LIVE value each pulse (data only; not printed) */
  useEffect(() => {
    try {
      if (!valuationMetaRef.current || !Number.isFinite(pulse)) {
        setLiveValuePhi(null);
        return;
      }
      const { unsigned } = computeIntrinsicUnsigned(valuationMetaRef.current, pulse);
      setLiveValuePhi(unsigned.valuePhi);
    } catch (e) {
      reportNonFatal(e);
      setLiveValuePhi(null);
    }
  }, [pulse]);

  /* ⬇️ NEW: choose the canonical eternal seal from KlockData (fallback to API) */
  const eternalSeal =
    getStrField(klock, "eternalSeal") ??
    getStrField(klock, "seal") ??
    getStr(kaiData, "kairos_seal");

  /* Summary (<desc>) — prefer Eternal Seal if present, else fallback */
  const summary = useMemo(
    () =>
      eternalSeal
        ? `Eternal Seal • ${eternalSeal}`
        : `Day Seal: ${beat}:${stepIndex} • Kai-Pulse ${pulse}`,
    [eternalSeal, beat, stepIndex, pulse]
  );

  /* Optional full-SVG hash check (unrelated to canonical payload hash) */
  const svgRef = useRef<SVGSVGElement | null>(null);
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el || !hashOverride) return;
    let cancelled = false;
    (async () => {
      try {
        const clone = el.cloneNode(true) as SVGSVGElement;
        clone.removeAttribute("data-svg-hash");
        clone.removeAttribute("data-svg-valid");
        const xml = new XMLSerializer().serializeToString(clone);
        const calc = bytesToHex(await sha256(xml));
        if (cancelled) return;
        el.dataset.svgHash = calc;
        el.dataset.svgValid = String(calc === hashOverride.toLowerCase());
        if (calc !== hashOverride.toLowerCase() && strict) {
          throw new Error(`[KaiSigil] SVG HASH MISMATCH (${calc})`);
        }
      } catch (e) {
        onError?.(e);
        if (strict) {
          throw e instanceof Error ? e : new Error(String(e));
        }
      }
    })().catch((e) => {
      onError?.(e);
      if (strict) throw e instanceof Error ? e : new Error(String(e));
    });
    return () => {
      cancelled = true;
    };
  }, [hashOverride, strict, embeddedMetaJson, stepIndex, onError]);

  /* Exporters */
  const utf8ToBase64 = (s: string): string => {
    if (typeof window === "undefined" || typeof window.btoa !== "function") {
      throw new Error("Base64 encoding unavailable in this environment");
    }
    // Encode to UTF-8 before btoa
    const utf8 = encodeURIComponent(s).replace(
      /%([0-9A-F]{2})/g,
      (_: string, h: string) => String.fromCharCode(parseInt(h, 16))
    );
    return window.btoa(utf8);
  };

  useImperativeHandle(ref, () => ({
    toDataURL: () => {
      const el = svgRef.current;
      if (!el) throw new Error("SVG not mounted");
      return `data:image/svg+xml;base64,${utf8ToBase64(
        new XMLSerializer().serializeToString(el)
      )}`;
    },
    async exportBlob(
      type: "image/svg+xml" | "image/png" = "image/svg+xml",
      scale = 2
    ) {
      const el = svgRef.current;
      if (!el) throw new Error("SVG not mounted");
      const xml = new XMLSerializer().serializeToString(el);
      if (type === "image/svg+xml") return new Blob([xml], { type });
      const svgUrl = URL.createObjectURL(
        new Blob([xml], { type: "image/svg+xml" })
      );
      try {
        const img = new Image();
        const sizePx = Math.round((size ?? 240) * scale);
        img.decoding = "async";
        img.src = svgUrl;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = sizePx;
        canvas.height = sizePx;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context not available");
        ctx.drawImage(img, 0, 0, sizePx, sizePx);
        const blob: Blob = await new Promise<Blob>((res, rej) => {
          canvas.toBlob((b) => {
            if (b) res(b);
            else rej(new Error("Canvas toBlob failed"));
          }, "image/png");
        });
        return blob;
      } finally {
        URL.revokeObjectURL(svgUrl);
      }
    },
    async verifySvgHash(expected: string) {
      const el = svgRef.current;
      if (!el) throw new Error("SVG not mounted");
      const clone = el.cloneNode(true) as SVGSVGElement;
      clone.removeAttribute("data-svg-hash");
      clone.removeAttribute("data-svg-valid");
      const xml = new XMLSerializer().serializeToString(clone);
      const calc = bytesToHex(await sha256(xml));
      if (calc !== expected.toLowerCase())
        throw new Error(`SVG HASH MISMATCH (${calc} != ${expected})`);
      return calc;
    },
    uid,
    stepIndex,
    payloadHashHex,
    sigilUrl,
    userPhiKey,
    kaiSignature,
  }));

  /* IDs & visuals */
  const glowId = `${uid}-glow`;
  const bloomId = `${uid}-bloom`;
  const maskId = `${uid}-mask`;
  const sigPathId = `${uid}-sig-path`;
  const auraId = `${uid}-aura`;
  const descId = `${uid}-desc`;

  const hashNibble = useMemo(() => {
    if (!payloadHashHex) return 0;
    const n = parseInt(payloadHashHex.slice(-2), 16);
    return Number.isFinite(n) ? n % 12 : 0;
  }, [payloadHashHex]);
  const phaseHue = (hue + hashNibble * 2.5) % 360;
  const phaseColor = hsl(
    phaseHue,
    100,
    50 + 15 * Math.sin(visualClamped * 2 * Math.PI)
  );

  const netId = `${uid}-net`;
  const warpId = `${uid}-warp`;

  const absoluteShareUrl = shareUrl || undefined;

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    absoluteShareUrl ? (
      <a
        href={absoluteShareUrl}
        target="_self"
        aria-label={`Open canonical sigil ${payloadHashHex}`}
      >
        {children}
      </a>
    ) : (
      <g tabIndex={0} role="button" aria-label="Sigil not yet canonicalized">
        {children}
      </g>
    );

  const hexToBinaryBits = (h: string) =>
    h
      .replace(/^0x/i, "")
      .split("")
      .map((c) => parseInt(c, 16).toString(2).padStart(4, "0"))
      .join("");
  const binaryForRender = useMemo(() => {
    if (!kaiSignature) return "";
    const bin = hexToBinaryBits(kaiSignature);
    const circumference = 2 * Math.PI * ((size ?? 240) * 0.46);
    const approxCharWidth = Math.max(3.5, (size ?? 240) * 0.028 * 0.55);
    const maxChars = Math.max(24, Math.floor(circumference / approxCharWidth));
    return bin.length > maxChars ? bin.slice(0, maxChars) : bin;
  }, [kaiSignature, size]);

  // ring text (keep clean; no price printed here)
  const outerRingText = useMemo(() => {
    const stepForRing = stepIndex;
    const hzForRing = deriveFrequencyHz(chakraDay as ChakraKey, stepForRing);
    const dayToken = String(chakraDay).replace(/\s+/g, "_");
    const parts = [
      `sig=${payloadHashHex ?? "pending"}`,
      `pulse=${pulse}`,
      `beat=${beat}`,
      `day=${dayToken}`,
      `hz=${hzForRing}`,
    ];
    if (zkPoseidonHash) parts.push(`poseidon=${zkPoseidonHash}`);
    return parts.join(" | ");
  }, [payloadHashHex, pulse, beat, stepIndex, chakraDay, zkPoseidonHash]);

  /* Center ZK petal path — evolve the geometry smoothly */
  const petalDefRef = useRef<SVGPathElement | null>(null);

  // 🎨 ZK glyph: subtle color evolution via radialGradient (gated by doAnim),
  // and rendered OUTSIDE the warp filter so it stays perfectly centered.
  const zkGlyph = useMemo(() => {
    if (!showZKBadge) return null;

    const rOuter = SPACE * 0.34;
    const rInner = rOuter / PHI;
    const rPetal = rInner * 0.96;
    const petalScale = rPetal / (SPACE / 2);

    const OUTER = outerRingText;
    const INNER = innerRingText || "initializing…";
    const petalId = `${uid}-zk-petal`;
    const petalPath = lissajousPath(5, 8, Math.PI / 2);

    const phiRingId = `${uid}-zk-phi-ring`;
    const binRingId = `${uid}-zk-bin-ring`;
    const gradId = `${uid}-zk-grad`;

    const wPetal = Math.max(1.0, (size ?? 240) * 0.008);
    const wRing = Math.max(0.9, (size ?? 240) * 0.007);
    const wGlow = Math.max(1.2, (size ?? 240) * 0.009);

    return (
      <g
        id={`${uid}-zk-glyph`}
        aria-label="Atlantean zero-knowledge verification glyph"
        pointerEvents="none"
      >
        <defs>
          <radialGradient id={gradId} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor={phaseColor} stopOpacity="0.85">
              {doAnim && (
                <>
                  <animate
                    attributeName="stop-opacity"
                    values=".55;.85;.55"
                    dur={`${PULSE_MS}ms`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="stop-color"
                    values={`${phaseColor};${TEAL};${phaseColor}`}
                    dur={`${PULSE_MS * 3}ms`}
                    repeatCount="indefinite"
                  />
                </>
              )}
            </stop>
            <stop offset="55%" stopColor={phaseColor} stopOpacity="0.55">
              {doAnim && (
                <animate
                  attributeName="stop-color"
                  values={`${phaseColor};${TEAL};${phaseColor}`}
                  dur={`${PULSE_MS * 3}ms`}
                  repeatCount="indefinite"
                />
              )}
            </stop>
            <stop offset="100%" stopColor={TEAL} stopOpacity="0.25">
              {doAnim && (
                <animate
                  attributeName="stop-opacity"
                  values=".15;.35;.15"
                  dur={`${PULSE_MS}ms`}
                  repeatCount="indefinite"
                />
              )}
            </stop>
          </radialGradient>

          <path
            id={phiRingId}
            d={`M ${CENTER} ${CENTER - rOuter} a ${rOuter} ${rOuter} 0 1 1 0 ${
              2 * rOuter
            } a ${rOuter} ${rOuter} 0 1 1 0 -${2 * rOuter}`}
            fill="none"
          />
          <path
            id={binRingId}
            d={`M ${CENTER} ${CENTER - rInner} a ${rInner} ${rInner} 0 1 1 0 ${
              2 * rInner
            } a ${rInner} ${rInner} 0 1 1 0 -${2 * rInner}`}
            fill="none"
          />
          <path id={petalId} ref={petalDefRef} d={petalPath} />
        </defs>

        <circle
          cx={CENTER}
          cy={CENTER}
          r={rOuter}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={wGlow}
          opacity="0.5"
          vectorEffect="non-scaling-stroke"
        >
          {doAnim && (
            <animate
              attributeName="opacity"
              values=".35;.65;.35"
              dur={`${PULSE_MS}ms`}
              repeatCount="indefinite"
            />
          )}
        </circle>

        {Array.from({ length: 12 }, (_, i) => (
          <use
            key={i}
            href={`#${petalId}`}
            transform={`translate(${CENTER},${CENTER}) scale(${petalScale}) rotate(${
              i * 30
            }) translate(${-CENTER},${-CENTER})`}
            stroke={`url(#${gradId})`}
            strokeWidth={wPetal}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.42"
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <g opacity="0.25">
          <circle
            cx={CENTER - rInner / 2.2}
            cy={CENTER}
            r={rInner * 0.86}
            fill="none"
            stroke={phaseColor}
            strokeWidth={wRing}
          />
          <circle
            cx={CENTER + rInner / 2.2}
            cy={CENTER}
            r={rInner * 0.86}
            fill="none"
            stroke={TEAL}
            strokeWidth={wRing}
          />
        </g>

        <circle
          cx={CENTER}
          cy={CENTER}
          r={rInner}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={wRing}
          opacity="0.55"
          vectorEffect="non-scaling-stroke"
        />

        <text
          key={`outer-${outerRingText}`}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
          fontSize={Math.max(8, (size ?? 240) * 0.035)}
          fill={phaseColor}
          opacity="0.33"
          textAnchor="middle"
          dominantBaseline="middle"
          letterSpacing={Math.max(0.8, (size ?? 240) * 0.002)}
          pointerEvents="none"
        >
          <textPath href={`#${phiRingId}`} startOffset="50%">
            {OUTER}
          </textPath>
        </text>

        <text
          fontFamily={FONT_STACK}
          fontSize={Math.max(7, (size ?? 240) * 0.03)}
          fill={TEAL}
          opacity="0.28"
          textAnchor="middle"
          dominantBaseline="middle"
          pointerEvents="none"
        >
          <textPath href={`#${binRingId}`} startOffset="50%">
            {INNER}
          </textPath>
        </text>
      </g>
    );
  }, [showZKBadge, size, phaseColor, uid, outerRingText, innerRingText, doAnim]);

  /* Evolve the central ZK petal geometry smoothly (φ-paced, no glitches) */
  useEffect(() => {
    if (!doAnim || !showZKBadge) return;
    const el = petalDefRef.current;
    if (!el) return;

    let raf = 0;
    const t0 = performance.now();

    const secPerPulse = PULSE_MS / 1000;
    const fA = (1 / secPerPulse) * (PHI * 0.21);
    const fB = (1 / secPerPulse) * ((PHI - 1) * 0.17);
    const fD = (1 / secPerPulse) * (Math.SQRT2 * 0.15);

    const a0 = 5;
    const b0 = 8;
    const aAmp = 1.6;
    const bAmp = 1.2;
    const d0 = Math.PI / 2;
    const dAmp = Math.PI / 3;

    const render = () => {
      const t = (performance.now() - t0) / 1000;
      const aDyn = a0 + aAmp * (0.5 + 0.5 * Math.sin(2 * Math.PI * fA * t));
      const bDyn =
        b0 + bAmp * (0.5 + 0.5 * Math.sin(2 * Math.PI * fB * t + 1.234));
      const deltaDyn = d0 + dAmp * Math.sin(2 * Math.PI * fD * t + 0.777);
      el.setAttribute("d", lissajousPath(aDyn, bDyn, deltaDyn));
      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [doAnim, showZKBadge]);

  /* ⬇️ NEW: build comprehensive embed bundle for <metadata> */
  const klockIsoSnapshot = useMemo(() => {
    if (!isPlainObj(klock)) return null;
    const clone = JSON.parse(safeStringify(klock)) as Record<string, unknown>;
    return clone;
  }, [klock]);

  const apiSnapshot = useMemo(() => {
    if (!isPlainObj(kaiData)) return null;
    return JSON.parse(safeStringify(kaiData)) as Record<string, unknown>;
  }, [kaiData]);

  const extraEmbed = useMemo(() => {
    if (!isPlainObj(embed)) return null;
    return JSON.parse(safeStringify(embed)) as Record<string, unknown>;
  }, [embed]);

  /* ⬇️ NEW: flatten KlockData into data-* attributes (for DOM/indexers) */
  const klockDataAttrs = useMemo<DataAttrs>(() => {
    if (!klockIsoSnapshot) return {};
    return flattenAsDataAttrs("klock", klockIsoSnapshot);
  }, [klockIsoSnapshot]);

  const eternalMonth = getStrField(klock, "eternalMonth");
  const harmonicDay = getStrField(klock, "harmonicDay");
  const kaiPulseEternal = getNumField(klock, "kaiPulseEternal");
  const solarChakraStepString = getStrField(klock, "solarChakraStepString");
  const chakraArc = getStrField(klock, "chakraArc");

  return (
    <svg
      ref={svgRef}
      id={uid}
      role="img"
      aria-describedby={descId}
      lang="en"
      aria-label={`Kairos sigil — pulse ${pulse}`}
      viewBox={`0 0 ${SPACE} ${SPACE}`}
      width={size}
      height={size}
      shapeRendering="geometricPrecision"
      style={
        {
          background: "transparent",
          "--dur": `${durMs}ms`,
          "--off": `${offMs}ms`,
          "--pulse": `${PULSE_MS}ms`,
          cursor: absoluteShareUrl ? "pointer" : "default",
        } as React.CSSProperties
      }
      data-pulse={pulse}
      data-beat={beat}
      data-step-index={stepIndex}
      data-frequency-hz={frequencyHz}
      data-chakra-gate={chakraGate}
      data-quality={quality}
      data-golden-id={goldenId ?? undefined}
      data-kai-signature={kaiSignature ?? undefined}
      data-phi-key={userPhiKey ?? undefined}
      data-payload-hash={payloadHashHex ?? undefined}
      data-zk-scheme={zkScheme ?? undefined}
      data-zk-poseidon-hash={zkPoseidonHash ?? undefined}
      data-share-url={shareUrl || undefined}
      /* ⬇️ NEW: high-signal top-level markers for fast scrapers */
      data-eternal-seal={eternalSeal ?? undefined}
      data-eternal-month={eternalMonth ?? undefined}
      data-harmonic-day={harmonicDay ?? undefined}
      data-kai-pulse-eternal={
        typeof kaiPulseEternal === "number" ? String(kaiPulseEternal) : undefined
      }
      data-solar-chakra-step={solarChakraStepString ?? undefined}
      data-arc={chakraArc ?? undefined}
      /* ⬇️ NEW: spread ALL flattened KlockData fields safely (no any) */
      {...klockDataAttrs}
      /* ⬇️ valuation data (sealed + live, visual-free) */
      data-valuation-algorithm={mintSeal?.algorithm ?? undefined}
      data-valuation-policy={mintSeal?.policyId ?? undefined}
      data-valuation-policy-checksum={mintSeal?.policyChecksum ?? undefined}
      data-valuation-stamp={mintSeal?.stamp ?? undefined}
      data-valuation-premium={mintSeal?.premium ?? undefined}
      data-valuation-value-phi={mintSeal?.valuePhi ?? undefined}
      data-valuation-computed-at={mintSeal?.computedAtPulse ?? undefined}
      data-value-phi-live={
        typeof liveValuePhi === "number" ? liveValuePhi : undefined
      }
    >
      <title>{`Kairos HarmoniK Sigil • Pulse ${pulse}`}</title>
      <desc id={descId}>↳ {summary}</desc>

      {/* Safe canonical metadata embedding (escaped / CDATA). Includes header.shareUrl and sealed valuation */}
      {embeddedMetaJson && (
        <metadata>{`<![CDATA[${embeddedMetaJson}]]>`}</metadata>
      )}

      {/* ⬇️ NEW: FULL snapshots — everything in the SVG, zero QR */}
      {klockIsoSnapshot && (
        <metadata id={`${uid}-klock-json`}>{`<![CDATA[${safeStringify(
          klockIsoSnapshot
        )}]]>`}</metadata>
      )}
      {apiSnapshot && (
        <metadata id={`${uid}-kai-api-json`}>{`<![CDATA[${safeStringify(
          apiSnapshot
        )}]]>`}</metadata>
      )}
      {eternalSeal && (
        <metadata id={`${uid}-eternal-seal`}>{`<![CDATA[${eternalSeal}]]>`}</metadata>
      )}
      {extraEmbed && (
        <metadata id={`${uid}-extra-embed`}>{`<![CDATA[${safeStringify(
          extraEmbed
        )}]]>`}</metadata>
      )}

      {/* convenience blobs for quick parsers */}
      {mintSeal && (
        <metadata id={`${uid}-valuation-seal-json`}>{`<![CDATA[${JSON.stringify(
          mintSeal
        )}]]>`}</metadata>
      )}
      {valuationMetaRef.current && (
        <metadata id={`${uid}-valuation-source-json`}>{`<![CDATA[${JSON.stringify(
          valuationMetaRef.current
        )}]]>`}</metadata>
      )}
      <metadata id={`${uid}-valuation-runtime-json`}>{`<![CDATA[${JSON.stringify(
        {
          PULSE_MS,
          STEPS_BEAT,
          PHI,
          algorithm: "computeIntrinsicUnsigned",
          version: "1",
        }
      )}]]>`}</metadata>
      <metadata id="sigil-display">{`{"stepIndex":${stepIndex},"stepsPerBeat":${STEPS_BEAT}}`}</metadata>

      <defs>
        <radialGradient id={`${uid}-halo`} cx="50%" cy="50%" r="50%">
          <stop
            offset="0%"
            stopColor={hsl(
              hue,
              100,
              50 + 15 * Math.sin(visualClamped * 2 * Math.PI)
            )}
            stopOpacity=".55"
          >
            {doAnim && quality !== "low" && (
              <animate
                attributeName="stop-opacity"
                values=".35;.75;.35"
                dur={`var(--dur)`}
                begin={`var(--off)`}
                repeatCount="indefinite"
              />
            )}
          </stop>
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>

        {quality !== "low" && dpr > 1 && (
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}

        {quality === "ultra" && (
          <filter id={bloomId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="u" />
            <feBlend in="SourceGraphic" in2="u" mode="screen" />
          </filter>
        )}

        <path id={auraId} d={auraPath} />

        {kaiSignature && (
          <path
            id={sigPathId}
            d={`M ${CENTER} ${CENTER - SPACE * 0.46}
                a ${SPACE * 0.46} ${SPACE * 0.46} 0 1 1 0 ${SPACE * 0.92}
                a ${SPACE * 0.46} ${SPACE * 0.46} 0 1 1 0 -${SPACE * 0.92}`}
            fill="none"
          />
        )}

        <mask id={maskId}>
          <rect width="100%" height="100%" fill="white" />
        </mask>

        <pattern
          id={netId}
          patternUnits="userSpaceOnUse"
          width="160"
          height="160"
          patternTransform={`rotate(${
            (pulse * 7 + beat * 11) % 60
          } ${CENTER} ${CENTER})`}
        >
          <path
            d="M0 80 H160 M80 0 V160 M160 0 L0 160 M0 0 L160 160"
            stroke="#00FFD0"
            strokeOpacity=".06"
            strokeWidth="1"
          />
        </pattern>

        <filter id={warpId} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.006"
            numOctaves="2"
            seed={(seed % 997) + 3}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={0.35 + (hashNibble % 7) * 0.05}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>

      <Wrapper>
        <g id={`${uid}-tilt`} style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}>
          {doAnim && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              values={`-2 ${CENTER} ${CENTER};2 ${CENTER} ${CENTER};-2 ${CENTER} ${CENTER}`}
              dur={`var(--dur)`}
              begin={`var(--off)`}
              repeatCount="indefinite"
            />
          )}

          {/* Warped background/art */}
          <g id={`${uid}-art`} filter={`url(#${warpId})`}>
            <rect
              width={SPACE}
              height={SPACE}
              fill={`url(#${uid}-halo)`}
              aria-hidden="true"
              pointerEvents="none"
            />
            <rect
              x="0"
              y="0"
              width={SPACE}
              height={SPACE}
              fill={`url(#${netId})`}
              pointerEvents="none"
            />

            {/* (moved) zkGlyph now renders OUTSIDE this warp so it stays perfectly centered */}

            <path
              d={corePath}
              fill="none"
              stroke={phaseColor}
              strokeWidth={strokeCore}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
              mask={`url(#${maskId})`}
              filter={
                quality !== "low" && dpr > 1 ? `url(#${glowId})` : undefined
              }
              style={{
                strokeDasharray: debugOutline || prefersContrast ? "4 4" : undefined,
              }}
              aria-hidden="true"
              pointerEvents="none"
            />

            {(debugOutline || prefersContrast) && (
              <path
                d={corePath}
                fill="none"
                stroke={TEAL}
                strokeWidth={Math.max(1, strokeCore * 0.45)}
                vectorEffect="non-scaling-stroke"
                opacity={0.6}
                aria-hidden="true"
                pointerEvents="none"
              />
            )}

            {quality !== "low" &&
              Array.from(
                { length: CHAKRAS[chakraDay as ChakraKey].sides },
                (_: unknown, i: number) => {
                  const sidesLocal = CHAKRAS[chakraDay as ChakraKey].sides;
                  const θ = (i / sidesLocal) * 2 * Math.PI + rotation;
                  const r = SPACE * 0.38;
                  const x = CENTER + r * Math.cos(θ);
                  const y = CENTER + r * Math.sin(θ);
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={dotR}
                      fill={baseColor}
                      style={{
                        filter:
                          quality !== "ultra" && dpr > 1
                            ? `drop-shadow(0 0 4px ${baseColor})`
                            : undefined,
                      }}
                      aria-hidden="true"
                      pointerEvents="none"
                    />
                  );
                }
              )}

            {doAnim && (
              <>
                <use
                  href={`#${auraId}`}
                  stroke={TEAL}
                  strokeWidth={Math.max(2, strokeCore * 1.05)}
                  fill="none"
                  opacity=".2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  style={{
                    filter:
                      quality !== "low" && dpr > 1
                        ? "drop-shadow(0 0 6px #00FFD0AA)"
                        : undefined,
                  }}
                  aria-hidden="true"
                  pointerEvents="none"
                >
                  <animate
                    attributeName="stroke-opacity"
                    values=".2;.6;.2"
                    dur={`var(--dur)`}
                    begin={`var(--off)`}
                    repeatCount="indefinite"
                  />
                </use>
                <use
                  href={`#${auraId}`}
                  stroke={phaseColor}
                  strokeWidth={Math.max(1.2, strokeCore * 0.8)}
                  fill="none"
                  opacity=".4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  style={{
                    filter:
                      quality !== "low" && dpr > 1
                        ? `drop-shadow(0 0 4px ${phaseColor}AA)`
                        : undefined,
                  }}
                  aria-hidden="true"
                  pointerEvents="none"
                >
                  <animate
                    attributeName="stroke-opacity"
                    values=".4;.9;.4"
                    dur={`var(--dur)`}
                    begin={`var(--off)`}
                    repeatCount="indefinite"
                  />
                </use>
              </>
            )}

            <circle
              cx={CENTER}
              cy={CENTER}
              r={Math.max(3, dotR)}
              fill={TEAL}
              style={{
                filter:
                  quality !== "low" && dpr > 1
                    ? `url(#${quality === "ultra" ? bloomId : glowId})`
                    : undefined,
              }}
              aria-hidden="true"
              pointerEvents="none"
            >
              {doAnim && (
                <animateTransform
                  attributeName="transform"
                  type="scale"
                  values="1;1.5;1"
                  dur={`var(--dur)`}
                  begin={`var(--off)`}
                  repeatCount="indefinite"
                />
              )}
            </circle>

            {quality !== "low" && kaiSignature && binaryForRender && (
              <g id="signature" data-kai-signature={kaiSignature}>
                <text
                  fontFamily={FONT_STACK}
                  fontSize={Math.max(4, (size ?? 240) * 0.028)}
                  fill={baseColor}
                  letterSpacing="1.2"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  opacity=".7"
                  pointerEvents="none"
                >
                  <textPath href={`#${sigPathId}`} startOffset="50%">
                    {binaryForRender}
                  </textPath>
                </text>
              </g>
            )}

            <g id="signature-hint" aria-hidden="true" pointerEvents="none">
              <text
                x={pad}
                y={(size ?? 240) - 6}
                fontFamily={FONT_STACK}
                fontSize={Math.max(4, (size ?? 240) * 0.025)}
                fill={baseColor}
                opacity=".12"
                textAnchor="start"
                lengthAdjust="spacingAndGlyphs"
                textLength={safeTextWidth}
                style={{
                  paintOrder: "stroke",
                  stroke: "#000",
                  strokeWidth: prefersContrast ? outlineWidth * 1.2 : outlineWidth,
                  fontVariantNumeric: "tabular-nums",
                  fontFeatureSettings: "'tnum' 1",
                }}
              >
                {summary}
              </text>

              <text
                x={(size ?? 240) - pad}
                y={(size ?? 240) - pad}
                fontFamily={FONT_STACK}
                fontSize={(size ?? 240) * 0.25}
                fill={baseColor}
                opacity="0.04"
                textAnchor="end"
                dominantBaseline="ideographic"
                lengthAdjust="spacingAndGlyphs"
                textLength={safeTextWidth}
                vectorEffect="non-scaling-stroke"
                style={{
                  paintOrder: "stroke",
                  stroke: "#000",
                  strokeWidth: outlineWidth,
                  fontVariantNumeric: "tabular-nums",
                  fontFeatureSettings: "'tnum' 1",
                }}
              >
                {pulse.toLocaleString?.() ?? String(pulse)}
              </text>
            </g>
          </g>

          {/* ZK glyph moved OUTSIDE the warp so it stays perfectly centered */}
          {zkGlyph}
        </g>

        {/* QR intentionally removed. Mount it from SigilPage with <KaiQR /> */}
      </Wrapper>
    </svg>
  );
});

KaiSigil.displayName = "KaiSigil";
export default KaiSigil;
