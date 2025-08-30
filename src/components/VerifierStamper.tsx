/* ────────────────────────────────────────────────────────────────
   VerifierStamper.tsx · Divine Sovereign Transfer Gate (mobile-first)
   v14.3 — Sovereign hardening+++ (ECDSA + optional ZK bind)
   • Auto-loads /verification_key.json into window.SIGIL_ZK_VKEY
   • Parallel hardened lineage (ECDSA P-256) over canonical leaves
   • Optional Groth16 ZK stamps bound to the same leaves, fully offline verified
   • Fully offline verifiable; zero network trust
   • SEND signs sender-side transfer leaf; RECEIVE signs full leaf
────────────────────────────────────────────────────────────────── */

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import "./VerifierStamper.css";

/* ── Explorer + Seal modals ─────────────────────────────────── */
import SealMomentModal from "./SealMomentModal";
import SigilExplorer from "./SigilExplorer";
import ValuationModal from "./ValuationModal";
import { buildValueSeal, type SigilMetadataLite, type ValueSeal } from "../utils/valuation"; // ← ADDED buildValueSeal

/* Project utils (types + URL helper) */
import { makeSigilUrl, type SigilSharePayloadLoose } from "../utils/sigilUrl";
import { encodeSigilHistory } from "../utils/sigilUrl";
import type { SigilTransferLite } from "../utils/sigilUrl";

/* ═════════════════ CONSTANTS ═════════════════ */
const PULSE_MS = 5_236 as const;
const GENESIS_TS = Date.UTC(2024, 4, 10, 6, 45, 41, 888);
const kaiPulseNow = () => Math.floor((Date.now() - GENESIS_TS) / PULSE_MS);

const SIGIL_CTX = "https://schema.phi.network/sigil/v1" as const;
const SIGIL_TYPE = "application/phi.kairos.sigil+svg" as const;

/* ───────────────── SEGMENT / PROOFS POLICY ──────────────── */
const SEGMENT_SIZE = 2_000 as const; // head-window live transfers cap before rolling a segment

/* ═════════════════ TYPES ═════════════════ */
interface SigilPayload {
  name: string;
  mime: string;
  size: number;
  encoded: string; // base64 (no data: prefix)
}

interface SigilTransfer {
  // Sender side
  senderSignature: string;
  senderStamp: string; // hash(liveSig|meta.pulse|nowPulse)
  senderKaiPulse: number;

  // Optional payload (filename/mime/size only kept in metadata; bytes in payload.encoded)
  payload?: SigilPayload;

  // Receiver side (present only after receive)
  receiverSignature?: string;
  receiverStamp?: string; // hash(receiverSig|senderStamp|nowPulse)
  receiverKaiPulse?: number;
}

/* ───────────────── v14 add-only hardened lineage ─────────────── */
type B64uSPKI = string;
type HashHex = string;

/** Full ZK bundle (optional) kept alongside stamps for full offline verification */
interface ZkBundle {
  scheme: "groth16" | string;
  curve?: string; // e.g. "BLS12-381"
  proof: unknown;
  publicSignals: unknown;
  vkey?: unknown; // optional inline vkey
}

/** Minimal ZK stamp bound to the leaf to keep lineage tiny/immutable */
interface ZkStamp {
  scheme: "groth16" | "plonk" | string;
  curve?: string; // e.g. "BLS12-381"
  publicHash: HashHex; // sha256(stable(publicSignals))
  proofHash: HashHex; // sha256(stable(proof))
  vkeyHash?: HashHex; // sha256(stable(vkey)) if provided
  verified?: boolean; // set by offline verifier
}

/** Canonical, signed lineage (kept in parallel; legacy untouched) */
interface HardenedTransferV14 {
  previousHeadRoot: string; // head snapshot hash *before* this transfer
  senderPubKey: B64uSPKI; // base64url(SPKI)
  senderSig: string; // base64url(ECDSA over canonical SEND)
  senderKaiPulse: number;
  nonce: string; // random 16B hex captured at send-time

  // Bind legacy window content immutably
  transferLeafHashSend: HashHex; // hash over sender-side leaf (sender fields + payload only)

  // Optional ZK proof & stamp for SEND (bound to sender-side leaf)
  zkSend?: ZkStamp;
  zkSendBundle?: ZkBundle;

  // Receive seal (optional if accepted)
  receiverPubKey?: B64uSPKI; // base64url(SPKI)
  receiverSig?: string; // base64url(ECDSA over canonical RECEIVE)
  receiverKaiPulse?: number;

  // Full leaf after receive (includes receiver fields)
  transferLeafHashReceive?: HashHex;

  // Optional ZK proof & stamp for RECEIVE (bound to full leaf)
  zkReceive?: ZkStamp;
  zkReceiveBundle?: ZkBundle;
}

/* ── Segments & proofs (head stays tiny, history is archived) */
interface SegmentEntry {
  index: number; // 0..N
  root: HashHex; // merkle root over that segment's transfers
  cid: HashHex; // SHA-256 of the segment JSON blob
  count: number; // transfers in this segment
}

interface SegmentFile {
  version: 1;
  segmentIndex: number;
  segmentRange: [number, number]; // global index range [start, end]
  segmentRoot: HashHex;
  headHashAtSeal: HashHex; // hash of head snapshot when sealed
  leafHash: "sha256";
  transfers: SigilTransfer[]; // frozen
}

interface TransferProof {
  leaf: HashHex; // hash(transfer-json-minified)
  index: number; // leaf index within the window/segment
  siblings: HashHex[]; // path to root (bottom-up)
}

interface SegmentProofBundle {
  kind: "segment";
  segmentIndex: number;
  segmentRoot: HashHex;
  transferProof: TransferProof; // proves transfer ∈ segmentRoot
  segmentsSiblings: HashHex[]; // proves segmentRoot ∈ head.segmentsMerkleRoot
  headHashAtSeal: HashHex;
}

interface HeadWindowProofBundle {
  kind: "head";
  windowMerkleRoot: HashHex; // head-window root
  transferProof: TransferProof; // proves transfer ∈ window root
}

interface SigilMetadata {
  ["@context"]?: string;
  type?: string;

  pulse?: number;
  beat?: number;
  stepIndex?: number;
  chakraDay?: string;
  chakraGate?: string;
  frequencyHz?: number;

  kaiPulse?: number;
  kaiSignature?: string;
  userPhiKey?: string;
  intentionSigil?: string;

  creatorPublicKey?: string; // (optional) base64url(SPKI). UI never labels this "public key"
  origin?: string;

  kaiPulseToday?: number;
  kaiMomentSummary?: string;

  transfers?: SigilTransfer[];

  // Segmented history (new)
  segmentSize?: number; // policy (default SEGMENT_SIZE)
  segments?: SegmentEntry[]; // archived segments (roots + counts + cids)
  segmentsMerkleRoot?: HashHex; // root over SegmentEntry.root (ordered by index)
  transfersWindowRoot?: HashHex; // merkle root over current head-window transfers
  cumulativeTransfers?: number; // total transfers across segments + head-window
  headHashAtSeal?: HashHex; // last head snapshot hash at segment seal

  // page-style extras
  canonicalHash?: string;
  transferNonce?: string;

  /* v14 parallel hardened lineage (add-only; legacy untouched) */
  hardenedTransfers?: HardenedTransferV14[];
  transfersWindowRootV14?: HashHex;

  /* Optional inline verifying key for ZK proofs (non-breaking) */
  zkVerifyingKey?: unknown;

  [k: string]: unknown;
}

type UiState =
  | "idle"
  | "invalid"
  | "structMismatch"
  | "sigMismatch"
  | "notOwner"
  | "unsigned"
  | "readySend"
  | "readyReceive"
  | "complete"
  | "verified";

type TabKey = "summary" | "lineage" | "data";

/* ChakraDay helper (to satisfy SigilSharePayloadLoose['chakraDay']) */
const CHAKRA_DAYS = [
  "Root",
  "Sacral",
  "Solar Plexus",
  "Heart",
  "Throat",
  "Third Eye",
  "Crown",
] as const;
type ChakraDay = (typeof CHAKRA_DAYS)[number];

const CHAKRA_DAY_MAP: Record<string, ChakraDay> = CHAKRA_DAYS.reduce((acc, v) => {
  acc[v.toLowerCase()] = v;
  return acc;
}, {} as Record<string, ChakraDay>);

function normalizeChakraDay(input: unknown): ChakraDay | null {
  if (typeof input !== "string") return null;
  const key = input.trim().toLowerCase();
  return CHAKRA_DAY_MAP[key] ?? null;
}

/* ═════════════ CRYPTO ═════════════ */
const bytesToHex = (u8: Uint8Array) =>
  Array.from(u8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

async function sha256Hex(msg: string | Uint8Array): Promise<string> {
  const data = typeof msg === "string" ? new TextEncoder().encode(msg) : msg;
  const buf = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(buf));
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Encode(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) + BigInt(b);
  let out = "";
  while (n > 0n) {
    const mod = Number(n % 58n);
    out = B58[mod] + out;
    n /= 58n;
  }
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) out = "1" + out;
  return out;
}
async function base58Check(payload: Uint8Array, version = 0x00): Promise<string> {
  const v = new Uint8Array(1 + payload.length);
  v[0] = version;
  v.set(payload, 1);
  const c1 = await crypto.subtle.digest("SHA-256", v);
  const c2 = await crypto.subtle.digest("SHA-256", c1);
  const checksum = new Uint8Array(c2).slice(0, 4);
  const full = new Uint8Array(v.length + 4);
  full.set(v);
  full.set(checksum, v.length);
  return base58Encode(full);
}

/* base64url helpers (for SPKI + signatures) */
const b64u = {
  encode(bytes: Uint8Array): string {
    const b64 = btoa(String.fromCharCode(...bytes));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  },
  decode(s: string): Uint8Array {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

/* Φ from PUBLIC KEY bytes (SPKI → SHA-256 → first 20 bytes → Base58Check)
   NOTE: we DO NOT change UI text or throw mismatch; this is silent binding. */
async function phiFromPublicKey(spkiB64u: string): Promise<string> {
  const spki = b64u.decode(spkiB64u);
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", spki));
  return base58Check(h.slice(0, 20), 0x00);
}

/* Local keystore (ECDSA P-256) — sovereign, offline */
type Keypair = { priv: CryptoKey; pub: CryptoKey; spkiB64u: string };
const KEY_PRIV = "kairos:key:pkcs8";
const KEY_PUB = "kairos:key:spki";

async function importPriv(pkcs8: ArrayBuffer) {
  return crypto.subtle.importKey("pkcs8", pkcs8, { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
}
async function importPub(spki: ArrayBuffer) {
  return crypto.subtle.importKey("spki", spki, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
}
async function loadOrCreateKeypair(): Promise<Keypair> {
  let pkcs8B64 = localStorage.getItem(KEY_PRIV);
  const spkiB64 = localStorage.getItem(KEY_PUB);
  if (pkcs8B64 && spkiB64) {
    return {
      priv: await importPriv(b64u.decode(pkcs8B64).buffer),
      pub: await importPub(b64u.decode(spkiB64).buffer),
      spkiB64u: spkiB64,
    };
  }
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
  const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
  pkcs8B64 = b64u.encode(new Uint8Array(pkcs8));
  const spkiB64u = b64u.encode(new Uint8Array(spki));
  localStorage.setItem(KEY_PRIV, pkcs8B64);
  localStorage.setItem(KEY_PUB, spkiB64u);
  return { priv: pair.privateKey, pub: pair.publicKey, spkiB64u };
}
async function signB64u(priv: CryptoKey, msg: Uint8Array) {
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, priv, msg);
  return b64u.encode(new Uint8Array(sig));
}
async function verifySig(pubB64u: string, msg: Uint8Array, sigB64u: string): Promise<boolean> {
  const pub = await importPub(b64u.decode(pubB64u).buffer);
  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pub, b64u.decode(sigB64u), msg);
}

/* ═════════════ HELPERS ═════════════ */
const fileToPayload = (file: File): Promise<SigilPayload> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const encoded = String(r.result).split(",")[1] ?? "";
      res({ name: file.name, mime: file.type, size: file.size, encoded });
    };
    r.onerror = rej;
    r.readAsDataURL(file);
  });

function getAttr(svg: string, key: string): string | undefined {
  const m = svg.match(new RegExp(`${key}="([^"]+)"`, "i"));
  return m ? m[1] : undefined;
}
function getIntAttr(svg: string, key: string): number | undefined {
  const v = getAttr(svg, key);
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function extractMetadataJSON(svg: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const meta = doc.querySelector("metadata");
    return meta ? meta.textContent ?? null : null;
  } catch {
    return null;
  }
}

async function parseSvgFile(file: File) {
  const text = await file.text();

  // 1) <metadata> JSON
  let meta: SigilMetadata = {};
  const raw = extractMetadataJSON(text);
  if (raw) {
    try {
      meta = JSON.parse(raw) as SigilMetadata;
    } catch {
      // ignore, continue with attrs
    }
  }

  // 2) attribute fallbacks / mirrors
  meta.pulse ??= getIntAttr(text, "data-pulse");
  meta.beat ??= getIntAttr(text, "data-beat");
  meta.stepIndex ??= getIntAttr(text, "data-step-index");
  meta.frequencyHz ??= (() => {
    const v = getAttr(text, "data-frequency-hz");
    return v ? Number(v) : undefined;
  })();
  meta.chakraGate ??= getAttr(text, "data-chakra-gate");

  if (!meta.chakraDay) {
    const dayAttr = getAttr(text, "data-harmonic-day") || getAttr(text, "data-chakra-day");
    if (dayAttr) meta.chakraDay = dayAttr;
  }

  meta.kaiSignature ??= getAttr(text, "data-kai-signature");
  meta.userPhiKey ??= getAttr(text, "data-phi-key");

  const contextOk = !meta["@context"] || meta["@context"] === SIGIL_CTX;
  const typeOk = !meta.type || meta.type === SIGIL_TYPE;

  return { text, meta, contextOk, typeOk };
}

/* recompute content signature */
async function computeKaiSignature(meta: SigilMetadata): Promise<string | null> {
  const { pulse, beat, stepIndex, chakraDay } = meta;
  if (
    typeof pulse !== "number" ||
    typeof beat !== "number" ||
    typeof stepIndex !== "number" ||
    typeof chakraDay !== "string"
  ) {
    return null;
  }
  const base = `${pulse}|${beat}|${stepIndex}|${chakraDay}|${meta.intentionSigil ?? ""}`;
  return sha256Hex(base);
}

/* derive PhiKey from kaiSignature (legacy) */
async function derivePhiKeyFromSig(sig: string): Promise<string> {
  const s = await sha256Hex(sig + "φ");
  const raw = new Uint8Array(20);
  for (let i = 0; i < 20; i++) raw[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return base58Check(raw, 0x00);
}

/* centre-pixel live signature (legacy cosmetic) */
async function centrePixelSignature(url: string, pulseForSeal: number) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();

  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext("2d");
  if (!g) throw new Error("Canvas 2D context unavailable");
  g.drawImage(img, 0, 0);
  const { data } = g.getImageData(Math.floor(img.width / 2), Math.floor(img.height / 2), 1, 1);
  const rgb: [number, number, number] = [data[0], data[1], data[2]];
  const sig = (await sha256Hex(`${pulseForSeal}-2:3-${rgb.join(",")}`)).slice(0, 32);
  return { sig, rgb };
}

/* embed updated <metadata> JSON into SVG and return data: URL */
async function embedMetadata(svgURL: string, meta: SigilMetadata) {
  const raw = await fetch(svgURL).then((r) => r.text());
  const json = JSON.stringify(meta, null, 2);
  const updated = raw.match(/<metadata[^>]*>/i)
    ? raw.replace(/<metadata[^>]*>[\s\S]*?<\/metadata>/i, `<metadata>${json}</metadata>`)
    : raw.replace(/<svg([^>]*)>/i, `<svg$1><metadata>${json}</metadata>`);
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(updated)))}`;
}

/* helpers */
export function isoNow(): string {
  return new Date().toISOString();
}

export function safeFilename(prefix: string, pulse: number): string {
  const iso = isoNow().replace(/[:.]/g, "-"); // path-safe
  return `${prefix}_${pulse}_${iso}`;
}

/* NEW: deterministic sender/receiver export naming — strictly pulses (no ISO) */
export function pulseFilename(prefix: string, sigilPulse: number, eventPulse: number): string {
  return `${prefix}_${sigilPulse}_${eventPulse}`;
}

export function download(dataUrlOrBlob: string | Blob, fname: string): void {
  const a = document.createElement("a");
  if (typeof dataUrlOrBlob === "string") {
    a.href = dataUrlOrBlob;
  } else {
    const url = URL.createObjectURL(dataUrlOrBlob);
    a.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  a.download = fname;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* Determine UI state from facts */
function deriveState(params: {
  contextOk: boolean;
  typeOk: boolean;
  hasCore: boolean;
  contentSigMatches: boolean | null;
  isOwner: boolean | null;
  hasTransfers: boolean;
  lastOpen: boolean; // last transfer exists and receiverSignature missing
  isUnsigned: boolean;
}): UiState {
  const { contextOk, typeOk, hasCore, contentSigMatches, isOwner, hasTransfers, lastOpen, isUnsigned } = params;

  if (!contextOk || !typeOk) return "invalid";
  if (!hasCore) return "structMismatch";
  if (contentSigMatches === false) return "sigMismatch";
  if (isOwner === false) return "notOwner";
  if (isUnsigned) return "unsigned";
  if (!hasTransfers) return "readySend";
  if (lastOpen) return "readyReceive";
  return "complete";
}

/* ──────────────────────────────────────────────────────────────
   SigilPage-style helpers for share URL + ZIP export
─────────────────────────────────────────────────────────────── */

/** url-safe JSON (exactly as in SigilPage flow) */
function base64urlJson(obj: unknown): string {
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Build compact history array from current metadata (URL-safe, no bloat). */
function toLiteHistory(m: SigilMetadata): SigilTransferLite[] {
  const arr: SigilTransferLite[] = [];
  for (const t of m.transfers ?? []) {
    if (!t || typeof t.senderSignature !== "string" || typeof t.senderKaiPulse !== "number") continue;
    const lite: SigilTransferLite = {
      s: t.senderSignature,
      p: t.senderKaiPulse,
    };
    if (typeof t.receiverSignature === "string" && t.receiverSignature) {
      lite.r = t.receiverSignature;
    }
    arr.push(lite);
  }
  return arr;
}

/** Append ?p= (and ?t= if provided) to a base URL; optionally add &h= */
function rewriteUrlPayload(
  baseUrl: string,
  enriched: SigilSharePayloadLoose & {
    canonicalHash?: string;
    transferNonce?: string;
  },
  token?: string,
  historyParam?: string // <- optional compact history value (WITHOUT 'h:' prefix)
): string {
  const u = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  u.searchParams.set("p", base64urlJson(enriched));
  if (token) u.searchParams.set("t", token);
  if (historyParam && historyParam.length > 0) {
    // We store the value without 'h:' so decoders can do: decodeSigilHistory('h:' + param)
    u.searchParams.set("h", historyParam);
  }
  return u.toString();
}

/** quick random 16-byte token (hex) */
function genNonce() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** minimal PNG rendering for the ZIP export */
async function pngBlobFromSvgDataUrl(svgDataUrl: string, px = 1024): Promise<Blob> {
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = rej;
    img.src = svgDataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  // cover / center
  ctx.clearRect(0, 0, px, px);
  ctx.drawImage(img, 0, 0, px, px);
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encode failed"))), "image/png")
  );
  return blob;
}

/* ═════════════ MERKLE HELPERS (lightweight) ═════════════ */
async function hashPair(a: HashHex, b: HashHex): Promise<HashHex> {
  const ab = new TextEncoder().encode(a + "|" + b);
  return sha256Hex(ab);
}

// Build merkle root (binary; duplicate last at odd levels)
async function buildMerkleRoot(leaves: HashHex[]): Promise<HashHex> {
  if (leaves.length === 0) return "0".repeat(64);
  let level = leaves.slice();
  while (level.length > 1) {
    const next: HashHex[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const L = level[i];
      const R = i + 1 < level.length ? level[i + 1] : level[i];
      const [a, b] = L <= R ? [L, R] : [R, L]; // order-independence
      // eslint-disable-next-line no-await-in-loop
      next.push(await hashPair(a, b));
    }
    level = next;
  }
  return level[0];
}

async function merkleProof(leaves: HashHex[], index: number): Promise<TransferProof> {
  if (leaves.length === 0) return { leaf: "0".repeat(64), index: 0, siblings: [] };
  let idx = index;
  let level = leaves.slice();
  const siblings: HashHex[] = [];
  while (level.length > 1) {
    const isRight = idx % 2 === 1;
    const sibIdx = isRight ? idx - 1 : idx + 1;
    const sibling = level[sibIdx] ?? level[idx]; // duplicate at edge
    siblings.push(sibling);

    const next: HashHex[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const L = level[i];
      const R = i + 1 < level.length ? level[i + 1] : level[i];
      // eslint-disable-next-line no-await-in-loop
      next.push(await hashPair(L <= R ? L : R, L <= R ? R : L));
    }
    level = next;
    idx = Math.floor(idx / 2);
  }
  return { leaf: leaves[index], index, siblings };
}

async function verifyProof(root: HashHex, proof: TransferProof): Promise<boolean> {
  let acc = proof.leaf;
  let idx = proof.index;
  for (const sib of proof.siblings) {
    const pair = idx % 2 === 0 ? [acc, sib] : [sib, acc];
    // eslint-disable-next-line no-await-in-loop
    acc = await hashPair(pair[0] <= pair[1] ? pair[0] : pair[1], pair[0] <= pair[1] ? pair[1] : pair[0]);
    idx = Math.floor(idx / 2);
  }
  return acc === root;
}

function minifyTransfer(t: SigilTransfer): string {
  const obj: Record<string, unknown> = {
    senderSignature: t.senderSignature,
    senderStamp: t.senderStamp,
    senderKaiPulse: t.senderKaiPulse,
  };
  if (t.payload) obj.payload = { name: t.payload.name, mime: t.payload.mime, size: t.payload.size };
  if (t.receiverSignature) obj.receiverSignature = t.receiverSignature;
  if (t.receiverStamp) obj.receiverStamp = t.receiverStamp;
  if (t.receiverKaiPulse != null) obj.receiverKaiPulse = t.receiverKaiPulse;
  return JSON.stringify(obj);
}
async function hashTransfer(t: SigilTransfer): Promise<HashHex> {
  return sha256Hex(minifyTransfer(t));
}

/* Sender-side-only leaf (stable across receive) */
function minifyTransferSenderSide(t: SigilTransfer): string {
  const obj: Record<string, unknown> = {
    senderSignature: t.senderSignature,
    senderStamp: t.senderStamp,
    senderKaiPulse: t.senderKaiPulse,
  };
  if (t.payload) obj.payload = { name: t.payload.name, mime: t.payload.mime, size: t.payload.size };
  return JSON.stringify(obj);
}
async function hashTransferSenderSide(t: SigilTransfer): Promise<HashHex> {
  return sha256Hex(minifyTransferSenderSide(t));
}

async function computeHeadWindowRoot(transfers: SigilTransfer[]): Promise<HashHex> {
  const leaves = await Promise.all(transfers.map(hashTransfer));
  return buildMerkleRoot(leaves);
}

/* v14: deterministic snapshot for prev-head pinning (parallel; does not change legacy) */
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(o[k])).join(",") + "}";
}
async function headCanonicalHashV14(meta: SigilMetadata, cumulativeOverride?: number): Promise<HashHex> {
  const snapshot = {
    pulse: meta.pulse ?? 0,
    beat: meta.beat ?? 0,
    stepIndex: meta.stepIndex ?? 0,
    chakraDay: meta.chakraDay ?? "",
    kaiSignature: meta.kaiSignature ?? "",
    creatorPublicKey: meta.creatorPublicKey ?? "",
    cumulativeTransfers: (cumulativeOverride ?? meta.cumulativeTransfers) ?? 0,
    segments: (meta.segments ?? []).map((s) => ({ index: s.index, root: s.root, cid: s.cid, count: s.count })),
    segmentsMerkleRoot: meta.segmentsMerkleRoot ?? "",
  };
  return sha256Hex(stableStringify(snapshot));
}
function sumSegments(meta: SigilMetadata) {
  return (meta.segments ?? []).reduce((a, s) => a + (s.count || 0), 0);
}
async function expectedPrevHeadRootV14(meta: SigilMetadata, indexWithinWindow: number): Promise<HashHex> {
  const baseCum = sumSegments(meta);
  return headCanonicalHashV14(meta, baseCum + indexWithinWindow);
}

/* v14 canonical messages (bind transfer leaf hashes) */
function buildSendMessageV14(
  meta: SigilMetadata,
  args: {
    previousHeadRoot: string;
    senderKaiPulse: number;
    senderPubKey: B64uSPKI;
    nonce: string;
    transferLeafHashSend: HashHex;
  }
) {
  const chakraDay: ChakraDay = normalizeChakraDay(meta.chakraDay) ?? "Root";
  const body = {
    v: 1,
    type: "send" as const,
    sigil: {
      pulse: meta.pulse ?? 0,
      beat: meta.beat ?? 0,
      stepIndex: meta.stepIndex ?? 0,
      chakraDay,
      kaiSignature: meta.kaiSignature ?? "",
    },
    previousHeadRoot: args.previousHeadRoot,
    senderKaiPulse: args.senderKaiPulse,
    senderPubKey: args.senderPubKey,
    nonce: args.nonce,
    transferLeafHashSend: args.transferLeafHashSend,
  };
  return new TextEncoder().encode(stableStringify(body));
}
function buildReceiveMessageV14(args: {
  previousHeadRoot: string;
  senderSig: string;
  receiverKaiPulse: number;
  receiverPubKey: B64uSPKI;
  transferLeafHashReceive: HashHex;
}) {
  const body = {
    v: 1,
    type: "receive" as const,
    link: args.senderSig,
    previousHeadRoot: args.previousHeadRoot,
    receiverKaiPulse: args.receiverKaiPulse,
    receiverPubKey: args.receiverPubKey,
    transferLeafHashReceive: args.transferLeafHashReceive,
  };
  return new TextEncoder().encode(stableStringify(body));
}

async function headCanonicalHash(meta: SigilMetadata): Promise<HashHex> {
  const snapshot = JSON.stringify({
    pulse: meta.pulse,
    beat: meta.beat,
    stepIndex: meta.stepIndex,
    chakraDay: meta.chakraDay,
    kaiSignature: meta.kaiSignature,
    userPhiKey: meta.userPhiKey,
    cumulativeTransfers: meta.cumulativeTransfers ?? 0,
    segments: (meta.segments ?? []).map((s) => ({ index: s.index, root: s.root, cid: s.cid, count: s.count })),
    segmentsMerkleRoot: meta.segmentsMerkleRoot ?? "",
  });
  return sha256Hex(snapshot);
}

/* ───────────────────────────────────────────────────────────────
   FIX: remove unused svgURL param (TS6133) — function never used it
──────────────────────────────────────────────────────────────── */
async function sealCurrentWindowIntoSegment(meta: SigilMetadata) {
  const live = meta.transfers ?? [];
  if (live.length === 0) return { meta, segmentFileBlob: null as Blob | null };

  // Build segment
  const segmentIndex = meta.segments?.length ?? 0;
  const startGlobal = meta.cumulativeTransfers ?? 0;
  const endGlobal = startGlobal + live.length - 1;

  const leaves = await Promise.all(live.map(hashTransfer));
  const segmentRoot = await buildMerkleRoot(leaves);
  const headHashAtSeal = await headCanonicalHash(meta);

  const segmentFile: SegmentFile = {
    version: 1,
    segmentIndex,
    segmentRange: [startGlobal, endGlobal],
    segmentRoot,
    headHashAtSeal,
    leafHash: "sha256",
    transfers: live,
  };
  const segmentJson = JSON.stringify(segmentFile);
  const cid = await sha256Hex(segmentJson);
  const segmentBlob = new Blob([segmentJson], { type: "application/json" });

  // Update head/meta
  const newSegments: SegmentEntry[] = [...(meta.segments ?? []), { index: segmentIndex, root: segmentRoot, cid, count: live.length }];
  const segmentRoots = newSegments.map((s) => s.root);
  const segmentsMerkleRoot = await buildMerkleRoot(segmentRoots);

  const updated: SigilMetadata = {
    ...meta,
    segments: newSegments,
    segmentsMerkleRoot,
    cumulativeTransfers: (meta.cumulativeTransfers ?? 0) + live.length,
    transfers: [], // clear head window
    transfersWindowRoot: undefined,
    headHashAtSeal,
    segmentSize: meta.segmentSize ?? SEGMENT_SIZE,
  };

  return { meta: updated, segmentFileBlob: segmentBlob };
}

/* Optional verifier that can consume proof bundles (for Explorer) */
async function verifyHistorical(head: SigilMetadata, bundle: SegmentProofBundle | HeadWindowProofBundle): Promise<boolean> {
  if (bundle.kind === "head") {
    if (!head.transfersWindowRoot || head.transfersWindowRoot !== bundle.windowMerkleRoot) return false;
    return verifyProof(head.transfersWindowRoot, bundle.transferProof);
  }
  // Segment bundle
  if (!head.segments || !head.segmentsMerkleRoot) return false;
  const seg = head.segments.find((s) => s.index === bundle.segmentIndex);
  if (!seg || seg.root !== bundle.segmentRoot) return false;

  // prove segmentRoot ∈ segmentsMerkleRoot using provided path
  let acc = bundle.segmentRoot;
  let idx = bundle.segmentIndex;
  for (const sib of bundle.segmentsSiblings) {
    const pair = idx % 2 === 0 ? [acc, sib] : [sib, acc];
    // eslint-disable-next-line no-await-in-loop
    acc = await hashPair(pair[0] <= pair[1] ? pair[0] : pair[1], pair[0] <= pair[1] ? pair[1] : pair[0]);
    idx = Math.floor(idx / 2);
  }
  if (acc !== head.segmentsMerkleRoot) return false;

  // prove transfer ∈ segmentRoot
  return verifyProof(bundle.segmentRoot, bundle.transferProof);
}

/* ═════════════ OPTIONAL ZK: lightweight glue (no hard dep) ═════════════
   • If you have snarkjs installed, we’ll try to import it at runtime.
   • We look for a verifying key either in meta.zkVerifyingKey or window.SIGIL_ZK_VKEY.
   • Regardless, we bind proofs via hashes (public+proof+vkey) so lineage is immutable.
────────────────────────────────────────────────────────────────── */
declare global {
  interface Window {
    SIGIL_ZK_VKEY?: unknown;
    SIGIL_ZK?: {
      /** Return a Groth16 proof object for SEND (free shape; we hash it). */
      provideSendProof?: (ctx: {
        meta: SigilMetadata;
        leafHash: string; // sender-side leaf hash
        previousHeadRoot: string;
        nonce: string;
      }) => Promise<{ proof: unknown; publicSignals: unknown; vkey?: unknown } | null>;
      /** Return a Groth16 proof object for RECEIVE (free shape; we hash it). */
      provideReceiveProof?: (ctx: {
        meta: SigilMetadata;
        leafHash: string; // full leaf hash
        previousHeadRoot: string;
        linkSig: string; // senderSig from hardened entry
      }) => Promise<{ proof: unknown; publicSignals: unknown; vkey?: unknown } | null>;
    };
  }
}

async function hashAny(x: unknown): Promise<HashHex> {
  return sha256Hex(stableStringify(x));
}
/* ─────────── Groth16 minimal structural types ─────────── */
type JsonValue = string | number | boolean | null | { [k: string]: JsonValue } | JsonValue[];

type Groth16VerifyingKey = { protocol?: "groth16"; curve?: string } & Record<string, JsonValue>;
type Groth16Proof = Record<string, JsonValue>;
type Groth16PublicSignals = readonly (string | number | bigint)[] | Record<string, string | number | bigint>;

/* Narrowing helpers */
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isScalar = (v: unknown): v is string | number | bigint => typeof v === "string" || typeof v === "number" || typeof v === "bigint";
function isVerifyingKey(v: unknown): v is Groth16VerifyingKey {
  return isObject(v); // permissive; we only need object shape
}
function isProof(v: unknown): v is Groth16Proof {
  return isObject(v);
}
function isPublicSignals(v: unknown): v is Groth16PublicSignals {
  if (Array.isArray(v)) return v.every(isScalar);
  if (!isObject(v)) return false;
  return Object.values(v).every(iscalar => isScalar(iscalar));
}

/* ─────────── Optional snarkjs loader that Vite won't pre-resolve ─────────── */
// If you don't already have it, you can keep a minimal type locally:
export interface Groth16 {
  verify: (...args: unknown[]) => Promise<boolean> | boolean;
  // (add other groth16 members if you use them)
}

// Safe runtime guard (no `any`)
function isGroth16(x: unknown): x is Groth16 {
  return typeof x === "object" &&
    x !== null &&
    "verify" in x &&
    typeof (x as { verify?: unknown }).verify === "function";
}

async function loadGroth16(): Promise<Groth16 | null> {
  // 2) Try dynamic import without letting Vite analyze/resolve it
  try {
    const spec = "snarkjs";
    type SnarkjsDynamic = { groth16?: unknown; default?: { groth16?: unknown } };
    const mod = (await import(/* @vite-ignore */ spec)) as unknown as SnarkjsDynamic;

    const candidate = mod.groth16 ?? mod.default?.groth16;
    if (isGroth16(candidate)) {
      return candidate;
    }
  } catch {
    // Not installed / failed to import — optional
  }
  return null;
}

/* Optionally type the global if you plan to use a CDN build */
declare global {
  interface Window {
    snarkjs?: { groth16?: Groth16 };
  }
}

/** Best-effort Groth16 verifier. Returns null if snarkjs is not available. */
async function tryVerifyGroth16(args: {
  proof: unknown;
  publicSignals: unknown;
  vkey?: unknown;
  fallbackVkey?: unknown;
}): Promise<boolean | null> {
  // Load optional groth16 (global or dynamic import)
  const groth16 = await loadGroth16();
  if (!groth16) return null;

  const vkeyCandidate = args.vkey ?? args.fallbackVkey;
  if (!isVerifyingKey(vkeyCandidate)) return false;
  if (!isPublicSignals(args.publicSignals)) return false;
  if (!isProof(args.proof)) return false;

  const ok = await groth16.verify(
    vkeyCandidate as Groth16VerifyingKey,
    args.publicSignals as Groth16PublicSignals,
    args.proof as Groth16Proof
  );
  return !!ok;
}

/** Eagerly verify any ZK bundles on the head (best-effort, offline) */
async function verifyZkOnHead(m: SigilMetadata): Promise<void> {
  const vkeyInline = m.zkVerifyingKey;
  const vkeyWindow = typeof window !== "undefined" ? window.SIGIL_ZK_VKEY : undefined;
  const fallbackVkey = vkeyInline ?? vkeyWindow;

  const hs = m.hardenedTransfers ?? [];
  for (let i = 0; i < hs.length; i++) {
    const t = hs[i];

    if (t.zkSendBundle) {
      const res = await tryVerifyGroth16({
        proof: t.zkSendBundle.proof,
        publicSignals: t.zkSendBundle.publicSignals,
        vkey: t.zkSendBundle.vkey,
        fallbackVkey,
      });
      if (t.zkSend) t.zkSend.verified = res === true;
    }
    if (t.zkReceiveBundle) {
      const res = await tryVerifyGroth16({
        proof: t.zkReceiveBundle.proof,
        publicSignals: t.zkReceiveBundle.publicSignals,
        vkey: t.zkReceiveBundle.vkey,
        fallbackVkey,
      });
      if (t.zkReceive) t.zkReceive.verified = res === true;
    }
  }
}

/* ═════════════ COMPONENT ═════════════ */
const VerifierStamper: React.FC = () => {
  const svgInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dlgRef = useRef<HTMLDialogElement>(null);
  const explorerDlgRef = useRef<HTMLDialogElement>(null);

  const [pulseNow, setPulseNow] = useState(kaiPulseNow());
  useEffect(() => {
    const id = setInterval(() => setPulseNow(kaiPulseNow()), 1000);
    return () => clearInterval(id);
  }, []);

  const [svgURL, setSvgURL] = useState<string | null>(null);
  const [rawMeta, setRawMeta] = useState<string | null>(null);
  const [meta, setMeta] = useState<SigilMetadata | null>(null);

  const [contentSigExpected, setContentSigExpected] = useState<string | null>(null);
  const [contentSigMatches, setContentSigMatches] = useState<boolean | null>(null);
  const [phiKeyExpected, setPhiKeyExpected] = useState<string | null>(null);
  const [phiKeyMatches, setPhiKeyMatches] = useState<boolean | null>(null);

  const [liveSig, setLiveSig] = useState<string | null>(null);
  const [rgbSeed, setRgbSeed] = useState<[number, number, number] | null>(null);

  const [payload, setPayload] = useState<SigilPayload | null>(null);
  const [uiState, setUiState] = useState<UiState>("idle");
  const [tab, setTab] = useState<TabKey>("summary");
  const [error, setError] = useState<string | null>(null);
  const [viewRaw, setViewRaw] = useState(false);

  /* On-device head-proof status (uses merkleProof + verifyHistorical) */
  const [headProof, setHeadProof] = useState<{ ok: boolean; index: number; root: string } | null>(null);

  /* ── Seal modal + Explorer modal state ──────────────── */
  const [sealOpen, setSealOpen] = useState(false);
  const [sealUrl, setSealUrl] = useState("");
  const [sealHash, setSealHash] = useState("");
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [valuationOpen, setValuationOpen] = useState(false);

  /* v14 local sovereign key (silent; no UI text change) */
  const [me, setMe] = useState<Keypair | null>(null);
  useEffect(() => {
    (async () => {
      try {
        setMe(await loadOrCreateKeypair());
      } catch {
        /* ignore */
      }
    })();
  }, []);

  /* Auto-load verifying key from public/ (served at /verification_key.json) */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/verification_key.json", { cache: "no-store" });
        if (!res.ok) return;
        const vkey = await res.json();
        if (!alive) return;
        window.SIGIL_ZK_VKEY = vkey; // makes ZK verification available globally
      } catch {
        // optional; fine if missing
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const openVerifier = () => {
    const d = dlgRef.current;
    if (!d) return;
    if (!d.open) d.showModal();
    d.setAttribute("data-open", "true");
  };
  const closeVerifier = () => {
    dlgRef.current?.close();
    dlgRef.current?.setAttribute("data-open", "false");
  };

  const openExplorer = () => {
    const d = explorerDlgRef.current;
    if (!d) return;
    if (!d.open) d.showModal();
    d.setAttribute("data-open", "true");
    setExplorerOpen(true);
  };
  const closeExplorer = () => {
    explorerDlgRef.current?.close();
    explorerDlgRef.current?.setAttribute("data-open", "false");
    setExplorerOpen(false);
  };

  /* ──────────────────────────────────────────────────────────────
     PATCH: Open Valuation, then close Verifier next frame so the
     Valuation modal never sits behind the dialog (no flicker).
  ────────────────────────────────────────────────────────────── */
  const openValuation = () => {
    setValuationOpen(true);
    requestAnimationFrame(() => {
      closeVerifier();
    });
  };
  const closeValuation = () => setValuationOpen(false);

  const onAttachValuation = async (seal: ValueSeal) => {
    if (!meta) return;
    // Embed the valuation into metadata and optionally re-download the file
    const updated: SigilMetadata = { ...meta, valuation: seal };

    setMeta(updated);
    setRawMeta(JSON.stringify(updated, null, 2));

    if (svgURL) {
      const durl = await embedMetadata(svgURL, updated);
      const sigilPulse = updated.pulse ?? 0;
      download(durl, `${pulseFilename("sigil_with_valuation", sigilPulse, pulseNow)}.svg`);
    }

    setValuationOpen(false);
  };

  /* ── Head window recompute + self-proof verify — DRY with verifyHistorical */
  const refreshHeadWindow = useCallback(async (m: SigilMetadata) => {
    const transfers = m.transfers ?? [];
    const root = await computeHeadWindowRoot(transfers);
    m.transfersWindowRoot = root;

    if (transfers.length > 0) {
      const leaves = await Promise.all(transfers.map(hashTransfer));
      const index = leaves.length - 1; // last event
      const proof = await merkleProof(leaves, index);

      // Verify directly
      const okDirect = await verifyProof(root, proof);

      // Verify via verifyHistorical (head bundle)
      const okBundle = await verifyHistorical(m, {
        kind: "head",
        windowMerkleRoot: root,
        transferProof: proof,
      });

      setHeadProof({ ok: okDirect && okBundle, index, root });
    } else {
      setHeadProof(null);
    }

    /* v14: compute hardened window root (parallel; silent) */
    try {
      const v14Leaves = await Promise.all(
        (m.hardenedTransfers ?? []).map(async (t) => {
          const mini = stableStringify({
            previousHeadRoot: t.previousHeadRoot,
            senderPubKey: t.senderPubKey,
            senderSig: t.senderSig,
            senderKaiPulse: t.senderKaiPulse,
            nonce: t.nonce,
            transferLeafHashSend: t.transferLeafHashSend,
            receiverPubKey: t.receiverPubKey,
            receiverSig: t.receiverSig,
            receiverKaiPulse: t.receiverKaiPulse,
            transferLeafHashReceive: t.transferLeafHashReceive,
            zkSend: t.zkSend ?? null,
            zkReceive: t.zkReceive ?? null,
          });
          return sha256Hex(mini);
        })
      );
      m.transfersWindowRootV14 = await buildMerkleRoot(v14Leaves);
    } catch {
      /* ignore */
    }

    // NEW: eagerly verify any available ZK bundles (best-effort, offline) — fire & forget
    try {
      void (async () => {
        await verifyZkOnHead(m);
        // re-render to reflect .verified flags as they arrive
        setMeta({ ...m });
      })();
    } catch {
      /* ignore */
    }

    return m;
  }, []);

  /* SVG upload */
  const handleSvg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    // reset
    setError(null);
    setPayload(null);
    setTab("summary");
    setViewRaw(false);

    const url = URL.createObjectURL(f);
    setSvgURL(url);

    const { meta: m, contextOk, typeOk } = await parseSvgFile(f);

    // Defaults / derived for segmented head
    m.segmentSize ??= SEGMENT_SIZE;
    // derive cumulative if absent
    const segCount = (m.segments ?? []).reduce((a, s) => a + (s.count || 0), 0);
    if (typeof m.cumulativeTransfers !== "number") {
      m.cumulativeTransfers = segCount + (m.transfers?.length ?? 0);
    }
    // derive segmentsMerkleRoot if segments present but root missing
    if ((m.segments?.length ?? 0) > 0 && !m.segmentsMerkleRoot) {
      const roots = (m.segments ?? []).map((s) => s.root);
      m.segmentsMerkleRoot = await buildMerkleRoot(roots);
    }

    // live centre-pixel sig
    const pulseForSeal = typeof m.pulse === "number" ? m.pulse : kaiPulseNow();
    const { sig, rgb } = await centrePixelSignature(url, pulseForSeal);
    setLiveSig(sig);
    setRgbSeed(rgb);

    // expected content signature
    const expected = await computeKaiSignature(m);
    setContentSigExpected(expected);

    let cMatch: boolean | null = null;
    if (expected && m.kaiSignature) {
      cMatch = expected.toLowerCase() === m.kaiSignature.toLowerCase();
    }
    setContentSigMatches(cMatch);

    // derive phi key if possible (legacy)
    let expectedPhi: string | null = null;
    if (m.kaiSignature) {
      expectedPhi = await derivePhiKeyFromSig(m.kaiSignature);
      setPhiKeyExpected(expectedPhi);
      setPhiKeyMatches(m.userPhiKey ? expectedPhi === m.userPhiKey : null);
    } else {
      setPhiKeyExpected(null);
      setPhiKeyMatches(null);
    }

    // v14 silent Φ anchor check (no UI text, no mismatches thrown)
    try {
      if (m.creatorPublicKey) {
        const phi = await phiFromPublicKey(m.creatorPublicKey);
        if (!m.userPhiKey) m.userPhiKey = phi; // fill if missing, never overwrite
      }
    } catch {
      /* ignore */
    }

    // core presence
    const hasCore =
      typeof m.pulse === "number" &&
      typeof m.beat === "number" &&
      typeof m.stepIndex === "number" &&
      typeof m.chakraDay === "string";

    // ownership (legacy)
    const last = m.transfers?.slice(-1)[0];
    const lastParty = last?.receiverSignature || last?.senderSignature || null;
    const isOwner = lastParty && sig ? lastParty === sig : null;

    const hasTransfers = !!(m.transfers && m.transfers.length > 0);
    const lastOpen = !!(last && !last.receiverSignature);
    const isUnsigned = !m.kaiSignature;

    const next = deriveState({
      contextOk,
      typeOk,
      hasCore,
      contentSigMatches: cMatch,
      isOwner,
      hasTransfers,
      lastOpen,
      isUnsigned,
    });

    const verified =
      next !== "invalid" &&
      next !== "structMismatch" &&
      next !== "sigMismatch" &&
      next !== "notOwner" &&
      !lastOpen &&
      (cMatch === true || isUnsigned || !!m.kaiSignature);

    const m2 = await refreshHeadWindow(m);
    setMeta(m2);
    setRawMeta(JSON.stringify(m2, null, 2));
    setUiState(verified ? "verified" : next);

    openVerifier();
  };

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPayload(await fileToPayload(f));
  };

  /* Seal unsigned: compute kaiSignature + userPhiKey, set timestamp/kaiPulse if missing
     v14: silently anchor creatorPublicKey if consistent / or absent Φ (no UI change) */
  const sealUnsigned = async () => {
    if (!meta || !svgURL) return;
    const m = { ...meta };
    const nowPulse = kaiPulseNow();

    if (!m.kaiSignature) {
      const sig = await computeKaiSignature(m);
      if (!sig) {
        setError("Cannot compute kaiSignature — missing core fields.");
        return;
      }
      m.kaiSignature = sig;
    }
    if (!m.userPhiKey && m.kaiSignature) {
      m.userPhiKey = await derivePhiKeyFromSig(m.kaiSignature);
    }

    if (typeof m.kaiPulse !== "number") m.kaiPulse = nowPulse;

    // v14 anchor: prefer keeping Φ as-is; if no creatorPublicKey, set ours without UI exposure
    try {
      if (!m.creatorPublicKey && me) {
        m.creatorPublicKey = me.spkiB64u;
      }
    } catch {
      /* ignore */
    }

    const durl = await embedMetadata(svgURL, m);
    download(durl, `${safeFilename("sigil_sealed", nowPulse)}.svg`);

    const m2 = await refreshHeadWindow(m);
    setMeta(m2);
    setRawMeta(JSON.stringify(m2, null, 2));
    setUiState((prev) => (prev === "unsigned" ? "readySend" : prev));
    setError(null);
  };

  /* ──────────────────────────────────────────────────────────────
     SigilPage-style share builder (opens SealMomentModal & registers with Explorer)
     NOW appends compact history (&h=) built from meta.transfers.
  ─────────────────────────────────────────────────────────────── */
  const shareTransferLink = useCallback(async (m: SigilMetadata) => {
    const canonical =
      (m.canonicalHash as string | undefined)?.toLowerCase() ||
      (await sha256Hex(`${m.pulse}|${m.beat}|${m.stepIndex}|${m.chakraDay}`)).toLowerCase();

    const token = m.transferNonce || genNonce();

    const chakraDay: ChakraDay = normalizeChakraDay(m.chakraDay) ?? "Root";

    const sharePayload: SigilSharePayloadLoose = {
      pulse: m.pulse as number,
      beat: m.beat as number,
      stepIndex: m.stepIndex as number,
      chakraDay,
      kaiSignature: m.kaiSignature,
      userPhiKey: m.userPhiKey,
    };

    const enriched = {
      ...sharePayload,
      canonicalHash: canonical,
      transferNonce: token,
    };

    let base = "";
    try {
      base = makeSigilUrl(canonical, sharePayload);
    } catch {
      const u = new URL(typeof window !== "undefined" ? window.location.href : "http://localhost");
      u.pathname = `/s/${canonical}`;
      base = u.toString();
    }

    // Build compact history &h= (value WITHOUT 'h:' prefix for decoder compatibility)
    let historyParam: string | undefined;
    try {
      const lite = toLiteHistory(m);
      if (lite.length > 0) {
        const enc = encodeSigilHistory(lite); // "h:<b64url>"
        historyParam = enc.startsWith("h:") ? enc.slice(2) : enc;
      }
    } catch {
      /* non-fatal; skip history param */
    }

    const url = rewriteUrlPayload(base, enriched, token, historyParam);

    setSealUrl(url);
    setSealHash(canonical);
    setSealOpen(true);
  }, []);

  /* Send transfer (+ open the Seal modal with SigilPage-style share URL)
     v14: ALSO append a hardened transfer in parallel (silent) + optional ZK stamp */
  const send = async () => {
    if (!meta || !svgURL || !liveSig) return;

    // Ensure signature is valid if present
    if (meta.kaiSignature && contentSigExpected && meta.kaiSignature.toLowerCase() !== contentSigExpected.toLowerCase()) {
      setError("Content signature mismatch — cannot send.");
      setUiState("sigMismatch");
      return;
    }

    // If unsigned, seal quietly first (no download)
    const m: SigilMetadata = { ...meta };
    if (!m.kaiSignature) {
      const sig = await computeKaiSignature(m);
      if (!sig) {
        setError("Cannot compute kaiSignature — missing core fields.");
        return;
      }
      m.kaiSignature = sig;
      if (!m.userPhiKey) m.userPhiKey = await derivePhiKeyFromSig(sig);
    }

    if (typeof m.kaiPulse !== "number") m.kaiPulse = kaiPulseNow();

    const nowPulse = kaiPulseNow();
    const stamp = await sha256Hex(`${liveSig}-${m.pulse ?? 0}-${nowPulse}`);

    const transfer: SigilTransfer = {
      senderSignature: liveSig,
      senderStamp: stamp,
      senderKaiPulse: nowPulse,
      payload: payload ?? undefined,
    };

    const updated: SigilMetadata = {
      ...m,
      ["@context"]: m["@context"] ?? SIGIL_CTX,
      type: m.type ?? SIGIL_TYPE,
      canonicalHash: m.canonicalHash || undefined,
      transferNonce: m.transferNonce || genNonce(),
      transfers: [...(m.transfers ?? []), transfer],
      segmentSize: m.segmentSize ?? SEGMENT_SIZE,
    };

    /* v14 hardened parallel entry (silent; no UI label changes) + optional ZK SEND */
    try {
      if (me) {
        updated.creatorPublicKey ??= me.spkiB64u;

        const indexV14 = updated.hardenedTransfers?.length ?? 0;
        const prevHeadV14 = await expectedPrevHeadRootV14(updated, indexV14);
        const nonce = updated.transferNonce!;

        const transferLeafHashSend = await hashTransferSenderSide(transfer);

        const msg = buildSendMessageV14(updated, {
          previousHeadRoot: prevHeadV14,
          senderKaiPulse: nowPulse,
          senderPubKey: updated.creatorPublicKey!,
          nonce,
          transferLeafHashSend,
        });
        const senderSig = await signB64u(me.priv, msg);

        const hardened: HardenedTransferV14 = {
          previousHeadRoot: prevHeadV14,
          senderPubKey: updated.creatorPublicKey!,
          senderSig,
          senderKaiPulse: nowPulse,
          nonce,
          transferLeafHashSend,
        };

        // Optional ZK proof provider hook (no dependency)
        if (window.SIGIL_ZK?.provideSendProof) {
          try {
            const proofObj = await window.SIGIL_ZK.provideSendProof({
              meta: updated,
              leafHash: transferLeafHashSend,
              previousHeadRoot: prevHeadV14,
              nonce,
            });
            if (proofObj) {
              hardened.zkSendBundle = {
                scheme: "groth16",
                curve: "BLS12-381",
                proof: proofObj.proof,
                publicSignals: proofObj.publicSignals,
                vkey: proofObj.vkey,
              };
              const publicHash = await hashAny(proofObj.publicSignals);
              const proofHash = await hashAny(proofObj.proof);
              const vkey = proofObj.vkey ?? updated.zkVerifyingKey ?? window.SIGIL_ZK_VKEY;
              const vkeyHash = vkey ? await hashAny(vkey) : undefined;
              hardened.zkSend = {
                scheme: "groth16",
                curve: "BLS12-381",
                publicHash,
                proofHash,
                vkeyHash,
              };
            }
          } catch {
            /* ignore */
          }
        }

        updated.hardenedTransfers = [...(updated.hardenedTransfers ?? []), hardened];
      }
    } catch {
      /* non-fatal; legacy flow continues */
    }

    // Persist into the file + download the stamped SVG — NAME = prefix_<sigilPulse>_<sendPulse>.svg
    const durl = await embedMetadata(svgURL, updated);
    const sigilPulse = updated.pulse ?? 0;
    download(durl, `${pulseFilename("sigil_send", sigilPulse, nowPulse)}.svg`);

    // ── Sharding policy: if head-window exceeded, seal into a segment ──
    const windowSize = (updated.transfers ?? []).length;
    const cap = updated.segmentSize ?? SEGMENT_SIZE;

    if (windowSize >= cap) {
      const { meta: rolled, segmentFileBlob } = await sealCurrentWindowIntoSegment(updated);
      if (segmentFileBlob) {
        const segIdx = (rolled.segments?.length ?? 1) - 1;
        download(segmentFileBlob, `sigil_segment_${rolled.pulse ?? 0}_${String(segIdx).padStart(6, "0")}.json`);
      }
      if (svgURL) {
        const durl2 = await embedMetadata(svgURL, rolled);
        download(durl2, `${pulseFilename("sigil_head_after_seal", rolled.pulse ?? 0, nowPulse)}.svg`);
      }
      const rolled2 = await refreshHeadWindow(rolled);
      setMeta(rolled2);
      setRawMeta(JSON.stringify(rolled2, null, 2));
      setUiState("readyReceive");
      setError(null);
      await shareTransferLink(rolled2);
      return;
    }

    // Recompute head window root (fast) and continue
    const updated2 = await refreshHeadWindow(updated);
    setMeta(updated2);
    setRawMeta(JSON.stringify(updated2, null, 2));
    setUiState("readyReceive");
    setError(null);

    await shareTransferLink(updated2);
  };

  /* Receive transfer — same semantics, deterministic filename (no ISO)
     v14: also sign RECEIVE in the hardened parallel lineage (silent) + optional ZK RECEIVE */
  const receive = async () => {
    if (!meta || !svgURL || !liveSig) return;
    const last = meta.transfers?.slice(-1)[0];
    if (!last || last.receiverSignature) return;

    const nowPulse = kaiPulseNow();
    const updatedLast: SigilTransfer = {
      ...last,
      receiverSignature: liveSig,
      receiverStamp: await sha256Hex(`${liveSig}-${last.senderStamp}-${nowPulse}`),
      receiverKaiPulse: nowPulse,
    };

    const updated: SigilMetadata = {
      ...meta,
      transfers: [...(meta.transfers ?? []).slice(0, -1), updatedLast],
    };

    /* v14 receive seal (parallel) + optional ZK stamp */
    try {
      if (me && (updated.hardenedTransfers?.length ?? 0) > 0) {
        const hLast = updated.hardenedTransfers![updated.hardenedTransfers!.length - 1];
        if (!hLast.receiverSig) {
          updated.creatorPublicKey ??= me.spkiB64u;

          const transferLeafHashReceive = await hashTransfer(updatedLast);

          const msgR = buildReceiveMessageV14({
            previousHeadRoot: hLast.previousHeadRoot,
            senderSig: hLast.senderSig,
            receiverKaiPulse: nowPulse,
            receiverPubKey: updated.creatorPublicKey!,
            transferLeafHashReceive,
          });
          const receiverSig = await signB64u(me.priv, msgR);
          const newHLast: HardenedTransferV14 = {
            ...hLast,
            receiverPubKey: updated.creatorPublicKey!,
            receiverSig,
            receiverKaiPulse: nowPulse,
            transferLeafHashReceive,
            zkReceive: hLast.zkReceive, // preserve if already set
            zkReceiveBundle: hLast.zkReceiveBundle,
          };

          // Optional ZK receive proof
          if (window.SIGIL_ZK?.provideReceiveProof) {
            try {
              const proofObj = await window.SIGIL_ZK.provideReceiveProof({
                meta: updated,
                leafHash: transferLeafHashReceive,
                previousHeadRoot: hLast.previousHeadRoot,
                linkSig: hLast.senderSig,
              });
              if (proofObj) {
                newHLast.zkReceiveBundle = {
                  scheme: "groth16",
                  curve: "BLS12-381",
                  proof: proofObj.proof,
                  publicSignals: proofObj.publicSignals,
                  vkey: proofObj.vkey,
                };
                const publicHash = await hashAny(proofObj.publicSignals);
                const proofHash = await hashAny(proofObj.proof);
                const vkey = proofObj.vkey ?? updated.zkVerifyingKey ?? window.SIGIL_ZK_VKEY;
                const vkeyHash = vkey ? await hashAny(vkey) : undefined;
                newHLast.zkReceive = {
                  scheme: "groth16",
                  curve: "BLS12-381",
                  publicHash,
                  proofHash,
                  vkeyHash,
                };
              }
            } catch {
              /* ignore */
            }
          }

          updated.hardenedTransfers = [...updated.hardenedTransfers!.slice(0, -1), newHLast];
        }
      }
    } catch {
      /* ignore; legacy continues */
    }

    if (svgURL) {
      const durl = await embedMetadata(svgURL, updated);
      const sigilPulse = updated.pulse ?? 0;
      download(durl, `${pulseFilename("sigil_receive", sigilPulse, nowPulse)}.svg`);
    }

    // Update head-window root + verify
    const updated2 = await refreshHeadWindow(updated);
    setMeta(updated2);
    setRawMeta(JSON.stringify(updated2, null, 2));
    setUiState("complete");
    setError(null);

    if (updatedLast.payload) {
      const bin = Uint8Array.from(atob(updatedLast.payload.encoded), (c) => c.charCodeAt(0));
      const blobURL = URL.createObjectURL(new Blob([bin], { type: updatedLast.payload.mime }));
      download(blobURL, updatedLast.payload.name);
    }
  };

  /* Manual "Seal segment now" action (optional) */
  const sealSegmentNow = useCallback(async () => {
    if (!meta) return;
    if (!meta.transfers || meta.transfers.length === 0) return;

    const { meta: rolled, segmentFileBlob } = await sealCurrentWindowIntoSegment(meta);
    if (segmentFileBlob) {
      const segIdx = (rolled.segments?.length ?? 1) - 1;
      download(segmentFileBlob, `sigil_segment_${rolled.pulse ?? 0}_${String(segIdx).padStart(6, "0")}.json`);
    }
    if (svgURL) {
      const durl = await embedMetadata(svgURL, rolled);
      download(durl, `${pulseFilename("sigil_head_after_seal", rolled.pulse ?? 0, kaiPulseNow())}.svg`);
    }
    const rolled2 = await refreshHeadWindow(rolled);
    setMeta(rolled2);
    setRawMeta(JSON.stringify(rolled2, null, 2));
  }, [meta, svgURL, refreshHeadWindow]);

  /* Export ZIP (SVG + PNG) — called by SealMomentModal */
  const downloadZip = useCallback(async () => {
    if (!meta || !svgURL) return;

    const svgDataUrl = await embedMetadata(svgURL, meta);
    const svgBlob = await fetch(svgDataUrl).then((r) => r.blob());

    let pngBlob: Blob | null = null;
    try {
      pngBlob = await pngBlobFromSvgDataUrl(svgDataUrl, 1024);
    } catch {
      /* non-fatal */
    }

    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    const sigilPulse = meta.pulse ?? 0;
    const last = meta.transfers?.slice(-1)[0];
    const sendPulse = last?.senderKaiPulse ?? meta.kaiPulse ?? kaiPulseNow();
    const base = pulseFilename("sigil_bundle", sigilPulse, sendPulse);

    zip.file(`${base}.svg`, svgBlob);
    if (pngBlob) zip.file(`${base}.png`, pngBlob);

    const zipBlob = await zip.generateAsync({ type: "blob" });
    download(zipBlob, `${base}.zip`);
  }, [meta, svgURL]);

  /* small chips */
  const Chip: React.FC<{ kind?: "ok" | "warn" | "err" | "info"; children: React.ReactNode }> = ({ kind = "info", children }) => (
    <span className={`chip ${kind}`}>{children}</span>
  );

  /* JSON tree (compact, collapsible) */
  const JsonTree: React.FC<{ data: unknown }> = ({ data }) => {
    if (typeof data !== "object" || data === null) return <span className="json-primitive">{String(data)}</span>;
    const isArr = Array.isArray(data);
    const entries = isArr ? (data as unknown[]).map((v, i) => [i, v] as [number, unknown]) : Object.entries(data as Record<string, unknown>);
    return (
      <ul className="json-node">
        {entries.map(([k, v]) => (
          <li key={String(k)}>
            <details>
              <summary>{isArr ? `[${k}]` : `"${k}"`}</summary>
              <JsonTree data={v} />
            </details>
          </li>
        ))}
      </ul>
    );
  };

  /* Derived values for header chips */
  const statusChips = () => {
    const chips: React.ReactNode[] = [];
    if (uiState === "invalid") chips.push(<Chip key="inv" kind="err">Invalid</Chip>);
    if (uiState === "structMismatch") chips.push(<Chip key="struct" kind="err">Structure</Chip>);
    if (uiState === "sigMismatch") chips.push(<Chip key="sig" kind="err">Sig Mismatch</Chip>);
    if (uiState === "notOwner") chips.push(<Chip key="owner" kind="warn">Not Owner</Chip>);
    if (uiState === "unsigned") chips.push(<Chip key="unsigned" kind="warn">Unsigned</Chip>);
    if (uiState === "readySend") chips.push(<Chip key="send" kind="info">Ready • Send</Chip>);
    if (uiState === "readyReceive") chips.push(<Chip key="recv" kind="info">Ready • Receive</Chip>);
    if (uiState === "complete") chips.push(<Chip key="done" kind="ok">Lineage Sealed</Chip>);
    if (uiState === "verified") chips.push(<Chip key="ver" kind="ok">Verified</Chip>);

    if (contentSigMatches === true) chips.push(<Chip key="cok" kind="ok">Σ match</Chip>);
    if (contentSigMatches === false) chips.push(<Chip key="cerr" kind="err">Σ mismatch</Chip>);
    if (phiKeyMatches === true) chips.push(<Chip key="pok" kind="ok">Φ match</Chip>);
    if (phiKeyMatches === false) chips.push(<Chip key="perr" kind="err">Φ mismatch</Chip>);

    if (meta?.cumulativeTransfers != null) chips.push(<Chip key="cum" kind="info">Σx {meta.cumulativeTransfers}</Chip>);
    if ((meta?.segments?.length ?? 0) > 0) chips.push(<Chip key="segs" kind="info">Segs {meta?.segments?.length}</Chip>);
    if (headProof) chips.push(<Chip key="headproof" kind={headProof.ok ? "ok" : "err"}>{headProof.ok ? "Head proof ✓" : "Head proof ×"}</Chip>);

    if (meta?.transfersWindowRootV14) chips.push(<Chip key="v14root" kind="info">v14 root</Chip>);

    // If any ZK verified, show a ✅ badge
    const anyZkVerified = (meta?.hardenedTransfers ?? []).some((ht) => ht.zkSend?.verified || ht.zkReceive?.verified);
    if (anyZkVerified) chips.push(<Chip key="zk" kind="ok">ZK✓</Chip>);

    return chips;
  };

  const canShare = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const nav = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
      canShare?: (data: ShareData) => boolean;
    };
    return typeof nav.share === "function";
  }, []);

  /* Revoke object URLs to avoid leaks (lint-safe) */
  useEffect(() => {
    return () => {
      if (svgURL && svgURL.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(svgURL);
        } catch (e) {
          void e;
        }
      }
    };
  }, [svgURL]);

  const metaLite = useMemo(() => {
    // Valuation only reads a subset; casting keeps this file simple.
    return meta ? (meta as unknown as SigilMetadataLite) : null;
  }, [meta]);

  /* ──────────────────────────────────────────────────────────────
     NEW: Seed Valuation with the uploaded glyph so it opens "warm"
  ────────────────────────────────────────────────────────────── */
  type InitialGlyph = {
    hash: string;
    value: number;
    pulseCreated: number;
    meta: SigilMetadataLite;
  };
  const [initialGlyph, setInitialGlyph] = useState<InitialGlyph | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!metaLite) {
        setInitialGlyph(null);
        return;
      }
      const canonical =
        (meta?.canonicalHash as string | undefined)?.toLowerCase() ||
        (await sha256Hex(`${metaLite.pulse}|${metaLite.beat}|${metaLite.stepIndex}|${metaLite.chakraDay}`)).toLowerCase();

      try {
        const { seal } = await buildValueSeal(metaLite, pulseNow, sha256Hex);
        if (!cancelled) {
          setInitialGlyph({
            hash: canonical,
            value: seal.valuePhi ?? 0,
            pulseCreated: metaLite.pulse ?? pulseNow,
            meta: metaLite,
          });
        }
      } catch {
        if (!cancelled) {
          setInitialGlyph({
            hash: canonical,
            value: 0,
            pulseCreated: metaLite.pulse ?? pulseNow,
            meta: metaLite,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [metaLite, meta, pulseNow]);

  return (
    <div className="verifier-stamper" role="application" style={{ maxWidth: "100vw", overflowX: "hidden" }}>
      {/* Top toolbar (compact on mobile) */}
      <div className="toolbar">
        <div className="brand-lockup">
          <span className="glyph" aria-hidden />
          <h3>Verify</h3>
        </div>
        <div className="toolbar-actions">
          <button className="secondary" onClick={openExplorer} aria-haspopup="dialog" aria-controls="explorer-dialog">
            ΦStream
          </button>
          <button className="primary" onClick={() => svgInput.current?.click()}>
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="ico"
              width="18"
              height="18"
              style={{ marginRight: 8, display: "inline-block", verticalAlign: "middle" }}
            >
              <path d="M12 19V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M8 11l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M4 5h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".6" />
            </svg>
            <span>Φkey</span>
          </button>
        </div>
      </div>

      <input ref={svgInput} type="file" accept=".svg" hidden onChange={handleSvg} />

      {/* ───── Verifier Modal (mobile-first full-screen) ───── */}
      <dialog
        ref={dlgRef}
        className="glass-modal fullscreen"
        id="verifier-dialog"
        data-open="false"
        aria-label="Kai-Sigil Verifier Modal"
        style={{
          width: "100vw",
          maxWidth: "100vw",
          height: "100dvh",
          maxHeight: "100dvh",
          margin: 0,
          padding: 0,
          overflow: "hidden",
        }}
      >
        <div
          className="modal-viewport"
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            maxWidth: "100vw",
            overflow: "hidden",
          }}
        >
          {/* Close on RIGHT, status on the left */}
          <div className="modal-topbar" style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center" }}>
            <div className="status-strip" aria-live="polite" style={{ overflowX: "auto", whiteSpace: "nowrap" }}>
              {statusChips()}
            </div>
            <button
              className="close-btn holo"
              data-aurora="true"
              aria-label="Close"
              title="Close"
              onClick={closeVerifier}
              style={{ justifySelf: "end", marginRight: 8 }}
            >
              ×
            </button>
          </div>

          {svgURL && meta && (
            <>
              {/* Header */}
              <header className="modal-header" style={{ paddingInline: 16 }}>
                <img src={svgURL} alt="Sigil thumbnail" width={64} height={64} style={{ maxWidth: "64px", height: "auto", flex: "0 0 auto" }} />
                <div className="header-fields" style={{ minWidth: 0 }}>
                  <h2 style={{ overflowWrap: "anywhere" }}>
                    Pulse <span>{meta.pulse ?? "—"}</span>
                  </h2>
                  <p>
                    Beat <span>{meta.beat ?? "—"}</span> · Step <span>{meta.stepIndex ?? "—"}</span> · Day:{" "}
                    <span>{normalizeChakraDay(meta.chakraDay) ?? meta.chakraDay ?? "—"}</span>
                  </p>
                  <div className="header-keys" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {meta.kaiSignature ? (
                      <span className="field">
                        Σ <code>{meta.kaiSignature.slice(0, 16)}…</code>
                      </span>
                    ) : (
                      <span className="field warn">Unsigned</span>
                    )}
                    {meta.userPhiKey && (
                      <span className="field">
                        Φ <code style={{ wordBreak: "break-all" }}>{meta.userPhiKey}</code>
                      </span>
                    )}
                  </div>
                </div>
              </header>

              {/* Tabs */}
              <nav className="tabs" role="tablist" aria-label="Views" style={{ position: "sticky", top: 48, zIndex: 2 }}>
                <button role="tab" aria-selected={tab === "summary"} className={tab === "summary" ? "active" : ""} onClick={() => setTab("summary")}>
                  Summary
                </button>
                <button role="tab" aria-selected={tab === "lineage"} className={tab === "lineage" ? "active" : ""} onClick={() => setTab("lineage")}>
                  Lineage
                </button>
                <button role="tab" aria-selected={tab === "data"} className={tab === "data" ? "active" : ""} onClick={() => setTab("data")}>
                  Data
                </button>
                <button className="secondary" onClick={openValuation} disabled={!meta}>
                 Φ Value
                </button>
              </nav>

              {/* Body */}
              <section className="modal-body" role="tabpanel" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", overflowX: "hidden", paddingBottom: 80 }}>
                {tab === "summary" && (
                  <div className="summary-grid">
                    <div className="kv">
                      <span className="k">Now-Pulse</span>
                      <span className="v">{pulseNow}</span>
                    </div>

                    <div className="kv">
                      <span className="k">frequency (Hz)</span>
                      <span className="v" style={{ marginLeft: "4rem" }}>{meta.frequencyHz ?? "—"}</span>
                    </div>

                    <div className="kv">
                      <span className="k">Spiral Gate</span>
                      <span className="v" style={{ marginLeft: "4rem" }}>{meta.chakraGate ?? "—"}</span>
                    </div>

                    <div className="kv">
                      <span className="k">Segments</span>
                      <span className="v">{meta.segments?.length ?? 0}</span>
                    </div>

                    <div className="kv">
                      <span className="k">Cumulative</span>
                      <span className="v">{meta.cumulativeTransfers ?? 0}</span>
                    </div>

                    {meta.segmentsMerkleRoot && (
                      <div className="kv wide">
                        <span className="k">Segments Root</span>
                        <span className="v mono" style={{ overflowWrap: "anywhere" }}>{meta.segmentsMerkleRoot}</span>
                      </div>
                    )}

                    {meta.transfersWindowRoot && (
                      <div className="kv wide">
                        <span className="k">Head Window Root</span>
                        <span className="v mono" style={{ overflowWrap: "anywhere" }}>{meta.transfersWindowRoot}</span>
                      </div>
                    )}

                    {headProof && (
                      <div className="kv">
                        <span className="k">Latest proof</span>
                        <span className="v">{headProof.ok ? `#${headProof.index} ✓` : `#${headProof.index} ×`}</span>
                      </div>
                    )}

                    {liveSig && (
                      <div className="kv wide">
                        <span className="k">Live Centre-Pixel Sig</span>
                        <span className="v mono" style={{ overflowWrap: "anywhere" }}>{liveSig}</span>
                      </div>
                    )}
                    {rgbSeed && (
                      <div className="kv">
                        <span className="k">RGB seed</span>
                        <span className="v">{rgbSeed.join(", ")}</span>
                      </div>
                    )}

                    {meta.kaiSignature && (
                      <div className="kv wide">
                        <span className="k">Metadata Σ</span>
                        <span className="v mono" style={{ overflowWrap: "anywhere" }}>
                          {meta.kaiSignature}
                          {contentSigMatches === true && <Chip kind="ok">match</Chip>}
                          {contentSigMatches === false && <Chip kind="err">mismatch</Chip>}
                        </span>
                      </div>
                    )}
                    {contentSigExpected && (
                      <div className="kv wide">
                        <span className="k">Expected Σ</span>
                        <span className="v mono" style={{ overflowWrap: "anywhere" }}>{contentSigExpected}</span>
                      </div>
                    )}
                    {meta.userPhiKey && (
                      <div className="kv wide">
                        <span className="k">Φ-Key</span>
                        <span className="v mono" style={{ overflowWrap: "anywhere" }}>
                          {meta.userPhiKey}
                          {phiKeyExpected && (phiKeyMatches ? <Chip kind="ok">match</Chip> : <Chip kind="err">mismatch</Chip>)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {tab === "lineage" && (
                  <div className="lineage">
                    {meta.transfers?.length ? (
                      <ol className="transfers">
                        {meta.transfers.map((t, i) => {
                          const open = !t.receiverSignature;
                          const hardened = meta.hardenedTransfers?.[i];
                          return (
                            <li key={i} className={open ? "transfer open" : "transfer closed"}>
                              <header>
                                <span className="index">#{i + 1}</span>
                                <span className={`state ${open ? "open" : "closed"}`}>{open ? "Pending receive" : "Sealed"}</span>
                              </header>
                              <div className="row"><span className="k">Sender Σ</span><span className="v mono" style={{ overflowWrap: "anywhere" }}>{t.senderSignature}</span></div>
                              <div className="row"><span className="k">Sender Stamp</span><span className="v mono" style={{ overflowWrap: "anywhere" }}>{t.senderStamp}</span></div>
                              <div className="row"><span className="k">Sender Pulse</span><span className="v">{t.senderKaiPulse}</span></div>

                              {hardened && (
                                <>
                                  <div className="row"><span className="k">Prev-Head</span><span className="v mono" style={{ overflowWrap: "anywhere" }}>{hardened.previousHeadRoot}</span></div>
                                  <div className="row"><span className="k">SEND leaf</span><span className="v mono" style={{ overflowWrap: "anywhere" }}>{hardened.transferLeafHashSend}</span></div>
                                  {hardened.transferLeafHashReceive && (
                                    <div className="row"><span className="k">RECV leaf</span><span className="v mono" style={{ overflowWrap: "anywhere" }}>{hardened.transferLeafHashReceive}</span></div>
                                  )}
                                  {hardened.zkSend && (
                                    <div className="row"><span className="k">ZK SEND</span><span className="v">{hardened.zkSend.verified ? "✓" : "•"} {hardened.zkSend.scheme}</span></div>
                                  )}
                                  {hardened.zkSendBundle && (
                                    <div className="row"><span className="k">ZK SEND hash</span><span className="v mono" style={{ overflowWrap: "anywhere" }}>{hardened.zkSend?.proofHash}</span></div>
                                  )}
                                  {hardened.zkReceive && (
                                    <div className="row"><span className="k">ZK RECV</span><span className="v">{hardened.zkReceive.verified ? "✓" : "•"} {hardened.zkReceive.scheme}</span></div>
                                  )}
                                  {hardened.zkReceiveBundle && (
                                    <div className="row"><span className="k">ZK RECV hash</span><span className="v mono" style={{ overflowWrap: "anywhere" }}>{hardened.zkReceive?.proofHash}</span></div>
                                  )}
                                </>
                              )}

                              {t.receiverSignature && (
                                <>
                                  <div className="row"><span className="k">Receiver Σ</span><span className="v mono" style={{ overflowWrap: "anywhere" }}>{t.receiverSignature}</span></div>
                                  <div className="row"><span className="k">Receiver Stamp</span><span className="v mono" style={{ overflowWrap: "anywhere" }}>{t.receiverStamp}</span></div>
                                  <div className="row"><span className="k">Receiver Pulse</span><span className="v">{t.receiverKaiPulse}</span></div>
                                </>
                              )}

                              {t.payload && (
                                <details className="payload" open>
                                  <summary>Payload</summary>
                                  <div className="row"><span className="k">Name</span><span className="v">{t.payload.name}</span></div>
                                  <div className="row"><span className="k">MIME</span><span className="v">{t.payload.mime}</span></div>
                                  <div className="row"><span className="k">Size</span><span className="v">{t.payload.size} bytes</span></div>
                                </details>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <p className="empty">No transfers yet — ready to mint a send stamp.</p>
                    )}
                  </div>
                )}

                {tab === "data" && (
                  <>
                    <div className="json-toggle">
                      <label>
                        <input type="checkbox" checked={viewRaw} onChange={() => setViewRaw((v) => !v)} /> View raw JSON
                      </label>
                    </div>
                    {viewRaw ? (
                      <pre className="raw-json" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{rawMeta}</pre>
                    ) : (
                      <div className="json-tree-wrap" style={{ overflowX: "hidden" }}>
                        <JsonTree data={meta} />
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* Footer */}
              <footer className="modal-footer" style={{ position: "sticky", bottom: 0 }}>
                <div className="footer-left">
                  <p><strong>Now-Pulse:</strong> {pulseNow}</p>
                  {error && <p className="status error" style={{ overflowWrap: "anywhere" }}>{error}</p>}
                </div>

                <div className="footer-actions">
                  {uiState === "unsigned" && (
                    <button className="secondary" onClick={sealUnsigned}>
                      Seal content (Σ + Φ)
                    </button>
                  )}

                  {(uiState === "readySend" || uiState === "verified") && (
                    <>
                      <button className="secondary" onClick={() => fileInput.current?.click()}>
                        Attach payload
                      </button>
                      <input ref={fileInput} type="file" hidden onChange={handleAttach} />
                      <button className="primary" onClick={send} title={canShare ? "Seal & Share" : "Seal & Copy Link"}>
                        Exhale (transfer)
                      </button>
                    </>
                  )}

                  {uiState === "readyReceive" && (
                    <button className="primary" onClick={receive}>
                      Accept transfer
                    </button>
                  )}

                  {(meta?.transfers?.length ?? 0) > 0 && (
                    <button className="secondary" onClick={sealSegmentNow} title="Roll current head-window into a segment">
                      Seal segment now
                    </button>
                  )}
                </div>
              </footer>
            </>
          )}
        </div>
      </dialog>

      {/* 🔗 Post-seal modal (auto-registers with Explorer) */}
      <SealMomentModal
        open={sealOpen}
        url={sealUrl}
        hash={sealHash}
        onClose={() => setSealOpen(false)}
        onDownloadZip={downloadZip}
      />

      {/* Φ Valuation modal (render regardless of verified) */}
      {meta && (
        <ValuationModal
          open={valuationOpen}
          onClose={closeValuation}
          meta={metaLite ?? (meta as unknown as SigilMetadataLite)}
          nowPulse={pulseNow}
          initialGlyph={initialGlyph ?? undefined}  // ← NEW: seeds the pool with the uploaded glyph
          // Keep the "Attach valuation" action gated to verified, but allow viewing on mobile anytime
          onAttach={uiState === "verified" ? onAttachValuation : undefined}
        />
      )}

      {/* 🌲 Explorer dialog */}
      <dialog
        ref={explorerDlgRef}
        className="explorer-dialog"
        id="explorer-dialog"
        aria-label="Sigil Explorer"
        data-open={explorerOpen ? "true" : "false"}
        style={{
          width: "100vw",
          maxWidth: "100vw",
          height: "100dvh",
          maxHeight: "100dvh",
          margin: 0,
          padding: 0,
          overflow: "hidden",
        }}
      >
        <div className="explorer-chrome" style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: "100vw" }}>
          <div className="explorer-topbar" style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center" }}>
            <h3 className="explorer-title">ΦStream</h3>
            <button
              className="close-btn holo"
              data-aurora="true"
              aria-label="Close explorer"
              title="Close"
              onClick={closeExplorer}
              style={{ justifySelf: "end", marginRight: 6 }}
            >
              ×
            </button>
          </div>
          <div className="explorer-body" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
            <SigilExplorer />
          </div>
        </div>
      </dialog>
    </div>
  );
};

export default VerifierStamper;

/* Export utility for Explorer/tests */
export { verifyHistorical };

/* ────────────────────────────────────────────────────────────────
   v14 offline verifier (exported): fast, chunked, ZK-aware
   - Validates prev-head pinning, leaf hashes, ECDSA send/receive
   - Ensures ZK stamps match bundles (hash checks), then optional groth16.verify
   - Yields to the browser to keep UI buttery under long histories
────────────────────────────────────────────────────────────────── */
export type SovereignVerifyReport = {
  ok: boolean;
  count: number;
  issues: string[];
  entries: Array<{
    index: number;
    prevHeadOk: boolean;
    send: {
      sigOk: boolean;
      leafOk: boolean | "missing-window";
      zk?: {
        present: boolean;
        stampHashOk?: boolean;
        verified?: boolean | null; // null = groth16 unavailable
      };
    };
    receive?: {
      sigOk: boolean;
      leafOk: boolean | "missing-window";
      zk?: {
        present: boolean;
        stampHashOk?: boolean;
        verified?: boolean | null;
      };
    };
  }>;
};

function isHex(s: string, bytes = 16): boolean {
  return /^[0-9a-f]+$/i.test(s) && s.length === bytes * 2;
}

const YIELD_EVERY = 8;
const rAF = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export async function verifySovereignOffline(head: SigilMetadata): Promise<SovereignVerifyReport> {
  const hardened = head.hardenedTransfers ?? [];
  const windowTransfers = head.transfers ?? [];
  const issues: string[] = [];
  const entries: SovereignVerifyReport["entries"] = [];

  // Optional Φ anchor (informational only)
  if (head.creatorPublicKey && head.userPhiKey) {
    try {
      const phi = await phiFromPublicKey(head.creatorPublicKey);
      if (phi !== head.userPhiKey) issues.push("Φ anchor mismatch (informational)");
    } catch {
      issues.push("Φ anchor decode failed (informational)");
    }
  }

  // Precompute for speed
  const baseCum = sumSegments(head);
  const prevRootsP = Promise.all(hardened.map((_, i) => headCanonicalHashV14(head, baseCum + i)));
  const sendLeavesP = Promise.all(
    hardened.map(async (_t, i) => (windowTransfers[i] ? hashTransferSenderSide(windowTransfers[i]) : null))
  );
  const recvLeavesP = Promise.all(
    hardened.map(async (_t, i) => (windowTransfers[i] ? hashTransfer(windowTransfers[i]) : null))
  );

  const [prevRoots, sendLeaves, recvLeaves] = await Promise.all([prevRootsP, sendLeavesP, recvLeavesP]);

  // Choose a fallback vkey if needed (inline beats global)
  const fallbackVkey = head.zkVerifyingKey ?? (typeof window !== "undefined" ? window.SIGIL_ZK_VKEY : undefined);

  for (let i = 0; i < hardened.length; i++) {
    if (i > 0 && i % YIELD_EVERY === 0) await rAF();

    const t = hardened[i];

    const entry: SovereignVerifyReport["entries"][number] = {
      index: i,
      prevHeadOk: false,
      send: { sigOk: false, leafOk: "missing-window" },
    };

    // prev-head pinning
    entry.prevHeadOk = t.previousHeadRoot === prevRoots[i];
    if (!entry.prevHeadOk) issues.push(`prevHead mismatch at #${i}`);

    // nonce sanity
    if (typeof t.nonce !== "string" || !isHex(t.nonce, 16)) {
      issues.push(`nonce invalid at #${i} (expected 16-byte hex)`);
    }

    // SEND leaf binding
    if (sendLeaves[i]) {
      entry.send.leafOk = t.transferLeafHashSend === sendLeaves[i];
      if (!entry.send.leafOk) issues.push(`sender-side leaf hash mismatch at #${i}`);
    }

    // SEND signature
    {
      const msgS = buildSendMessageV14(head, {
        previousHeadRoot: t.previousHeadRoot,
        senderKaiPulse: t.senderKaiPulse ?? 0,
        senderPubKey: t.senderPubKey ?? "",
        nonce: t.nonce ?? "",
        transferLeafHashSend: t.transferLeafHashSend ?? "",
      });
      entry.send.sigOk = !!t.senderPubKey && (await verifySig(t.senderPubKey, msgS, t.senderSig));
      if (!entry.send.sigOk) issues.push(`send signature invalid at #${i}`);
    }

    // RECEIVE (optional)
    if (t.receiverSig && t.receiverPubKey) {
      entry.receive = { sigOk: false, leafOk: "missing-window" };

      if (recvLeaves[i]) {
        entry.receive.leafOk = t.transferLeafHashReceive === recvLeaves[i];
        if (!entry.receive.leafOk) issues.push(`receive leaf hash mismatch at #${i}`);
      }

      const msgR = buildReceiveMessageV14({
        previousHeadRoot: t.previousHeadRoot,
        senderSig: t.senderSig,
        receiverKaiPulse: t.receiverKaiPulse ?? 0,
        receiverPubKey: t.receiverPubKey,
        transferLeafHashReceive: t.transferLeafHashReceive ?? "",
      });
      entry.receive.sigOk = await verifySig(t.receiverPubKey, msgR, t.receiverSig);
      if (!entry.receive.sigOk) issues.push(`receive signature invalid at #${i}`);
    }

    // ZK SEND (optional): stamp/bundle hash checks + verify
    if (t.zkSendBundle) {
      entry.send.zk = { present: true };

      const b = t.zkSendBundle;
      const publicHash = await hashAny(b.publicSignals);
      const proofHash = await hashAny(b.proof);
      const vkeyChosen = b.vkey ?? fallbackVkey;
      const vkeyHash = vkeyChosen ? await hashAny(vkeyChosen) : undefined;

      const stampOk =
        t.zkSend &&
        t.zkSend.scheme === "groth16" &&
        (t.zkSend.curve ? t.zkSend.curve === "BLS12-381" : true) &&
        t.zkSend.publicHash === publicHash &&
        t.zkSend.proofHash === proofHash &&
        (t.zkSend.vkeyHash ? t.zkSend.vkeyHash === vkeyHash : true);

      entry.send.zk.stampHashOk = !!stampOk;
      if (!stampOk) issues.push(`ZK SEND stamp/bundle hash mismatch at #${i}`);

      const verified = await tryVerifyGroth16({
        proof: b.proof,
        publicSignals: b.publicSignals,
        vkey: b.vkey,
        fallbackVkey,
      });
      entry.send.zk.verified = verified;
      if (t.zkSend) t.zkSend.verified = verified === true;
      if (verified === false) issues.push(`ZK SEND verification failed at #${i}`);
    } else if (t.zkSend) {
      entry.send.zk = { present: false };
    }

    // ZK RECEIVE (optional)
    if (t.zkReceiveBundle) {
      if (!entry.receive) entry.receive = { sigOk: false, leafOk: "missing-window" };
      entry.receive.zk = { present: true };

      const b = t.zkReceiveBundle;
      const publicHash = await hashAny(b.publicSignals);
      const proofHash = await hashAny(b.proof);
      const vkeyChosen = b.vkey ?? fallbackVkey;
      const vkeyHash = vkeyChosen ? await hashAny(vkeyChosen) : undefined;

      const stampOk =
        t.zkReceive &&
        t.zkReceive.scheme === "groth16" &&
        (t.zkReceive.curve ? t.zkReceive.curve === "BLS12-381" : true) &&
        t.zkReceive.publicHash === publicHash &&
        t.zkReceive.proofHash === proofHash &&
        (t.zkReceive.vkeyHash ? t.zkReceive.vkeyHash === vkeyHash : true);

      entry.receive.zk.stampHashOk = !!stampOk;
      if (!stampOk) issues.push(`ZK RECV stamp/bundle hash mismatch at #${i}`);

      const verified = await tryVerifyGroth16({
        proof: b.proof,
        publicSignals: b.publicSignals,
        vkey: b.vkey,
        fallbackVkey,
      });
      entry.receive.zk.verified = verified;
      if (t.zkReceive) t.zkReceive.verified = verified === true;
      if (verified === false) issues.push(`ZK RECV verification failed at #${i}`);
    }

    // Monotonicity hint (non-fatal)
    if (i > 0 && hardened[i - 1].senderKaiPulse != null && t.senderKaiPulse != null) {
      if ((t.senderKaiPulse as number) < (hardened[i - 1].senderKaiPulse as number)) {
        issues.push(`senderKaiPulse decreased at #${i}`);
      }
    }

    entries.push(entry);
  }

  return { ok: issues.length === 0, count: hardened.length, issues, entries };
}
