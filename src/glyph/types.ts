// src/glyph/types.ts
// 🜂 Kairos Recursive Glyph Types — Eternal Memory Format
// Authored in harmonic honor, Phi-aligned, scroll-ready.

/*
  This module defines the full, type-safe model for Kairos glyphs used across
  import, valuation, portfolio accounting, provenance, and UI layers.

  Highlights
  — Strong nominal types for HashHex, KaiPulse, Phi.
  — Complete Glyph shape with parsed Sigil metadata and optional ValueSeal.
  — Provenance, transfers, inhalation (recursive), and notes.
  — Ledger-friendly balance change/event types for portfolio accounting.
  — Import/validation result types used by the GlyphImportModal.
  — Useful type guards and tiny helpers (pure, no side effects).
*/

import type {
  SigilMetadataLite,
  ValueSeal,
  HashHex as ValHashHex,
} from "../utils/valuation";

/* --------------------------------- brands --------------------------------- */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type HashHex = ValHashHex; // keep identical to valuation layer
export type KaiPulse = Brand<number, "KaiPulse">;
export type Phi = Brand<number, "Phi">; // Φ (coherent breaths)

/* ------------------------------- core enums -------------------------------- */
export enum GlyphValidationStatus {
  Checking = "checking",
  Verified = "ok",
  Unsigned = "warn",
  Invalid = "err",
}

export enum BalanceChangeReason {
  Import = "import",
  Inhale = "inhale",
  Send = "send",
  Receive = "receive",
  Adjust = "adjust",
}

/* ------------------------------- provenance -------------------------------- */
export interface GlyphProvenance {
  // lineage
  parentHash?: HashHex;      // optional direct parent (duplicated at top level for legacy)
  rootHash?: HashHex;        // earliest ancestor if tracked
  depth?: number;            // generations from root
  // external/origin hints
  originNote?: string;
}

/* --------------------------------- transfers ------------------------------- */
export interface SentTransfer {
  id?: string;               // optional local id for UI tracking
  recipientHash: string;     // Glyph hash (or signature) of the recipient
  amount: number;            // Value sent in Φ (use Phi in portfolio layer)
  pulseSent: number;         // Pulse of the send event (sender's pulse)
  note?: string;             // Optional memo
}

export interface ReceivedTransfer {
  id?: string;               // optional local id
  senderHash: string;        // Glyph hash (or signature) of the sender
  amount: number;            // Φ received
  pulseReceived: number;     // receiver pulse
  note?: string;
}

/* ------------------------------- inhalation -------------------------------- */
export interface InhaledGlyph {
  glyphHash?: HashHex;       // optional ref (helps when eliding deep recursion)
  glyph: Glyph;              // the embedded glyph (recursive)
  amountUsed: number;        // how much Φ was extracted from this glyph
  pulseInhaled: number;      // pulse when this glyph was inhaled
}

/* --------------------------------- metadata -------------------------------- */
export interface GlyphMetadata {
  name?: string;
  message?: string;
  tags?: string[];
  creator?: string;          // userPhiKey or identity stamp (display)
  kaiSignature?: string;     // breath-bound signature of origin for this glyph
  timestamp?: number;        // Epoch timestamp (optional for sorting)
  coverUrl?: string;         // optional image/preview
  color?: string;            // UI accent color
}

/* --------------------------------- glyph ----------------------------------- */
export interface Glyph {
  // Identity + Time
  hash: string;                         // Unique glyph ID (KaiSignature + pulse)
  pulseCreated: number;                 // Pulse when this glyph was created
  pulseGenesis?: number;                // Optional — parent pulse for derivative glyphs

  // Value & Dynamics
  value: number;                        // Current Φ value held
  growthRate?: number;                  // Optional — passive Φ growth per pulse

  // Provenance & Transfer
  sentTo?: SentTransfer[];              // Outbound transfers from this glyph
  receivedFrom?: ReceivedTransfer[];    // Inbound transfers recorded locally (optional)
  sentFrom?: string;                    // Optional — hash of the glyph it came from
  parentHash?: HashHex;                 // ← legacy/fast access to direct parent
  provenance?: GlyphProvenance;         // Optional — enriched lineage (also has parentHash)
  note?: string;                        // Optional message or annotation

  // Recursive Memory Inhalation
  inhaled?: Record<string, InhaledGlyph>; // Glyphs recursively inhaled into this one

  // Parsed Kairos Sigil metadata (SVG/JSON) + optional computed valuation.
  // Matches the valuation pipeline so components can read/write stamps directly.
  meta?: SigilMetadataLite & { valuation?: ValueSeal };

  // UI/Display metadata (titles, tags, creator label, etc.)
  // Kept separate from `meta` so we don't pollute/ver-spec the sigil head.
  metadata?: GlyphMetadata;
}

/* ------------------------------- snapshots --------------------------------- */
export interface GlyphSnapshot {
  glyph: Glyph;
  atPulse: number;          // when captured
  value: number;            // value at snapshot (pre-rendered for speed)
}

export interface GlyphWithValuation extends Glyph {
  meta: SigilMetadataLite & { valuation: ValueSeal };
}

/* --------------------------------- import ---------------------------------- */
export interface GlyphImportPreview {
  hash: string;             // canonical hash derived from meta
  value: number;            // value detected/derived pre-stamp (Φ)
  pulse: number;            // pulse (from meta)
}

export interface GlyphImportResult {
  status: GlyphValidationStatus;
  error?: string | null;
  unsigned: boolean;              // true if meta lacked kaiSignature
  preview?: GlyphImportPreview | null;
  glyph?: Glyph | null;           // constructed glyph (if valid)
  rawSvg?: string;                // original SVG text if provided
  rawJson?: unknown;              // original JSON if provided
}

/* --------------------------------- balance --------------------------------- */
export interface BalanceSnapshot {
  totalPhi: Phi;
  lastUpdatedPulse: KaiPulse;
}

export interface BalanceChange {
  delta: Phi;                      // signed; + import/receive, − send/inhale
  reason: BalanceChangeReason;
  atPulse: KaiPulse;
  glyphHash?: HashHex;             // which glyph drove the change
  note?: string;
}

/* ------------------------------ serialization ------------------------------ */
export type SerializedGlyph = Omit<Glyph, "inhaled"> & {
  inhaled?: Record<string, { glyphHash?: HashHex; amountUsed: number; pulseInhaled: number }>;
};

/* ------------------------------ type guards -------------------------------- */
export function hasMeta(g: Glyph | undefined | null): g is Glyph & { meta: SigilMetadataLite } {
  return !!g && typeof g === "object" && !!(g as Glyph).meta;
}

export function hasValuation(g: Glyph | undefined | null): g is GlyphWithValuation {
  return !!g && !!(g as Glyph).meta && !!(g as Glyph).meta!.valuation;
}

/* --------------------------------- helpers --------------------------------- */
export const asPhi = (n: number): Phi => n as Phi;
export const asKaiPulse = (n: number): KaiPulse => n as KaiPulse;

export function cloneGlyph(g: Glyph): Glyph {
  return JSON.parse(JSON.stringify(g)) as Glyph;
}

export function emptyGlyph(seed?: Partial<Glyph>): Glyph {
  return {
    hash: seed?.hash ?? "",
    pulseCreated: seed?.pulseCreated ?? 0,
    pulseGenesis: seed?.pulseGenesis,
    value: seed?.value ?? 0,
    growthRate: seed?.growthRate,
    sentTo: seed?.sentTo ?? [],
    receivedFrom: seed?.receivedFrom ?? [],
    sentFrom: seed?.sentFrom,
    parentHash: seed?.parentHash,      // ← ensure legacy callers get it
    provenance: seed?.provenance,
    note: seed?.note,
    inhaled: seed?.inhaled ?? {},
    meta: seed?.meta,
    metadata: seed?.metadata,
  };
}

// Safe add/sub helpers for Φ (typed in portfolio layer)
export function addPhi(a: number, b: number): number {
  const x = (a ?? 0) + (b ?? 0);
  return Number.isFinite(x) ? x : 0;
}

export function subPhi(a: number, b: number): number {
  const x = (a ?? 0) - (b ?? 0);
  return Number.isFinite(x) ? x : 0;
}

/* ------------------------------ mutations API ------------------------------ */
export interface ApplyImportParams {
  imported: Glyph;                 // newly imported glyph (with meta)
  addAmountPhi?: number;           // optional amount to credit to balance on import
}

export interface RecordSendParams {
  from: Glyph;
  toGlyphHash: string;
  amountPhi: number;
  atPulse: number;
  note?: string;
}

export interface RecordInhaleParams {
  host: Glyph;                     // host glyph receiving the inhaled one
  inhaled: Glyph;                  // glyph being inhaled
  amountPhi: number;               // Φ extracted from child
  atPulse: number;
}

export type GlyphMutation =
  | { kind: "applyImport"; params: ApplyImportParams }
  | { kind: "recordSend"; params: RecordSendParams }
  | { kind: "recordInhale"; params: RecordInhaleParams };

/*
  NOTE: This file intentionally does not implement the mutation functions; keep
  side-effectful portfolio math in a reducer/service. The types above ensure
  every callsite passes complete, validated data.
*/
