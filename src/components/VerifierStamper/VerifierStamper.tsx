// src/components/verifier/VerifierStamper.tsx
/* ────────────────────────────────────────────────────────────────
   VerifierStamper.tsx · Divine Sovereign Transfer Gate (mobile-first)
   v23.1 — CONTINUOUS FLOW (no archival on segmentation)
   SEND/RECEIVE RULES (KKS v1 exact expiry)
   - Parent (original glyph):
     • Can SEND.
     • Can SEGMENT freely. Segmentation rolls the current head window
       into a segment file and resets the head window, BUT DOES NOT
       retire or archive the parent. The glyph keeps breathing.
     • Each SEND deducts from Remaining Φ on the parent.
   - Child file (the one that is *sent*; filename contains “sigil_send”):
     • May only RECEIVE, and only for 11 steps (11 pulses/step → +121 pulses).
     • After expiry: RECEIVE is permanently disabled (“archived” conceptually),
       but segmentation is still forbidden on these child SEND files.
     • IMPORTANT: A file whose name contains “sigil_send” can NEVER SEGMENT. Ever.
     • Once RECEIVED (closed), the saved file (downloaded as “sigil_receive…svg”)
       is promoted to a normal parent: it can SEND, SEGMENT, grow, and its Remaining Φ
       starts at the received balance.
   - One-time send lock on child links is enforced.
   - Expiry: all sends expire after 11 steps (11 pulses/step → +121 pulses).

   NOTE: Segmentation no longer implies archival. The head keeps operating.
────────────────────────────────────────────────────────────────── */

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import "./VerifierStamper.css";
import SendPhiAmountField from "./SendPhiAmountField";

/* Error boundary prevents the whole app from crashing if VerifierStamper throws */
class VerifierErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset?: () => void },
  { hasError: boolean; error?: unknown }
> {
  constructor(props: { children: React.ReactNode; onReset?: () => void }) {
    super(props);
    this.state = { hasError: false, error: undefined };
  }
  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error };
  }
  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[VerifierStamper] crashed", error, info);
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("kk:error", {
            detail: { where: "VerifierStamper", error: error instanceof Error ? error.message : String(error) },
          })
        );
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[VerifierStamper] failed to dispatch kk:error", e);
    }
  }
  render() {
    if (this.state.hasError) {
      const msg = this.state.error instanceof Error ? this.state.error.message : String(this.state.error ?? "Unknown error");
      const stack = this.state.error instanceof Error ? this.state.error.stack : undefined;
      return (
        <div role="alert" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <strong>Verifier crashed</strong>
            <button
              className="secondary"
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
                this.props.onReset?.();
              }}
              title="Reset Verifier"
              aria-label="Reset Verifier"
            >
              Reset
            </button>
          </div>
          <div style={{ fontSize: 14, color: "var(--dim, #999)" }}>{msg}</div>
          {stack && (
            <details style={{ marginTop: 8 }}>
              <summary>Stack</summary>
              <pre style={{ whiteSpace: "pre-wrap" }}>{stack}</pre>
            </details>
          )}
        </div>
      );
    }
    return <>{this.props.children}</>;
  }
}

/* Explorer + Seal + Valuation (kept; they’re used in flows) */
import SealMomentModal from "../SealMomentModalTransfer";
import SigilExplorer from "../SigilExplorer";
import ValuationModal from "../ValuationModal";
import {
  buildValueSeal,
  attachValuation,
  type SigilMetadataLite,
  type ValueSeal,
} from "../../utils/valuation";

/* Note (kept) */
import NotePrinter from "../ExhaleNote";
import type { VerifierBridge, BanknoteInputs as NoteBanknoteInputs } from "../exhale-note/types";

/* URL helpers */
import {
  makeSigilUrl,
  type SigilSharePayloadLoose,
  encodeSigilHistory,
  type SigilTransferLite,
} from "../../utils/sigilUrl";

/* Local imports */
import { kaiPulseNow, SIGIL_CTX, SIGIL_TYPE, SEGMENT_SIZE } from "./constants";
import type {
  SigilMetadata,
  UiState,
  TabKey,
  ChakraDay,
  SigilTransfer,
  HardenedTransferV14,
  SigilPayload,
} from "./types";
import { normalizeChakraDay } from "./types";
import { sha256Hex, phiFromPublicKey } from "./crypto";
import { loadOrCreateKeypair, signB64u, type Keypair } from "./keys";
import { parseSvgFile, centrePixelSignature, embedMetadata, pngBlobFromSvgDataUrl } from "./svg";
import { pulseFilename, safeFilename, download, fileToPayload } from "./files";
import {
  computeKaiSignature,
  derivePhiKeyFromSig,
  computeHeadWindowRoot,
  expectedPrevHeadRootV14,
  stableStringify,
  hashTransfer,
  hashTransferSenderSide,
  base64urlJson,
  genNonce,
} from "./sigilUtils";
import { buildMerkleRoot, merkleProof, verifyProof } from "./merkle";
import { sealCurrentWindowIntoSegment } from "./segments";
import { verifyHistorical } from "./verifyHistorical";
import { verifyZkOnHead } from "./zk";

/* Valuation model (still used for USD conversion only) */
import { DEFAULT_ISSUANCE_POLICY, quotePhiForUsd } from "../../utils/phi-issuance";
import { BREATH_MS } from "../valuation/constants";

/* Local send ledger */
import { recordSend, getSpentScaledFor, markConfirmedByLeaf } from "../../utils/sendLedger";

/* ────────────────────────────────────────────────────────────────
   CHILD CONTEXT + ONE-TIME SEND + EXPIRY
────────────────────────────────────────────────────────────────── */
const PULSES_PER_STEP = 11; // Kai canon: 11 pulses/step
const CLAIM_STEPS = 11;     // all sends expire after 11 steps
const CLAIM_PULSES = CLAIM_STEPS * PULSES_PER_STEP;

/* Helper type: optional fields that may exist in metadata */
type SigilMetadataWithOptionals = SigilMetadata & {
  stepsPerBeat?: number;
  transfersWindowRoot?: string;
  transfersWindowRootV14?: string;
  zkVerifyingKey?: unknown;
  creatorPublicKey?: string;

  /* Persist branch balance across segmentations (decimal strings, up to 18dp) */
  branchBasePhi?: string;
  branchSpentPhi?: string;

  /* Persisted CHILD context (set on SEND file) */
  childOfHash?: string;               // parent canonical hash
  childAllocationPhi?: string;        // fixed allocation for this child
  childIssuedPulse?: number;          // pulse when child was minted
  childClaim?: {
    steps: number;                    // always 11
    expireAtPulse: number;            // issued + 121
  };
  sendLock?: {
    nonce: string;
    used?: boolean;                   // flips true on receive
    usedPulse?: number;
  };
};

/* ────────────────────────────────────────────────────────────────
   UI state helper (SEND-SIGIL MODE)
   - Child SEND file: receive-only before expiry; cannot segment ever.
   - After expiry: child is effectively archived for RECEIVE, but
     it can still later be promoted (once received) and behave like
     a parent. Segmentation is still forbidden while it's a SEND file.
   - After receive (closed), the saved file can send/segment like a parent.
   - IMPORTANT: A closed RECEIVE (downloaded as “sigil_receive*.svg”) is
     promoted — uploading that should allow SEND.
   - NOTE: segmentation never archives; parent stays active.
────────────────────────────────────────────────────────────────── */
function deriveState(params: {
  contextOk: boolean;
  typeOk: boolean;
  hasCore: boolean;
  contentSigMatches: boolean | null;
  isOwner: boolean | null;
  hasTransfers: boolean;
  lastOpen: boolean;
  lastClosed: boolean;
  isUnsigned: boolean;
  childUsed: boolean;
  childExpired: boolean;
  parentOpenExpired: boolean;
  isChildContext: boolean;
}): UiState {
  const {
    contextOk, typeOk, hasCore, contentSigMatches, isOwner, hasTransfers, lastOpen, lastClosed,
    isUnsigned, childUsed, childExpired, parentOpenExpired, isChildContext
  } = params;

  if (!contextOk || !typeOk) return "invalid";
  if (!hasCore) return "structMismatch";
  if (contentSigMatches === false) return "sigMismatch";
  if (isOwner === false) return "notOwner";
  if (isUnsigned) return "unsigned";

  // If a transfer is open…
  if (lastOpen) {
    // CHILD expired or PARENT expired = can't receive anymore, treat as complete receipt
    if (childExpired || parentOpenExpired) return "complete";
    return "readyReceive";
  }

  // No open transfer:
  if (isChildContext) {
    // Promotion rule: once received (closed) OR explicit one-time lock used -> can send
    if (childUsed || (hasTransfers && lastClosed)) return "readySend";
    // Unused child (still a SEND file) cannot send yet
    return "complete";
  }

  // Parent context and not expired -> can SEND
  return "readySend";
}

/** Append p/t/h params to base URL */
function rewriteUrlPayload(
  baseUrl: string,
  enriched: SigilSharePayloadLoose & { canonicalHash?: string; transferNonce?: string },
  token?: string,
  historyParam?: string
): string {
  const origin =
    typeof window !== "undefined" && typeof window.location?.origin === "string"
      ? window.location.origin
      : "http://localhost";
  const u = new URL(baseUrl, origin);
  u.searchParams.set("p", base64urlJson(enriched));
  if (token) u.searchParams.set("t", token);
  if (historyParam && historyParam.length > 0) u.searchParams.set("h", historyParam);
  return u.toString();
}

/* ────────────────────────────────────────────────────────────────
   Note bridge helpers
────────────────────────────────────────────────────────────────── */
declare global {
  interface Window {
    KKVerifier?: VerifierBridge | undefined;
    SIGIL_ZK_VKEY?: unknown;
    /* KEEP IDENTICAL to earliest declaration across app to avoid TS2717 */
    SIGIL_ZK?: {
      provideSendProof?: (args: {
        meta: SigilMetadata;
        leafHash: string;
        previousHeadRoot: string;
        nonce: string;
      }) => Promise<{ proof: unknown; publicSignals: unknown; vkey?: unknown } | null>;
      provideReceiveProof?: (args: {
        meta: SigilMetadata;
        leafHash: string;
        previousHeadRoot: string;
        linkSig: string;
      }) => Promise<{ proof: unknown; publicSignals: unknown; vkey?: unknown } | null>;
    };
    __SIGIL__?: { registerSigilUrl?: (url: string) => void } | undefined;
  }
}

/* ────────────────────────────────────────────────────────────────
   Utils (logging + b64 UTF-8)
────────────────────────────────────────────────────────────────── */
function logError(where: string, err: unknown) {
  // eslint-disable-next-line no-console
  console.error(`[VerifierStamper] ${where}`, err);
  try {
    window.dispatchEvent(
      new CustomEvent("kk:error", {
        detail: {
          where,
          error: err instanceof Error ? err.message : String(err),
        },
      })
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[VerifierStamper] kk:error dispatch failed in ${where}`, e);
  }
}

function base64EncodeUtf8(str: string): string {
  try {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
    if (typeof btoa === "function") return btoa(bin);
  } catch (err) {
    logError("base64EncodeUtf8", err);
  }
  return ""; // last resort
}

function base64DecodeUtf8(b64: string): string {
  try {
    if (typeof atob !== "function") throw new Error("atob is not available in this environment");
    const bin: string = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch (err) {
    logError("base64DecodeUtf8", err);
    return "";
  }
}


/* Safe readers */
function readStrObj(o: unknown, k: string, fb = ""): string {
  if (typeof o === "object" && o !== null) {
    const v = (o as Record<string, unknown>)[k];
    if (typeof v === "string") return v;
  }
  return fb;
}

function readNumObj(o: unknown, k: string): number | undefined {
  if (typeof o === "object" && o !== null) {
    const v = (o as Record<string, unknown>)[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}

/* Build printable Note payload */
function buildNotePayload(opts: {
  meta: SigilMetadata | null;
  sigilSvgRaw: string | null;
  verifyUrl?: string;
  pulseNow: number;
}): NoteBanknoteInputs {
  const { meta: m, sigilSvgRaw, verifyUrl, pulseNow } = opts;
  if (!m) return { nowPulse: String(pulseNow) };

  const valuation = (m.valuation ?? null) as {
    valuePhi?: number;
    premiumPhi?: number;
    algorithm?: string | number;
    stamp?: string | number;
  } | null;

  const safeBeat = readNumObj(m as unknown, "beat") ?? m.beat ?? 0;
  const safeStepIndex = readNumObj(m as unknown, "stepIndex") ?? m.stepIndex ?? 0;
  const safePulse = readNumObj(m as unknown, "pulse") ?? m.pulse ?? 0;

  const prov = (m.transfers ?? []).map((t) => ({
    action: t.receiverSignature ? ("receive" as const) : ("send" as const),
    pulse: t.senderKaiPulse,
    beat: safeBeat,
    stepIndex: safeStepIndex,
    ownerPhiKey: (m as SigilMetadataWithOptionals).userPhiKey,
  }));

  const extraObj = m as Record<string, unknown>;
  const maybeZk = extraObj.zk as unknown;
  let zkField: { scheme?: string; poseidon?: string } | undefined;
  if (typeof maybeZk === "object" && maybeZk !== null) {
    const zkMap = maybeZk as Record<string, unknown>;
    const scheme = typeof zkMap.scheme === "string" ? zkMap.scheme : undefined;
    const poseidonVal = typeof zkMap.poseidon === "string" ? zkMap.poseidon : undefined;
    zkField = scheme ? { scheme, poseidon: poseidonVal } : undefined;
  }

  return {
    purpose: readStrObj(m, "purpose"),
    to: readStrObj(m, "to"),
    from: readStrObj(m, "from"),
    location: readStrObj(m, "location"),
    witnesses: readStrObj(m, "witnesses"),
    reference: readStrObj(m, "reference"),
    remark: readStrObj(m, "remark", "In Yahuah We Trust — Secured by Φ, not man-made law"),
    valuePhi: typeof valuation?.valuePhi === "number" ? String(valuation.valuePhi) : "",
    premiumPhi: typeof valuation?.premiumPhi === "number" ? String(valuation.premiumPhi) : "",
    computedPulse: typeof safePulse === "number" ? String(safePulse) : "",
    nowPulse: String(pulseNow),
    kaiSignature: typeof (m as SigilMetadataWithOptionals).kaiSignature === "string" ? (m as SigilMetadataWithOptionals).kaiSignature : "",
    userPhiKey: typeof (m as SigilMetadataWithOptionals).userPhiKey === "string" ? (m as SigilMetadataWithOptionals).userPhiKey : "",
    sigmaCanon: readStrObj(extraObj, "sigmaCanon"),
    shaHex: readStrObj(extraObj, "shaHex"),
    phiDerived: readStrObj(extraObj, "phiDerived"),
    valuationAlg: valuation?.algorithm != null ? String(valuation.algorithm) : "",
    valuationStamp: valuation?.stamp != null ? String(valuation.stamp) : "",
    provenance: prov.slice(-7),
    zk: zkField,
    sigilSvg: sigilSvgRaw ?? "",
    verifyUrl: verifyUrl || "",
  };
}

/* ────────────────────────────────────────────────────────────────
   Decimal toolkit (Φ uses SCALE=18)
────────────────────────────────────────────────────────────────── */
const SCALE = 18n;
function pow10(n: bigint): bigint {
  let r = 1n;
  for (let i = 0n; i < n; i += 1n) r *= 10n;
  return r;
}
const TEN_S = pow10(SCALE);
function toScaledBig(s: string): bigint {
  const t = (s || "").trim();
  if (!t) return 0n;
  const sign = t.startsWith("-") ? -1n : 1n;
  const clean = t.replace(/[^0-9.]/g, "").replace(/^\.*/, (m) => (m ? "0." : ""));
  const [iRaw, fRaw = ""] = clean.split(".");
  const i = iRaw.replace(/^0+(?=\d)/, "") || "0";
  const f = (fRaw + "0".repeat(Number(SCALE))).slice(0, Number(SCALE));
  const whole = BigInt(i) * TEN_S + BigInt(f || "0");
  return sign * whole;
}
function fromScaledBig(bi: bigint): string {
  const sign = bi < 0n ? "-" : "";
  const v = bi < 0n ? -bi : bi;
  const intPart = v / TEN_S;
  let frac = (v % TEN_S).toString().padStart(Number(SCALE), "0");
  frac = frac.replace(/0+$/, "");
  return frac.length ? `${sign}${intPart}.${frac}` : `${sign}${intPart}`;
}
function mulScaled(a: bigint, b: bigint): bigint {
  return (a * b) / TEN_S;
}
function divScaled(a: bigint, b: bigint): bigint {
  if (b === 0n) return 0n;
  return (a * TEN_S) / b;
}
function roundScaledToDecimals(bi: bigint, decimals: number): bigint {
  const d = Math.max(0, Math.min(Number(SCALE), decimals));
  const factor = pow10(SCALE - BigInt(d));
  const half = factor / 2n;
  return bi >= 0n ? ((bi + half) / factor) * factor : ((bi - half) / factor) * factor;
}
function fromScaledBigFixed(bi: bigint, decimals: number): string {
  const d = Math.max(0, Math.min(Number(SCALE), decimals));
  const sign = bi < 0n ? "-" : "";
  const v = bi < 0n ? -bi : bi;
  const cut = pow10(SCALE - BigInt(d));
  const val = v / cut;
  const tenD = pow10(BigInt(d));
  const intPart = val / tenD;
  const frac = (val % tenD).toString().padStart(d, "0");
  return `${sign}${intPart}.${frac}`;
}
function fmtPhiFixed4(phiStr: string): string {
  const scaled = toScaledBig(phiStr);
  const rounded = roundScaledToDecimals(scaled, 4);
  return fromScaledBigFixed(rounded, 4);
}

/* Extract exhaled amount from a transfer (scaled Φ bigint) */
function exhalePhiFromTransferScaled(t: SigilTransfer | undefined): bigint {
  if (!t?.payload) return 0n;
  if (!t.payload.mime?.startsWith("application/vnd.kairos-exhale")) return 0n;
  try {
    const raw = base64DecodeUtf8(t.payload.encoded);
    const obj = JSON.parse(raw) as { kind?: string; amountPhi?: string } | null;
    if (obj?.kind === "exhale" && typeof obj.amountPhi === "string") return toScaledBig(obj.amountPhi);
  } catch (err) {
    logError("exhalePhiFromTransferScaled", err);
  }
  return 0n;
}

/* ────────────────────────────────────────────────────────────────
   Rotation bus (unchanged)
────────────────────────────────────────────────────────────────── */
const ROTATE_CH = "sigil-xfer-v1";
const rotationKey = (h: string) => `sigil:rotated:${h}`;
type RotationMsg = { type: "rotated"; canonical: string; token: string };
const publishRotation = (keys: string[], token: string): void => {
  const uniq = Array.from(
    new Set(
      (keys ?? [])
        .map((k) => String(k || "").toLowerCase())
        .filter((v) => v.length > 0)
    )
  );
  for (const canonical of uniq) {
    try {
      localStorage.setItem(rotationKey(canonical), `${token}@${Date.now()}`);
    } catch (err) {
      logError("publishRotation.localStorage", err);
    }
    try {
      const bc = new BroadcastChannel(ROTATE_CH);
      const msg: RotationMsg = { type: "rotated", canonical, token };
      bc.postMessage(msg);
      bc.close();
    } catch (err) {
      logError("publishRotation.bc", err);
    }
    try {
      window.dispatchEvent(new CustomEvent("sigil:transfer-rotated", { detail: { canonical, token } }));
    } catch (err) {
      logError("publishRotation.dispatch", err);
    }
  }
};

/* __SIGIL__ compat */
type SendRecord = {
  parentCanonical: string;
  childCanonical: string;
  amountPhiScaled: string;
  senderKaiPulse: number;
  transferNonce: string;
  senderStamp: string;
  previousHeadRoot: string;
  transferLeafHashSend: string;
};
type SigilGlobal = {
  registerSigilUrl?: (url: string) => void;
  registerSend?: (rec: SendRecord) => void;
};
function getSigilGlobal(): SigilGlobal {
  const anyWin = window as unknown as { __SIGIL__?: Record<string, unknown> };
  if (!anyWin.__SIGIL__) anyWin.__SIGIL__ = {};
  const base = anyWin.__SIGIL__ as Record<string, unknown>;
  const regUrl = typeof base.registerSigilUrl === "function" ? (base.registerSigilUrl as (url: string) => void) : undefined;
  const regSend = typeof base.registerSend === "function" ? (base.registerSend as (rec: SendRecord) => void) : undefined;
  return { registerSigilUrl: regUrl, registerSend: regSend };
}

/* ═════════════ COMPONENT ═════════════ */
const VerifierStamperInner: React.FC = () => {
  const svgInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dlgRef = useRef<HTMLDialogElement>(null);
  const explorerDlgRef = useRef<HTMLDialogElement>(null);

  const [pulseNow, setPulseNow] = useState<number>(kaiPulseNow());
  useEffect(() => {
    const id = window.setInterval(() => setPulseNow(kaiPulseNow()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const [svgURL, setSvgURL] = useState<string | null>(null);
  const [sourceFilename, setSourceFilename] = useState<string | null>(null); // keep original file name
  const [rawMeta, setRawMeta] = useState<string | null>(null);
  const [meta, setMeta] = useState<SigilMetadata | null>(null);

  const [contentSigExpected, setContentSigExpected] = useState<string | null>(null);
  const [contentSigMatches, setContentSigMatches] = useState<boolean | null>(null);
  const [phiKeyExpected, setPhiKeyExpected] = useState<string | null>(null);
  const [phiKeyMatches, setPhiKeyMatches] = useState<boolean | null>(null);

  const [liveSig, setLiveSig] = useState<string | null>(null);
  const [rgbSeed, setRgbSeed] = useState<[number, number, number] | null>(null);

  const [payload, setPayload] = useState<SigilPayload | null>(null);

  const [amountMode, setAmountMode] = useState<"USD" | "PHI">("PHI");
  const [phiInput, setPhiInput] = useState<string>("");
  const [usdInput, setUsdInput] = useState<string>("");

  const [uiState, setUiState] = useState<UiState>("idle");
  const [tab, setTab] = useState<TabKey>("summary");
  const [error, setError] = useState<string | null>(null);
  const [viewRaw, setViewRaw] = useState<boolean>(false);

  const [headProof, setHeadProof] = useState<{ ok: boolean; index: number; root: string } | null>(null);

  const [sealOpen, setSealOpen] = useState<boolean>(false);
  const [sealUrl, setSealUrl] = useState<string>("");
  const [sealHash, setSealHash] = useState<string>("");
  const [explorerOpen, setExplorerOpen] = useState<boolean>(false);
  const [valuationOpen, setValuationOpen] = useState<boolean>(false);

  const noteDlgRef = useRef<HTMLDialogElement>(null);
  const [noteOpen, setNoteOpen] = useState<boolean>(false);

  const [sigilSvgRaw, setSigilSvgRaw] = useState<string | null>(null);

  const [rotateOut, setRotateOut] = useState<boolean>(false);
  useEffect(() => {
    const d = dlgRef.current;
    if (!d) return;
    if (rotateOut) d.setAttribute("data-rotate", "true");
    else d.removeAttribute("data-rotate");
  }, [rotateOut]);

  /* Device key */
  const [me, setMe] = useState<Keypair | null>(null);
  useEffect(() => {
    (async () => {
      try {
        setMe(await loadOrCreateKeypair());
      } catch (err) {
        logError("loadOrCreateKeypair", err);
      }
    })();
  }, []);

  /* Load verifying key (best-effort) */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/verification_key.json", { cache: "no-store" });
        if (!res.ok) return;
        const vkey: unknown = await res.json();
        if (!alive) return;
        window.SIGIL_ZK_VKEY = vkey;
      } catch (err) {
        logError("fetch(/verification_key.json)", err);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* Canonical (parent or child) + context flag */
  const [canonical, setCanonical] = useState<string | null>(null);
  const [canonicalContext, setCanonicalContext] = useState<"parent" | "derivative" | null>(null);

  /* Modal open/close helpers */
  const openVerifier = () => {
    const d = dlgRef.current;
    if (d) safeShowDialog(d);
  };
  const closeVerifier = () => {
    dlgRef.current?.close();
    dlgRef.current?.setAttribute("data-open", "false");
  };
  const openExplorer = () => {
    const d = explorerDlgRef.current;
    if (d) {
      safeShowDialog(d);
      setExplorerOpen(true);
    }
  };
  const closeExplorer = () => {
    explorerDlgRef.current?.close();
    explorerDlgRef.current?.setAttribute("data-open", "false");
    setExplorerOpen(false);
  };

  function safeShowDialog(d: HTMLDialogElement | null | undefined) {
    if (!d) return;
    try {
      if (!d.open) d.showModal();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[VerifierStamper] showModal failed; falling back to show()", e);
      d.show?.();
    }
    d.setAttribute("data-open", "true");
  }
  function switchModal(current: HTMLDialogElement | null | undefined, openNext: () => void) {
    if (!current || !current.open) {
      window.setTimeout(openNext, 0);
      return;
    }
    const onClosed = () => {
      current.removeEventListener("close", onClosed);
      window.setTimeout(openNext, 0);
    };
    current.addEventListener("close", onClosed, { once: true });
    current.close();
  }

  /* Note hydration */
  const noteInitial = useMemo<NoteBanknoteInputs>(() => {
    return buildNotePayload({
      meta,
      sigilSvgRaw,
      verifyUrl: sealUrl || (typeof window !== "undefined" ? window.location.href : ""),
      pulseNow,
    });
  }, [meta, sigilSvgRaw, sealUrl, pulseNow]);

  const openNote = () => {
    const openNext = () => {
      const d = noteDlgRef.current;
      if (!d) return;
      const p = buildNotePayload({
        meta,
        sigilSvgRaw,
        verifyUrl: sealUrl || (typeof window !== "undefined" ? window.location.href : ""),
        pulseNow,
      });
      const bridge: VerifierBridge = { getNoteData: async () => p };
      window.KKVerifier = bridge;
      try {
        window.dispatchEvent(new CustomEvent<NoteBanknoteInputs>("kk:note-data", { detail: p }));
      } catch (err) {
        logError("dispatch(kk:note-data)", err);
      }
      safeShowDialog(d);
      setNoteOpen(true);
    };
    switchModal(dlgRef.current, openNext);
  };
  const closeNote = () => {
    const d = noteDlgRef.current;
    d?.close();
    d?.setAttribute("data-open", "false");
    setNoteOpen(false);
  };

  const openValuation = () => {
    switchModal(dlgRef.current, () => setValuationOpen(true));
  };
  const closeValuation = () => setValuationOpen(false);

  const onAttachValuation = async (seal: ValueSeal) => {
    if (!meta) return;
    const updated: SigilMetadata = attachValuation(meta, seal);
    setMeta(updated);
    setRawMeta(JSON.stringify(updated, null, 2));
    if (svgURL) {
      const durl = await embedMetadata(svgURL, updated);
      const sigilPulse = updated.pulse ?? 0;
      download(durl, `${pulseFilename("sigil_with_valuation", sigilPulse, pulseNow)}.svg`);
    }
    setValuationOpen(false);
  };

  /* Recompute + verify head window (merkle root, zk, proof) */
  const refreshHeadWindow = useCallback(async (m: SigilMetadata) => {
    const transfers = m.transfers ?? [];
    const root = await computeHeadWindowRoot(transfers);
    (m as SigilMetadataWithOptionals).transfersWindowRoot = root;

    if (transfers.length > 0) {
      const leaves = await Promise.all(transfers.map(hashTransfer));
      const index = leaves.length - 1;
      const proof = await merkleProof(leaves, index);
      const okDirect = await verifyProof(root, proof);
      const okBundle = await verifyHistorical(m, { kind: "head", windowMerkleRoot: root, transferProof: proof });
      setHeadProof({ ok: okDirect && okBundle, index, root });
    } else {
      setHeadProof(null);
    }

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
      (m as SigilMetadataWithOptionals).transfersWindowRootV14 = await buildMerkleRoot(v14Leaves);
    } catch (err) {
      logError("refreshHeadWindow.buildMerkleRoot(v14)", err);
    }

    try {
      await verifyZkOnHead(m);
      setMeta({ ...m });
    } catch (err) {
      logError("refreshHeadWindow.verifyZkOnHead", err);
    }

    return m;
  }, []);

  /* Determine if a file is a persisted CHILD glyph */
  const isPersistedChild = useCallback(
    async (m: SigilMetadata): Promise<boolean> => {
      const parentCanonical =
        (m.canonicalHash as string | undefined)?.toLowerCase() ||
        (await sha256Hex(`${m.pulse}|${m.beat}|${m.stepIndex}|${m.chakraDay}`)).toLowerCase();

      const explicitChildOf = (m as SigilMetadataWithOptionals).childOfHash?.toLowerCase();
      if (explicitChildOf && (m.canonicalHash?.toLowerCase() ?? "") !== parentCanonical) return true;

      // If canonicalHash exists and differs from computed parent canonical, treat as child
      if ((m.canonicalHash?.toLowerCase() ?? "") !== parentCanonical) return true;

      return false;
    },
    []
  );

  /* Compute effective canonical (parent or child) */
  const computeEffectiveCanonical = useCallback(async (m: SigilMetadata) => {
    const parentCanonical =
      (m.canonicalHash as string | undefined)?.toLowerCase() ||
      (await sha256Hex(`${m.pulse}|${m.beat}|${m.stepIndex}|${m.chakraDay}`)).toLowerCase();

    // Persisted CHILD?
    if (await isPersistedChild(m)) {
      const childCanon = (m.canonicalHash as string).toLowerCase();

      const used = !!(m as SigilMetadataWithOptionals).sendLock?.used;
      const lastClosed = !!((m.transfers ?? []).slice(-1)[0]?.receiverSignature);

      // PROMOTION: treat as parent if one-time lock used OR last transfer is closed
      if (used || lastClosed) {
        return { canonical: childCanon, context: "parent" as const };
      }
      return { canonical: childCanon, context: "derivative" as const };
    }

    // Ephemeral CHILD (open transfer)
    const last = (m.transfers ?? []).slice(-1)[0];
    const hardenedLast = (m.hardenedTransfers ?? []).slice(-1)[0];
    const isChildOpen = !!last && !last.receiverSignature;
    if (!isChildOpen) return { canonical: parentCanonical, context: "parent" as const };

    const sendLeaf = last ? await hashTransferSenderSide(last) : "";
    const prevHead =
      hardenedLast?.previousHeadRoot ||
      (m as SigilMetadataWithOptionals).transfersWindowRootV14 ||
      (m as SigilMetadataWithOptionals).transfersWindowRoot ||
      "";
    const seed = stableStringify({
      parent: parentCanonical,
      nonce: m.transferNonce || "",
      senderStamp: last?.senderStamp || "",
      senderKaiPulse: last?.senderKaiPulse || 0,
      prevHead,
      leafSend: sendLeaf,
    });
    const childCanonical = (await sha256Hex(seed)).toLowerCase();
    return { canonical: childCanonical, context: "derivative" as const };
  }, [isPersistedChild]);

  /* Child lock/expiry inspection */
  function getChildLockInfo(m: SigilMetadata | null, nowPulse: number): { used: boolean; expired: boolean; expireAt?: number } {
    const mm = m as SigilMetadataWithOptionals | null;
    if (!mm) return { used: false, expired: false };
    const used = !!mm.sendLock?.used;

    let expireAt = mm.childClaim?.expireAtPulse;
    if (typeof expireAt !== "number" || !Number.isFinite(expireAt)) {
      const last = mm.transfers?.slice(-1)[0];
      const issued = last?.senderKaiPulse;
      if (typeof issued === "number") expireAt = issued + CLAIM_PULSES;
    }
    const expired = typeof expireAt === "number" ? nowPulse > expireAt : false;
    return { used, expired, expireAt };
  }

  /* Parent (ephemeral) open-link expiry */
  function getParentOpenExpiry(m: SigilMetadata | null, nowPulse: number): { expired: boolean; expireAt?: number } {
    if (!m) return { expired: false };
    const last = m.transfers?.slice(-1)[0];
    const open = !!last && !last.receiverSignature;
    if (!open) return { expired: false };
    const issued = last?.senderKaiPulse;
    if (typeof issued !== "number") return { expired: false };
    const expireAt = issued + CLAIM_PULSES;
    return { expired: nowPulse > expireAt, expireAt };
  }

  /* File upload handler (main sigil SVG) */
  const handleSvg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    try {
      setSigilSvgRaw(await f.text());
    } catch (err) {
      logError("handleSvg.readFile", err);
      setSigilSvgRaw(null);
    }

    setSourceFilename(f.name || null);

    setError(null);
    setPayload(null);
    setTab("summary");
    setViewRaw(false);

    const url = URL.createObjectURL(f);
    setSvgURL(url);

    const { meta: m, contextOk, typeOk } = await parseSvgFile(f);

    m.segmentSize ??= SEGMENT_SIZE;
    const segCount = (m.segments ?? []).reduce((a, s) => a + (s.count || 0), 0);
    if (typeof m.cumulativeTransfers !== "number") m.cumulativeTransfers = segCount + (m.transfers?.length ?? 0);
    if ((m.segments?.length ?? 0) > 0 && !m.segmentsMerkleRoot) {
      const roots = (m.segments ?? []).map((s) => s.root);
      m.segmentsMerkleRoot = await buildMerkleRoot(roots);
    }

    const pulseForSeal = typeof m.pulse === "number" ? m.pulse : kaiPulseNow();
    const { sig, rgb } = await centrePixelSignature(url, pulseForSeal);
    setLiveSig(sig);
    setRgbSeed(rgb);

    const expected = await computeKaiSignature(m);
    setContentSigExpected(expected);

    let cMatch: boolean | null = null;
    if (expected && m.kaiSignature) cMatch = expected.toLowerCase() === m.kaiSignature.toLowerCase();
    setContentSigMatches(cMatch);

    let expectedPhi: string | null = null;
    if (m.kaiSignature) {
      expectedPhi = await derivePhiKeyFromSig(m.kaiSignature);
      setPhiKeyExpected(expectedPhi);
      setPhiKeyMatches(m.userPhiKey ? expectedPhi === m.userPhiKey : null);
    } else {
      setPhiKeyExpected(null);
      setPhiKeyMatches(null);
    }

    try {
      if ((m as SigilMetadataWithOptionals).creatorPublicKey) {
        const phi = await phiFromPublicKey((m as SigilMetadataWithOptionals).creatorPublicKey!);
        if (!m.userPhiKey) m.userPhiKey = phi;
      }
    } catch (err) {
      logError("handleSvg.phiFromPublicKey", err);
    }

    const hasCore =
      typeof m.pulse === "number" && typeof m.beat === "number" && typeof m.stepIndex === "number" && typeof m.chakraDay === "string";
    const last = m.transfers?.slice(-1)[0];
    const lastParty = last?.receiverSignature || last?.senderSignature || null;
    const isOwner = lastParty && sig ? lastParty === sig : null;
    const hasTransfers = !!(m.transfers && m.transfers.length > 0);
    const lastOpen = !!(last && !last.receiverSignature);
    const lastClosed = !!(last && !!last.receiverSignature);
    const isUnsigned = !m.kaiSignature;

    const m2 = await refreshHeadWindow(m);

    // Effective canonical (parent or child)
    let effCtx: "parent" | "derivative" | null = null;
    try {
      const eff = await computeEffectiveCanonical(m2);
      setCanonical(eff.canonical);
      setCanonicalContext(eff.context);
      effCtx = eff.context;
    } catch (err) {
      logError("computeEffectiveCanonical", err);
      setCanonical(null);
      setCanonicalContext(null);
    }

    // Locks/expiry info
    const { used: childUsed, expired: childExpired } = getChildLockInfo(m2, kaiPulseNow());
    const { expired: parentOpenExpired } = getParentOpenExpiry(m2, kaiPulseNow());

    setMeta(m2);
    setRawMeta(JSON.stringify(m2, null, 2));
    setUiState(
      deriveState({
        contextOk,
        typeOk,
        hasCore,
        contentSigMatches: cMatch,
        isOwner,
        hasTransfers,
        lastOpen,
        lastClosed,
        isUnsigned,
        childUsed,
        childExpired,
        parentOpenExpired,
        isChildContext: effCtx === "derivative",
      })
    );

    setAmountMode("PHI");
    setPhiInput("");
    setUsdInput("");
    openVerifier();
  };

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPayload(await fileToPayload(f));
  };

  /* Seal unsigned (Kai signature + Phi key) */
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
    if (!m.userPhiKey && m.kaiSignature) m.userPhiKey = await derivePhiKeyFromSig(m.kaiSignature);
    if (typeof m.kaiPulse !== "number") m.kaiPulse = nowPulse;

    try {
      if (!(m as SigilMetadataWithOptionals).creatorPublicKey && me) (m as SigilMetadataWithOptionals).creatorPublicKey = me.spkiB64u;
    } catch (err) {
      logError("sealUnsigned.creatorPublicKey", err);
    }

    const durl = await embedMetadata(svgURL, m);
    download(durl, `${safeFilename("sigil_sealed", nowPulse)}.svg`);
    const m2 = await refreshHeadWindow(m);
    setMeta(m2);
    setRawMeta(JSON.stringify(m2, null, 2));
    setUiState((prev) => (prev === "unsigned" ? "readySend" : prev));
    setError(null);
  };

  /* Build a persistent CHILD file snapshot for download/share */
  async function buildChildMetaForDownload(updated: SigilMetadata, args: {
    parentCanonical: string;
    childCanonical: string;
    allocationPhiStr: string;
    issuedPulse: number;
  }): Promise<SigilMetadata> {
    const m = JSON.parse(JSON.stringify(updated)) as SigilMetadataWithOptionals;
    m.canonicalHash = args.childCanonical;            // persist CHILD canonical
    m.childOfHash = args.parentCanonical;
    m.childAllocationPhi = args.allocationPhiStr;     // fixed allocation for this child
    m.childIssuedPulse = args.issuedPulse;
    m.childClaim = { steps: CLAIM_STEPS, expireAtPulse: args.issuedPulse + CLAIM_PULSES };
    m.sendLock = { nonce: updated.transferNonce!, used: false };

    // For child branch accounting, set base=allocation, spent=0 (child local)
    m.branchBasePhi = args.allocationPhiStr;
    m.branchSpentPhi = "0";

    return m;
  }

  /* Share link modal + rotation broadcast */
  const shareTransferLink = useCallback(async (m: SigilMetadata) => {
    const parentCanonical =
      (m.canonicalHash as string | undefined)?.toLowerCase() ||
      (await sha256Hex(`${m.pulse}|${m.beat}|${m.stepIndex}|${m.chakraDay}`)).toLowerCase();

    const last = (m.transfers ?? []).slice(-1)[0];
    const hardenedLast = (m.hardenedTransfers ?? []).slice(-1)[0];

    const sendLeaf = last ? await hashTransferSenderSide(last) : "";
    const childSeed = stableStringify({
      parent: parentCanonical,
      nonce: m.transferNonce || "",
      senderStamp: last?.senderStamp || "",
      senderKaiPulse: last?.senderKaiPulse || 0,
      prevHead:
        hardenedLast?.previousHeadRoot ||
        (m as SigilMetadataWithOptionals).transfersWindowRootV14 ||
        (m as SigilMetadataWithOptionals).transfersWindowRoot ||
        "",
      leafSend: sendLeaf,
    });
    const childHash = (await sha256Hex(childSeed)).toLowerCase();

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

    const startPulse = last?.senderKaiPulse ?? kaiPulseNow();
    const claim = {
      steps: CLAIM_STEPS,
      expireAtPulse: startPulse + CLAIM_PULSES,
      stepsPerBeat: (m as SigilMetadataWithOptionals).stepsPerBeat ?? 12,
    };

    let preview:
      | {
          unit?: "USD" | "PHI";
          amountPhi?: string;
          amountUsd?: string;
          usdPerPhi?: number;
        }
      | undefined;

    try {
      if (last?.payload?.mime?.startsWith("application/vnd.kairos-exhale")) {
        const obj = JSON.parse(base64DecodeUtf8(last.payload.encoded)) as {
          kind?: string;
          unit?: "USD" | "PHI";
          amountPhi?: string;
          amountUsd?: string;
          usdPerPhi?: number;
        } | null;
        if (obj?.kind === "exhale") preview = { unit: obj.unit, amountPhi: obj.amountPhi, amountUsd: obj.amountUsd, usdPerPhi: obj.usdPerPhi };
      }
    } catch (err) {
      logError("shareTransferLink.previewDecode", err);
    }

    const enriched = { ...sharePayload, canonicalHash: childHash, parentHash: parentCanonical, transferNonce: token, claim, preview };

    let base = "";
    try {
      base = makeSigilUrl(childHash, sharePayload);
    } catch (err) {
      logError("shareTransferLink.makeSigilUrl", err);
      const u = new URL(typeof window !== "undefined" ? window.location.href : "http://localhost");
      u.pathname = `/s/${childHash}`;
      base = u.toString();
    }

    let historyParam: string | undefined;
    try {
      const lite: SigilTransferLite[] = [];
      for (const t of m.transfers ?? []) {
        if (!t?.senderSignature || typeof t.senderKaiPulse !== "number") continue;
        const entry = (typeof t.receiverSignature === "string" && typeof t.receiverKaiPulse === "number"
          ? { s: t.senderSignature, p: t.senderKaiPulse, r: t.receiverSignature }
          : { s: t.senderSignature, p: t.senderKaiPulse }) as SigilTransferLite;
        lite.push(entry);
      }
      const enc = encodeSigilHistory(lite);
      historyParam = enc.startsWith("h:") ? enc.slice(2) : enc;
    } catch (err) {
      logError("shareTransferLink.encodeSigilHistory", err);
    }

    const url = rewriteUrlPayload(base, enriched, token, historyParam);
    setSealUrl(url);
    setSealHash(childHash);

    setRotateOut(true);
    switchModal(dlgRef.current, () => setSealOpen(true));

    try {
      publishRotation([parentCanonical], token);
    } catch (err) {
      logError("shareTransferLink.publishRotation", err);
    }
  }, []);

  /* syncMetaAndUi
     After any mutation (send, receive, segmentation),
     refresh canonical/context and uiState, but DO NOT "retire" heads
     just because we segmented. Continuous breathing. */
  const syncMetaAndUi = useCallback(
    async (mNew: SigilMetadata) => {
      // persist
      setMeta(mNew);
      setRawMeta(JSON.stringify(mNew, null, 2));

      // core presence
      const hasCore =
        typeof mNew.pulse === "number" &&
        typeof mNew.beat === "number" &&
        typeof mNew.stepIndex === "number" &&
        typeof mNew.chakraDay === "string";

      // ownership check
      const lastTx = mNew.transfers?.slice(-1)[0];
      const lastParty = lastTx?.receiverSignature || lastTx?.senderSignature || null;
      const isOwner = lastParty && liveSig ? lastParty === liveSig : null;

      const hasTransfers = !!(mNew.transfers && mNew.transfers.length > 0);
      const lastOpen = !!(lastTx && !lastTx.receiverSignature);
      const lastClosed = !!(lastTx && !!lastTx.receiverSignature);
      const isUnsigned = !mNew.kaiSignature;

      // effective canonical / context
      let effCtx: "parent" | "derivative" | null = null;
      try {
        const eff = await computeEffectiveCanonical(mNew);
        setCanonical(eff.canonical);
        setCanonicalContext(eff.context);
        effCtx = eff.context;
      } catch (err) {
        logError("syncMetaAndUi.computeEffectiveCanonical", err);
        setCanonical(null);
        setCanonicalContext(null);
      }

      // lock+expiry
      const { used: childUsed, expired: childExpired } = getChildLockInfo(mNew, kaiPulseNow());
      const { expired: parentOpenExpired } = getParentOpenExpiry(mNew, kaiPulseNow());

      // content sig match: compare to latest expected if we have one
      let cMatch: boolean | null = null;
      if (contentSigExpected && mNew.kaiSignature) {
        cMatch = contentSigExpected.toLowerCase() === mNew.kaiSignature.toLowerCase();
      }

      // post-mutation ui state (no "retired" branch)
      setUiState(
        deriveState({
          contextOk: true,
          typeOk: true,
          hasCore,
          contentSigMatches: cMatch,
          isOwner,
          hasTransfers,
          lastOpen,
          lastClosed,
          isUnsigned,
          childUsed,
          childExpired,
          parentOpenExpired,
          isChildContext: effCtx === "derivative",
        })
      );
    },
    [
      liveSig,
      computeEffectiveCanonical,
      contentSigExpected,
    ]
  );

  /* Formatting helpers */
  const fmtPhiCompact = useCallback((s: string) => {
    let t = (s || "").trim();
    if (!t) return "0";
    if (t.startsWith(".")) t = "0" + t;
    t = t.replace(/\.?$/, (m) => (/\.\d/.test(t) ? m : ""));
    return t;
  }, []);
  const fmtUsdNoSym = useCallback((v: number) => {
    return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }).format(Math.max(0, v || 0));
  }, []);
const canShare = useMemo(() => {
  if (typeof navigator === "undefined") return false;
  const n = navigator as Navigator & { share?: (data?: unknown) => Promise<void> };
  return typeof n.share === "function";
}, []);

  useEffect(() => {
    return () => {
      if (svgURL && svgURL.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(svgURL);
        } catch (err) {
          logError("revokeObjectURL", err);
        }
      }
    };
  }, [svgURL]);

  const metaLiteForNote = useMemo<SigilMetadataLite | null>(() => {
    if (!meta) return null;
    const mOpt = meta as SigilMetadataWithOptionals;
    const day = normalizeChakraDay(meta.chakraDay) ?? "Root";
    const steps = mOpt.stepsPerBeat ?? 12;
    const twr = mOpt.transfersWindowRoot ?? mOpt.transfersWindowRootV14;
    const obj: SigilMetadataLite = {
      pulse: meta.pulse as number,
      beat: meta.beat as number,
      stepIndex: meta.stepIndex as number,
      stepsPerBeat: steps,
      chakraDay: day,
      kaiSignature: meta.kaiSignature ?? "",
      userPhiKey: meta.userPhiKey ?? "",
      transfersWindowRoot: twr,
    };
    return obj;
  }, [meta]);

  /* Initial glyph valuation baseline for Remaining Φ math and USD conversion */
  type InitialGlyph = { hash: string; value: number; pulseCreated: number; meta: SigilMetadataLite };
  const [initialGlyph, setInitialGlyph] = useState<InitialGlyph | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!metaLiteForNote) {
        setInitialGlyph(null);
        return;
      }
      const canonicalHash =
        (meta?.canonicalHash as string | undefined)?.toLowerCase() ||
        (await sha256Hex(`${metaLiteForNote.pulse}|${metaLiteForNote.beat}|${metaLiteForNote.stepIndex}|${metaLiteForNote.chakraDay}`)).toLowerCase();

      try {
        const headHash =
          (meta as SigilMetadataWithOptionals)?.transfersWindowRoot ||
          (meta as SigilMetadataWithOptionals)?.transfersWindowRootV14;
        const { seal } = await buildValueSeal(metaLiteForNote, pulseNow, sha256Hex, headHash);
        if (!cancelled)
          setInitialGlyph({
            hash: canonicalHash,
            value: seal.valuePhi ?? 0,
            pulseCreated: metaLiteForNote.pulse ?? pulseNow,
            meta: metaLiteForNote,
          });
      } catch (err) {
        logError("buildValueSeal", err);
        if (!cancelled)
          setInitialGlyph({
            hash: canonicalHash,
            value: 0,
            pulseCreated: metaLiteForNote.pulse ?? pulseNow,
            meta: metaLiteForNote,
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [metaLiteForNote, meta, pulseNow]);

  useEffect(() => {
    if (!noteOpen || sigilSvgRaw || !svgURL) return;
    (async () => {
      try {
        const txt = await fetch(svgURL).then((r) => r.text());
        setSigilSvgRaw(txt);
      } catch (err) {
        logError("ensureRawSvgForNote", err);
      }
    })();
  }, [noteOpen, sigilSvgRaw, svgURL]);

  /* USD/Φ rate quote for live conversion */
  const issuancePolicy = DEFAULT_ISSUANCE_POLICY;
  const { usdPerPhi } = useMemo(() => {
    try {
      const nowKai = pulseNow;
      const metaLiteSafe: SigilMetadataLite = metaLiteForNote ?? {
        pulse: 0,
        beat: 0,
        stepIndex: 0,
        stepsPerBeat: 12,
        chakraDay: "Root",
        kaiSignature: "",
        userPhiKey: "",
        transfersWindowRoot: "",
      };
      const q = quotePhiForUsd({ meta: metaLiteSafe, nowPulse: nowKai, usd: 100, currentStreakDays: 0, lifetimeUsdSoFar: 0 }, issuancePolicy);
      return { usdPerPhi: q.usdPerPhi ?? 0 };
    } catch (err) {
      logError("quotePhiForUsd", err);
      return { usdPerPhi: 0 };
    }
  }, [metaLiteForNote, pulseNow, issuancePolicy]);

  /* Remaining Φ math (branch-aware, persists across segmentation) */
  const persistedBaseScaled = useMemo(() => toScaledBig(((meta as SigilMetadataWithOptionals | null)?.branchBasePhi ?? "")), [meta]);
  const persistedSpentScaled = useMemo(() => toScaledBig(((meta as SigilMetadataWithOptionals | null)?.branchSpentPhi ?? "0")), [meta]);

  const pivotIndex = useMemo(() => {
    const trs = meta?.transfers ?? [];
    for (let i = trs.length - 1; i >= 0; i -= 1) if (trs[i]?.receiverSignature) return i;
    return trs.length > 0 ? trs.length - 1 : -1;
  }, [meta?.transfers]);
  const prevPivotIndex = useMemo(() => {
    const trs = meta?.transfers ?? [];
    let seen = 0;
    for (let i = trs.length - 1; i >= 0; i -= 1) {
      if (trs[i]?.receiverSignature) {
        seen += 1;
        if (seen === 2) return i;
      }
    }
    return -1;
  }, [meta?.transfers]);

  const lastTransfer = useMemo(() => (meta?.transfers ?? []).slice(-1)[0], [meta?.transfers]);
  const isChildContext = useMemo(() => canonicalContext === "derivative", [canonicalContext]);

  const basePhiScaled = useMemo(() => {
    if (isChildContext) {
      const childAllocStr = (meta as SigilMetadataWithOptionals | null)?.childAllocationPhi;
      if (childAllocStr) {
        const ex = toScaledBig(childAllocStr);
        if (ex > 0n) return ex;
      }
      const exOpen = toScaledBig(fromScaledBig(exhalePhiFromTransferScaled(lastTransfer)));
      if (exOpen > 0n) return exOpen;
      return 0n;
    }
    if (persistedBaseScaled > 0n) return persistedBaseScaled;
    if (pivotIndex >= 0 && meta?.transfers) {
      const v = exhalePhiFromTransferScaled(meta.transfers[pivotIndex]);
      return v > 0n ? v : 0n;
    }
    const initialValStr = String(initialGlyph?.value ?? 0);
    return toScaledBig(initialValStr || "0");
  }, [isChildContext, meta, lastTransfer, persistedBaseScaled, pivotIndex, initialGlyph]);

  const currentWindowSpentScaled = useMemo(() => {
    let sum = 0n;
    try {
      const trs = meta?.transfers ?? [];
      for (let i = Math.max(0, pivotIndex + 1); i < trs.length; i += 1) sum += exhalePhiFromTransferScaled(trs[i]);
    } catch (err) {
      logError("remainingPhiScaled.sumAfterPivot", err);
    }
    return sum;
  }, [meta?.transfers, pivotIndex]);

  const priorWindowSpentScaled = useMemo(() => {
    try {
      const trs = meta?.transfers ?? [];
      if (pivotIndex <= 0) return 0n;
      const start = Math.max(0, prevPivotIndex + 1);
      const end = Math.max(start, pivotIndex);
      let sum = 0n;
      for (let i = start; i < end; i += 1) sum += exhalePhiFromTransferScaled(trs[i]);
      return sum;
    } catch (err) {
      logError("priorWindowSpentScaled", err);
      return 0n;
    }
  }, [meta?.transfers, pivotIndex, prevPivotIndex]);

  const ledgerSpentScaled = useMemo(() => {
    if (!canonical) return 0n;
    try {
      return getSpentScaledFor(canonical);
    } catch (err) {
      logError("ledgerSpentScaled", err);
      return 0n;
    }
  }, [canonical]);

  const effectivePersistedSpentScaled = useMemo(
    () => (persistedSpentScaled > priorWindowSpentScaled ? persistedSpentScaled : priorWindowSpentScaled),
    [persistedSpentScaled, priorWindowSpentScaled]
  );

  const metaSpentScaled = useMemo(() => {
    if (isChildContext) return 0n; // child branch spent tracked locally
    return effectivePersistedSpentScaled + currentWindowSpentScaled;
  }, [isChildContext, effectivePersistedSpentScaled, currentWindowSpentScaled]);

  const totalSpentScaled = useMemo(
    () => (ledgerSpentScaled > metaSpentScaled ? ledgerSpentScaled : metaSpentScaled),
    [ledgerSpentScaled, metaSpentScaled]
  );

  const remainingPhiScaled = useMemo(
    () => (basePhiScaled > totalSpentScaled ? basePhiScaled - totalSpentScaled : 0n),
    [basePhiScaled, totalSpentScaled]
  );

  const remainingPhiDisplay4 = useMemo(
    () => fromScaledBigFixed(roundScaledToDecimals(remainingPhiScaled, 4), 4),
    [remainingPhiScaled]
  );

  /* Header view uses Remaining Φ (continuous, never retired by segmentation) */
  const headerPhi = useMemo(() => {
    const rounded = roundScaledToDecimals(remainingPhiScaled, 4);
    return Number(fromScaledBig(rounded));
  }, [remainingPhiScaled]);

  const usdPerPhiRateScaled = useMemo(() => toScaledBig((usdPerPhi || 0).toFixed(18)), [usdPerPhi]);
  const headerUsd = useMemo(() => {
    const usdScaled = mulScaled(remainingPhiScaled, usdPerPhiRateScaled);
    return Number(fromScaledBig(usdScaled)) || 0;
  }, [remainingPhiScaled, usdPerPhiRateScaled]);

  // header trend flash (visual)
  const [headerFlash, setHeaderFlash] = useState<"up" | "down" | null>(null);
  const [headerTrend, setHeaderTrend] = useState<"up" | "down" | "flat">("flat");
  const [lastHeaderPhi, setLastHeaderPhi] = useState<number>(headerPhi);
  useEffect(() => {
    const tick = () => {
      setHeaderTrend(headerPhi > lastHeaderPhi ? "up" : headerPhi < lastHeaderPhi ? "down" : "flat");
      setHeaderFlash(headerPhi !== lastHeaderPhi ? (headerPhi > lastHeaderPhi ? "up" : "down") : null);
      window.setTimeout(() => setHeaderFlash(null), 420);
      setLastHeaderPhi(headerPhi);
    };
    const id = window.setInterval(tick, BREATH_MS);
    return () => window.clearInterval(id);
  }, [headerPhi, lastHeaderPhi]);

  /* Live conversion block */
  const conv = useMemo(() => {
    if (amountMode === "PHI") {
      const phiNormalized = fmtPhiCompact(phiInput);
      const phiScaled = toScaledBig(phiNormalized);
      const usdScaled = mulScaled(phiScaled, usdPerPhiRateScaled);
      const usdNumber = Number(fromScaledBig(usdScaled));
      return {
        displayLeftLabel: "Φ",
        displayRight: Number.isFinite(usdNumber) ? `$ ${fmtUsdNoSym(usdNumber)}` : "$ 0.00",
        phiStringToSend: phiNormalized,
        usdNumberAtSend: Number.isFinite(usdNumber) ? usdNumber : 0,
      };
    } else {
      const usdScaled = toScaledBig(usdInput);
      const phiScaled = divScaled(usdScaled, usdPerPhiRateScaled);
      const phiStrExact = fromScaledBig(phiScaled);
      const phiDisplay4 = fromScaledBigFixed(roundScaledToDecimals(phiScaled, 4), 4);
      return {
        displayLeftLabel: "$",
        displayRight: `≈ Φ ${phiDisplay4}`,
        phiStringToSend: phiStrExact,
        usdNumberAtSend: Number(fromScaledBig(usdScaled)) || 0,
      };
    }
  }, [amountMode, phiInput, usdInput, usdPerPhiRateScaled, fmtUsdNoSym, fmtPhiCompact]);

  const canExhale = useMemo(() => {
    const req = toScaledBig(conv.phiStringToSend || "0");
    return req > 0n && req <= remainingPhiScaled;
  }, [conv.phiStringToSend, remainingPhiScaled]);

  /* Compact JSON tree viewer */
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

  /* Export ZIP bundle (svg + png preview) */
  const downloadZip = useCallback(async () => {
    if (!meta || !svgURL) return;
    const svgDataUrl = await embedMetadata(svgURL, meta);
    const svgBlob = await fetch(svgDataUrl).then((r) => r.blob());
    let pngBlob: Blob | null = null;
    try {
      pngBlob = await pngBlobFromSvgDataUrl(svgDataUrl, 1024);
    } catch (err) {
      logError("pngBlobFromSvgDataUrl", err);
    }
    const { default: JSZip } = await import("jszip");
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

  /* Detect SEND filename (child that was just minted for someone else) */
  const isSendFilename = useMemo(() => {
    const name = (sourceFilename || "").toLowerCase();
    return name.includes("sigil_send");
  }, [sourceFilename]);

  /* SEND / Exhale */
  const send = async () => {
    if (!meta || !svgURL || !liveSig) return;

    if (meta.kaiSignature && contentSigExpected && meta.kaiSignature.toLowerCase() !== contentSigExpected.toLowerCase()) {
      setError("Content signature mismatch — cannot send.");
      setUiState("sigMismatch");
      return;
    }

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

    let chosenPayload: SigilPayload | undefined = undefined;
    const rawPhiStr = conv.phiStringToSend;
    const usdNum = conv.usdNumberAtSend;

    const normalizedPhi = fmtPhiCompact(rawPhiStr);
    const validPhi = normalizedPhi && /^(\d+(\.\d+)?|\.\d+)$/.test(normalizedPhi) ? normalizedPhi.replace(/^0+(?=\d)/, "") : "";
    const hasPhi = !!validPhi && Number(validPhi) > 0;

    const reqScaled = toScaledBig(validPhi || "0");
    if (!hasPhi || reqScaled <= 0n) {
      setError("Enter a Φ amount greater than zero.");
      return;
    }
    if (reqScaled > remainingPhiScaled) {
      setError(`Exhale exceeds resonance Φ — requested Φ ${fromScaledBigFixed(reqScaled, 4)} but only Φ ${remainingPhiDisplay4} remains on this glyph.`);
      return;
    }

    const cleanUsd = Number.isFinite(usdNum) ? Math.max(0, usdNum) : 0;

    if (hasPhi) {
      const body = {
        kind: "exhale" as const,
        unit: amountMode,
        amountPhi: validPhi,
        amountUsd: cleanUsd.toFixed(2),
        usdPerPhi: usdPerPhi || 0,
        atPulse: nowPulse,
        kaiSignature: m.kaiSignature || "",
        userPhiKey: m.userPhiKey || "",
      };
      const json = JSON.stringify(body);
      const encoded = base64EncodeUtf8(json);
      chosenPayload = {
        name: `exhale_${validPhi.replace(/\./g, "_")}phi.json`,
        mime: "application/vnd.kairos-exhale+json",
        size: encoded.length,
        encoded,
      };
    }

    if (!chosenPayload && payload) chosenPayload = payload;

    const transfer: SigilTransfer = {
      senderSignature: liveSig,
      senderStamp: stamp,
      senderKaiPulse: nowPulse,
      payload: chosenPayload ?? undefined,
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

    // persist branch progress (parent branch accounting)
    try {
      const prevSpent = toScaledBig((meta as SigilMetadataWithOptionals)?.branchSpentPhi ?? "0");
      const newSpentScaled = prevSpent + reqScaled;
      (updated as SigilMetadataWithOptionals).branchBasePhi =
        (meta as SigilMetadataWithOptionals)?.branchBasePhi ?? fromScaledBig(basePhiScaled);
      (updated as SigilMetadataWithOptionals).branchSpentPhi = fromScaledBig(newSpentScaled);
    } catch (err) {
      logError("send.persistBranchProgress", err);
    }

    // Hardened record + optional ZK + local ledger
    let parentCanonical = "";
    let childCanonical = "";
    let transferLeafHashSend = "";
    let prevHeadV14 = "";

    try {
      parentCanonical =
        (updated.canonicalHash as string | undefined)?.toLowerCase() ||
        (await sha256Hex(`${updated.pulse}|${updated.beat}|${updated.stepIndex}|${updated.chakraDay}`)).toLowerCase();

      if (me) {
        (updated as SigilMetadataWithOptionals).creatorPublicKey ??= me.spkiB64u;
        const indexV14 = updated.hardenedTransfers?.length ?? 0;
        prevHeadV14 = await expectedPrevHeadRootV14(updated, indexV14);
        const nonce = updated.transferNonce!;
        transferLeafHashSend = await hashTransferSenderSide(transfer);

        const mod = (await import("./sigilUtils")) as typeof import("./sigilUtils");
        const msg = mod.buildSendMessageV14(updated, {
          previousHeadRoot: prevHeadV14,
          senderKaiPulse: nowPulse,
          senderPubKey: (updated as SigilMetadataWithOptionals).creatorPublicKey!,
          nonce,
          transferLeafHashSend,
        });
        const senderSig = await signB64u(me.priv, msg);

        const hardened: HardenedTransferV14 = {
          previousHeadRoot: prevHeadV14,
          senderPubKey: (updated as SigilMetadataWithOptionals).creatorPublicKey!,
          senderSig,
          senderKaiPulse: nowPulse,
          nonce,
          transferLeafHashSend,
        };

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
              const publicHash = await mod.hashAny(proofObj.publicSignals);
              const proofHash = await mod.hashAny(proofObj.proof);
              const vkey = proofObj.vkey ?? (updated as SigilMetadataWithOptionals).zkVerifyingKey ?? window.SIGIL_ZK_VKEY;
              const vkeyHash = vkey ? await mod.hashAny(vkey) : undefined;
              hardened.zkSend = { scheme: "groth16", curve: "BLS12-381", publicHash, proofHash, vkeyHash };
            }
          } catch (err) {
            logError("provideSendProof", err);
          }
        }

        updated.hardenedTransfers = [...(updated.hardenedTransfers ?? []), hardened];
      }

      // Child canonical hash (deterministic for the send link)
      const childSeed = stableStringify({
        parent: parentCanonical,
        nonce: updated.transferNonce || "",
        senderStamp: transfer.senderStamp || "",
        senderKaiPulse: transfer.senderKaiPulse || 0,
        prevHead:
          prevHeadV14 ||
          (updated as SigilMetadataWithOptionals).transfersWindowRootV14 ||
          (updated as SigilMetadataWithOptionals).transfersWindowRoot ||
          "",
        leafSend: transferLeafHashSend,
      });
      childCanonical = (await sha256Hex(childSeed)).toLowerCase();

      // Local ledger
      const rec: SendRecord = {
        parentCanonical,
        childCanonical,
        amountPhiScaled: reqScaled.toString(),
        senderKaiPulse: nowPulse,
        transferNonce: updated.transferNonce!,
        senderStamp: stamp,
        previousHeadRoot: prevHeadV14,
        transferLeafHashSend,
      };
      try {
        await recordSend(rec);
      } catch (err) {
        logError("recordSend", err);
      }
      try {
        getSigilGlobal().registerSend?.(rec);
      } catch (err) {
        logError("__SIGIL__.registerSend", err);
      }
      try {
        window.dispatchEvent(new CustomEvent<SendRecord>("sigil:sent", { detail: rec }));
      } catch (err) {
        logError("dispatchEvent(sigil:sent)", err);
      }
    } catch (err) {
      logError("send.hardenedBuild/ledger", err);
    }

    // Build CHILD file for download/share
    const childMeta = await buildChildMetaForDownload(updated, {
      parentCanonical,
      childCanonical,
      allocationPhiStr: validPhi,
      issuedPulse: nowPulse,
    });

    // Download that child file (sigil_send_*.svg) – this link can be received
    const childDataUrl = await embedMetadata(svgURL, childMeta);
    const sigilPulse = updated.pulse ?? 0;
    download(childDataUrl, `${pulseFilename("sigil_send", sigilPulse, nowPulse)}.svg`);

    // If we've reached the segment size on the parent, roll the window.
    // IMPORTANT: segmentation is continuous now. It does NOT retire the parent.
    const windowSize = (updated.transfers ?? []).length;
    const cap = updated.segmentSize ?? SEGMENT_SIZE;

    if (windowSize >= cap) {
      const { meta: rolled, segmentFileBlob } = await sealCurrentWindowIntoSegment(updated);
      if (segmentFileBlob) {
        const segIdx = (rolled.segments?.length ?? 1) - 1;
        download(segmentFileBlob, `sigil_segment_${rolled.pulse ?? 0}_${String(segIdx).padStart(6, "0")}.json`);
      }
      const durl2 = await embedMetadata(svgURL, rolled);
      download(durl2, `${pulseFilename("sigil_head_after_seal", rolled.pulse ?? 0, nowPulse)}.svg`);

      const rolled2 = await refreshHeadWindow(rolled);

      // CONTINUOUS FLOW: after segmentation, glyph is still live, still SEND-capable,
      // and this newest send is still open for RECEIVE.
      await syncMetaAndUi(rolled2);

      setError(null);
      setPhiInput("");
      setUsdInput("");

      await shareTransferLink(rolled2);
      return;
    }

    const updated2 = await refreshHeadWindow(updated);

    // Normal flow after SEND (no auto-segmentation):
    await syncMetaAndUi(updated2);

    setError(null);
    setPhiInput("");
    setUsdInput("");

    await shareTransferLink(updated2);
  };

  /* RECEIVE / Inhale */
  const receive = async () => {
    if (!meta || !svgURL || !liveSig) return;

    // Parent-side RECEIVE is allowed only if not expired.
    if (canonicalContext === "parent") {
      const { expired: parentExpired } = getParentOpenExpiry(meta, kaiPulseNow());
      if (parentExpired) {
        setError("This open send has expired.");
        return;
      }
    }

    // Child guard: one-time lock/expiry
    const { used, expired } = getChildLockInfo(meta, kaiPulseNow());
    if (used) {
      setError("This transfer link has already been used.");
      return;
    }
    if (expired) {
      // It's expired; child RECEIVE disabled.
      setError("This transfer link has expired.");
      setUiState("complete");
      return;
    }

    const last = meta.transfers?.slice(-1)[0];
    if (!last || last.receiverSignature) return;

    const nowPulse = kaiPulseNow();
    const updatedLast: SigilTransfer = {
      ...last,
      receiverSignature: liveSig,
      receiverStamp: await sha256Hex(`${liveSig}-${last.senderStamp}-${nowPulse}`),
      receiverKaiPulse: nowPulse,
    };

    const updated: SigilMetadataWithOptionals = {
      ...(meta as SigilMetadataWithOptionals),
      transfers: [...(meta.transfers ?? []).slice(0, -1), updatedLast],
    };

    try {
      if (me && (updated.hardenedTransfers?.length ?? 0) > 0) {
        const hLast = updated.hardenedTransfers![updated.hardenedTransfers!.length - 1];
        if (!hLast.receiverSig) {
          (updated as SigilMetadataWithOptionals).creatorPublicKey ??= me.spkiB64u;
          const transferLeafHashReceive = await hashTransfer(updatedLast);
          const mod = (await import("./sigilUtils")) as typeof import("./sigilUtils");
          const msgR = mod.buildReceiveMessageV14({
            previousHeadRoot: hLast.previousHeadRoot,
            senderSig: hLast.senderSig,
            receiverKaiPulse: nowPulse,
            receiverPubKey: (updated as SigilMetadataWithOptionals).creatorPublicKey!,
            transferLeafHashReceive,
          });
          const receiverSig = await signB64u(me.priv, msgR);
          const newHLast: HardenedTransferV14 = {
            ...hLast,
            receiverPubKey: (updated as SigilMetadataWithOptionals).creatorPublicKey!,
            receiverSig,
            receiverKaiPulse: nowPulse,
            transferLeafHashReceive,
            zkReceive: hLast.zkReceive,
            zkReceiveBundle: hLast.zkReceiveBundle,
          };

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
                const publicHash = await mod.hashAny(proofObj.publicSignals);
                const proofHash = await mod.hashAny(proofObj.proof);
                const vkey = proofObj.vkey ?? (updated as SigilMetadataWithOptionals).zkVerifyingKey ?? window.SIGIL_ZK_VKEY;
                const vkeyHash = vkey ? await mod.hashAny(vkey) : undefined;
                newHLast.zkReceive = { scheme: "groth16", curve: "BLS12-381", publicHash, proofHash, vkeyHash };
              }
            } catch (err) {
              logError("provideReceiveProof", err);
            }
          }

          updated.hardenedTransfers = [...updated.hardenedTransfers!.slice(0, -1), newHLast];

          // mark confirmed in local ledger, keyed by parent hash
          try {
            const parentCanon =
              (updated.childOfHash as string | undefined)?.toLowerCase() ||
              (await sha256Hex(`${updated.pulse}|${updated.beat}|${updated.stepIndex}|${updated.chakraDay}`)).toLowerCase();
            if (hLast.transferLeafHashSend) markConfirmedByLeaf(parentCanon, hLast.transferLeafHashSend);
          } catch (err) {
            logError("ledger.markConfirmedByLeaf", err);
          }
        }
      }
    } catch (err) {
      logError("receive.hardenedSeal", err);
    }

    // Flip one-time lock to used on CHILD files so it promotes
    try {
      if (await isPersistedChild(updated)) {
        updated.sendLock = { ...(updated.sendLock ?? { nonce: updated.transferNonce! }), used: true, usedPulse: nowPulse };
      }
    } catch (err) {
      logError("receive.setUsedLock", err);
    }

    // Persist closed RECEIVE file (promotes to normal parent going forward)
    const durl = await embedMetadata(svgURL, updated);
    const sigilPulse = updated.pulse ?? 0;
    download(durl, `${pulseFilename("sigil_receive", sigilPulse, nowPulse)}.svg`);

    // Recompute head and UI (now behaves like parent, can send/segment)
    const updated2 = await refreshHeadWindow(updated);
    await syncMetaAndUi(updated2);

    setError(null);
  };

  /* Manual segmentation
     - Allowed when there are transfers in head.
     - Forbidden if the loaded file name is a SEND file ("sigil_send...svg"),
       because SEND links may never segment.
     - Rolls current window into a segment and emits:
       * segment JSON
       * updated head SVG
     - DOES NOT retire/archive/disable future send/segment. Continuous.
  */
  const sealSegmentNow = useCallback(async () => {
    if (!meta) return;
    if (!meta.transfers || meta.transfers.length === 0) return;

    if (isSendFilename) {
      setError("Segmentation is disabled on SEND sigils.");
      return;
    }

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

    // Continuous breathing: after segmentation, still active.
    await syncMetaAndUi(rolled2);

    setError(null);
  }, [meta, svgURL, isSendFilename, refreshHeadWindow, syncMetaAndUi]);

  /* Status chips */
  type IconKind = "ok" | "warn" | "err" | "info";
  const IconCircle: React.FC<{ title: string; kind?: IconKind; children: React.ReactNode; badge?: number | null }> = ({
    title,
    kind = "info",
    children,
    badge = null,
  }) => (
    <span className={`chip icon ${kind}`} role="img" aria-label={title} title={title} {...(badge != null ? { "data-badge": String(badge) } : {})}>
      {children}
    </span>
  );
  const Svg: React.FC<{
    path: "check" | "x" | "warn" | "shield" | "sigma" | "phi" | "send" | "recv" | "done" | "stack" | "hash" | "zk" | "paperclip" | "lock" | "timer" | "ban";
    label?: string;
  }> = ({ path, label }) => {
    const p: Record<string, string> = {
      check: "M5 13l4 4L19 7",
      x: "M6 6l12 12M6 18L18 6",
      warn: "M12 9v4m0 4h.01M12 3l9 16H3z",
      shield: "M12 3l7 4v6l-7 4-7-4V7l7-4z",
      sigma: "M18 6H9l5 6-5 6h9M6 6h2M6 18h2",
      phi: "M12 4a8 8 0 100 16 8 8 0 000-16zm0 0v16",
      send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
      recv: "M2 22l11-11M2 22l20-7-9-4-4-9-7 20z",
      done: "M12 21c4.97 0 9-4.03 9-9S16.97 3 12 3 3 7.03 3 12s4.03 9 9 9zm-1-6l6-6M8 12l3 3",
      stack: "M12 3l9 4-9 4-9-4 9-4zm-9 8l9 4 9-4M3 19l9 4 9-4",
      hash: "M10 3L8 21M16 3l-2 18M3 8h18M3 16h18",
      zk: "M12 3l7 4v6l-7 4-7-4V7l7-4zM9 12h6",
      paperclip: "M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.2a2 2 0 01-2.83-2.83l8.49-8.49",
      lock: "M7 10V7a5 5 0 0110 0v3h1a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7a2 2 0 012-2h1zm3 0h4V7a3 3 0 00-6 0v3z",
      timer: "M12 8v5l3 3M12 2a10 10 0 100 20 10 10 0 000-20",
      ban: "M4.93 4.93l14.14 14.14M12 2a10 10 0 110 20 10 10 0 010-20",
    };
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" className="ico">
        <path d={p[path]} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <title>{label}</title>
      </svg>
    );
  };

  const { used: childUsed, expired: childExpired } = useMemo(() => getChildLockInfo(meta, pulseNow), [meta, pulseNow]);
  const parentOpenExp = useMemo(() => getParentOpenExpiry(meta, pulseNow).expired, [meta, pulseNow]);

  const statusChips = () => {
    const chips: React.ReactNode[] = [];
    const push = (n: React.ReactNode) => chips.push(n);
    const m = meta as SigilMetadataWithOptionals | null;

    if (uiState === "invalid") push(<IconCircle key="inv" kind="err" title="Invalid"><Svg path="x" /></IconCircle>);
    if (uiState === "structMismatch") push(<IconCircle key="struct" kind="err" title="Structure mismatch"><Svg path="warn" /></IconCircle>);
    if (uiState === "sigMismatch") push(<IconCircle key="sigm" kind="err" title="Signature mismatch"><Svg path="x" /></IconCircle>);
    if (uiState === "notOwner") push(<IconCircle key="owner" kind="warn" title="Not owner"><Svg path="shield" /></IconCircle>);
    if (uiState === "unsigned") push(<IconCircle key="unsigned" kind="warn" title="Unsigned"><Svg path="hash" /></IconCircle>);
    if (uiState === "readySend") push(<IconCircle key="send" kind="info" title="Ready to send"><Svg path="send" /></IconCircle>);
    if (uiState === "readyReceive") push(<IconCircle key="recv" kind="info" title="Ready to receive"><Svg path="recv" /></IconCircle>);
    if (uiState === "complete") push(<IconCircle key="done" kind="ok" title="Receipt"><Svg path="done" /></IconCircle>);
    if (uiState === "verified") push(<IconCircle key="ver" kind="ok" title="Verified"><Svg path="check" /></IconCircle>);

    if (contentSigMatches === true) push(<IconCircle key="sigok" kind="ok" title="Content Σ match"><Svg path="sigma" /></IconCircle>);
    if (contentSigMatches === false) push(<IconCircle key="sigerr" kind="err" title="Content Σ mismatch"><Svg path="sigma" /></IconCircle>);
    if (phiKeyMatches === true) push(<IconCircle key="phiok" kind="ok" title="Φ-Key match"><Svg path="phi" /></IconCircle>);
    if (phiKeyMatches === false) push(<IconCircle key="phierr" kind="err" title="Φ-Key mismatch"><Svg path="phi" /></IconCircle>);

    if (m?.cumulativeTransfers != null) push(<IconCircle key="cum" kind="info" title="Cumulative transfers" badge={m.cumulativeTransfers}><Svg path="hash" /></IconCircle>);
    if ((m?.segments?.length ?? 0) > 0) push(<IconCircle key="segs" kind="info" title="Segments" badge={m?.segments?.length ?? 0}><Svg path="stack" /></IconCircle>);
    if (headProof) push(<IconCircle key="headproof" kind={headProof.ok ? "ok" : "err"} title={headProof.ok ? "Head proof verified" : "Head proof failed"}><Svg path="shield" /></IconCircle>);
    if (m?.transfersWindowRootV14) push(<IconCircle key="v14root" kind="info" title="v14 head root present"><Svg path="hash" /></IconCircle>);
    const anyZkVerified = (meta?.hardenedTransfers ?? []).some((ht) => !!(ht.zkSend?.verified || ht.zkReceive?.verified));
    if (anyZkVerified) push(<IconCircle key="zk" kind="ok" title="Zero-knowledge proof verified"><Svg path="zk" /></IconCircle>);

    const isChildContextLocal = canonicalContext === "derivative";
    if (isChildContextLocal && childUsed) push(<IconCircle key="used" kind="warn" title="Transfer link used"><Svg path="lock" /></IconCircle>);
    if (isChildContextLocal && childExpired) push(<IconCircle key="expired" kind="warn" title="Transfer link expired"><Svg path="timer" /></IconCircle>);
    if (canonicalContext === "parent" && parentOpenExp) push(<IconCircle key="pexp" kind="warn" title="Send expired"><Svg path="timer" /></IconCircle>);
    if (isSendFilename) push(<IconCircle key="nosg" kind="warn" title="SEND file: segmentation disabled"><Svg path="ban" /></IconCircle>);
    return chips;
  };
// ─── helpers (module scope; stable) ──────────────────────────────
type Dict = Record<string, unknown>;

const isBrowser =
  typeof window !== "undefined" && typeof document !== "undefined";

const getPath = (obj: unknown, path: string): unknown => {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Dict)) {
      cur = (cur as Dict)[p];
    } else {
      return undefined;
    }
  }
  return cur;
};

const toStr = (v: unknown): string =>
  v === undefined || v === null ? "" : String(v);

const getFirst = (obj: unknown, paths: string[]): string => {
  for (const p of paths) {
    const v = getPath(obj, p);
    if (v !== undefined && v !== null && v !== "") return toStr(v);
  }
  return "";
};

// dataset fallback: read from the inline <svg> if present (SSR-safe)
const fromSvgDataset = (
  m: SigilMetadataWithOptionals,
  dashedAttr: string
): string => {
  if (!isBrowser) return "";
  const pulse = toStr(getPath(m, "pulse"));
  const beat = toStr(getPath(m, "beat"));
  const stepIndex = toStr(getPath(m, "stepIndex"));
  const svgId = pulse && beat && stepIndex ? `ks-${pulse}-${beat}-${stepIndex}` : "";
  const el = svgId ? (document.getElementById(svgId) as HTMLElement | null) : null;
  if (!el) return "";
  const camelKey = dashedAttr
    .replace(/^data-/, "")
    .replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
  const ds = el.dataset as Record<string, string | undefined>;
  return ds[camelKey] ?? el.getAttribute(dashedAttr) ?? "";
};


const frequencyHz = useMemo(() => {
  return (
    getFirst(meta, ["frequencyHz", "valuationSource.frequencyHz"]) ||
    fromSvgDataset(meta as SigilMetadataWithOptionals, "data-frequency-hz")
  );
}, [meta]);

const chakraGate = useMemo(() => {
  const raw =
    getFirst(meta, ["chakraGate", "valuationSource.chakraGate"]) ||
    fromSvgDataset(meta as SigilMetadataWithOptionals, "data-chakra-gate");

  return (raw || "")
    .replace(/\bgate\b[\s\-_:]*\d*/gi, "")
    .replace(/^[\s\-_,:–—]+|[\s\-_,:–—]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}, [meta]);




const childDeadline = useMemo(() => {
  if (canonicalContext !== "derivative") return null;
  const info = getChildLockInfo(meta, pulseNow);
  if (!info.expireAt) return null;
  const leftPulses = Math.max(0, info.expireAt - pulseNow);
  const leftSteps = Math.ceil(leftPulses / PULSES_PER_STEP);
  return { leftPulses, leftSteps, expireAt: info.expireAt };
}, [meta, pulseNow, canonicalContext]);

  return (
    <div className="verifier-stamper" role="application" style={{ maxWidth: "100vw", overflowX: "hidden" }}>
      {/* Top toolbar */}
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
            <svg viewBox="0 0 24 24" aria-hidden="true" className="ico" width="18" height="18" style={{ marginRight: 8, display: "inline-block", verticalAlign: "middle" }}>
              <path d="M12 19V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M8 11l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M4 5h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".6" />
            </svg>
            <span>Φkey</span>
          </button>
        </div>
      </div>

      <input ref={svgInput} type="file" accept=".svg" hidden onChange={handleSvg} />

      {/* Verifier Modal */}
      <dialog
        ref={dlgRef}
        className="glass-modal fullscreen"
        id="verifier-dialog"
        data-open="false"
        aria-label="Kai-Sigil Verifier Modal"
        style={{ width: "100vw", maxWidth: "100vw", height: "100dvh", maxHeight: "100dvh", margin: 0, padding: 0, overflow: "hidden" }}
      >
        <div className="modal-viewport" style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", maxWidth: "100vw", overflow: "hidden" }}>
          <div className="modal-topbar" style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center" }}>
            <div className="status-strip" aria-live="polite" style={{ overflowX: "auto", whiteSpace: "nowrap" }}>
              {statusChips()}
            </div>
            <button className="close-btn holo" data-aurora="true" aria-label="Close" title="Close" onClick={closeVerifier} style={{ justifySelf: "end", marginRight: 8 }}>
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
                    Beat <span>{meta.beat ?? "—"}</span> · Step <span>{meta.stepIndex ?? "—"}</span> · Day: <span>{normalizeChakraDay(meta.chakraDay) ?? meta.chakraDay ?? "—"}</span>
                  </p>

                  {/* Φ + USD live row — Remaining Φ drives this */}
                  <div className="value-strip" aria-live="polite">
                    <div
                      className={`value-chip phi ${headerTrend}${headerFlash ? " flash" : ""}`}
                      data-trend={headerTrend}
                      title={
                        canonicalContext === "derivative"
                          ? "Resonance Φ for this derivative glyph"
                          : "Resonance Φ on this glyph"
                      }
                    >
                      <span className="amount">
                        <span className="sym">Φ</span>
                        {headerPhi.toString()}
                      </span>
                    </div>
                    <div className={`value-chip usd ${headerTrend}${headerFlash ? " flash" : ""}`} data-trend={headerTrend} title="Indicative USD (issuance model)">
                      <span className="amount">
                        <span className="sym">$</span>
                        {fmtUsdNoSym(headerUsd)}
                      </span>
                    </div>
                  </div>

             

               {isSendFilename && (
  <div className="child-banner tooltip-container" style={{ fontSize: 10, opacity: 0.9, marginTop: 6 }}>
    <strong>11 Steps from Exhale</strong> <span className="tooltip-trigger">INHALE:</span>
    <div className="tooltip">
      You have 11 steps (121 pulses) to inhale & seal this Sigil.
      After this period, INHALE is permanently finalized & the Sigil is eternally sealed.
    </div>
  </div>
)}

            
                </div>
              </header>

              {/* Tabs */}
              <nav className="tabs" role="tablist" aria-label="Views" style={{ position: "sticky", top: 48, zIndex: 2 }}>
                <button role="tab" aria-selected={tab === "summary"} className={tab === "summary" ? "active" : ""} onClick={() => setTab("summary")}>
                  Presence
                </button>
                <button role="tab" aria-selected={tab === "lineage"} className={tab === "lineage" ? "active" : ""} onClick={() => setTab("lineage")}>
                  Stewardship
                </button>
                <button role="tab" aria-selected={tab === "data"} className={tab === "data" ? "active" : ""} onClick={() => setTab("data")}>
                  Memory
                </button>
                <button className="secondary" onClick={openValuation} disabled={!meta}>
                  Resonance
                </button>
                <button className="secondary" onClick={openNote} disabled={!svgURL}>
                  Note
                </button>
              </nav>
{/* Body */}
<section className="modal-body" role="tabpanel" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", overflowX: "hidden", paddingBottom: 80 }}>
  {tab === "summary" && (
    <div className="summary-grid">
      {/* ── NOW & RHYTHM ───────────────────────────────────────────── */}
      <div className="kv">
        <span className="k">Now</span>
        <span className="v">{pulseNow}</span>
      </div>

      {childDeadline && (
  <div className="kv">
    <span className="k">Inhale Seal:</span>
    <span className="v">
      {childDeadline.leftSteps} steps ({childDeadline.leftPulses} pulses) left
    </span>
  </div>
)}
{/* Child claim deadline (SEND sigil) */}
{canonicalContext === "derivative" && (() => {
  const { expireAt } = getChildLockInfo(meta, pulseNow);
  return (typeof expireAt === "number" && Number.isFinite(expireAt)) ? (
    <div className="kv">
      <span className="k">Inhale by:</span>
      <span className="v">{expireAt}</span>
    </div>
  ) : null;
})()}



      {/* ── IDENTITY & INTEGRITY ──────────────────────────────────── */}
      {meta.userPhiKey && (
        <div className="kv wide">
          <span className="k">Φ-Key:</span>
          <span className="v mono" style={{ overflowWrap: "anywhere" }}>
            {meta.userPhiKey}
            {phiKeyExpected && (phiKeyMatches ? <span className="chip ok">match</span> : <span className="chip err">mismatch</span>)}
          </span>
        </div>
      )}

      {meta.kaiSignature && (
        <div className="kv wide">
          <span className="k">Kai-Signature (Σ):</span>
          <span className="v mono" style={{ overflowWrap: "anywhere" }}>
            {meta.kaiSignature}
            {contentSigMatches === true && <span className="chip ok">match</span>}
            {contentSigMatches === false && <span className="chip err">mismatch</span>}
          </span>
        </div>
      )}

      {frequencyHz && (
        <div className="kv">
          <span className="k">Frequency (Hz):</span>
          <span className="v">{frequencyHz}</span>
        </div>
      )}
      {/* NEW: Chakra Gate */}
      {chakraGate && (
        <div className="kv">
          <span className="k">Spiral Gate:</span>
          <span className="v">{chakraGate}</span>
        </div>
      )}

            {/* Live ZK + proof */}
      {liveSig && (
        <div className="kv wide">
          <span className="k">ZK PROOF OF BREATH™:</span>
          <span className="v mono" style={{ overflowWrap: "anywhere" }}>
            {liveSig}
          </span>
        </div>
      )}


      {/* Presence-oriented user + timing */}
      <div className="kv wide">
        <span className="k">Stewardship Hash:</span>
        <span className="v mono" style={{ overflowWrap: "anywhere" }}>{canonical ?? "—"}</span>
      </div>

      {/* ── VALUE (single source of truth) ─────────────────────────── */}
      <div className="kv">
        <span className="k">{canonicalContext === "derivative" ? "Derivative Resonance" : "Resonance "}</span>
        <span className="v"> Φ{remainingPhiDisplay4}</span>
      </div>


      <div className="kv wide">
        <span className="k">Exhale key:</span>
        <span className="v mono" style={{ overflowWrap: "anywhere" }}>{(meta as SigilMetadataWithOptionals)?.creatorPublicKey ?? "—"}</span>
      </div>

      <div className="kv wide">
        <span className="k">Exhale nonce:</span>
        <span className="v mono" style={{ overflowWrap: "anywhere" }}>{meta.transferNonce ?? "—"}</span>
      </div>
                 <div className="kv">
        <span className="k">Issued @ (derivative):</span>
        <span className="v">{(meta as SigilMetadataWithOptionals)?.childIssuedPulse ?? "—"}</span>
      </div>

      {/* ── LINEAGE (Derivatives) ─────────────────────────────────── */}
      <div className="kv wide">
        <span className="k">Derivative of (source):</span>
        <span className="v mono" style={{ overflowWrap: "anywhere" }}>{(meta as SigilMetadataWithOptionals)?.childOfHash ?? "—"}</span>
      </div>

      {/* ── LIVE PROOFS ───────────────────────────────────────────── */}

      {headProof && (
        <div className="kv">
          <span className="k">Latest proof:</span>
          <span className="v">{headProof.ok ? `#${headProof.index + 1} ✓` : `#${headProof.index} ×`}</span>
        </div>
      )}
      {/* Additional data appended (same KV rows) */}
      {headProof !== null && (
        <div className="kv wide">
          <span className="k">Head proof root:</span>
          <span className="v mono" style={{ overflowWrap: "anywhere" }}>{headProof.root}</span>
        </div>
      )}
      <div className="kv wide">
        <span className="k">Head proof root (v14):</span>
        <span className="v mono" style={{ overflowWrap: "anywhere" }}>{(meta as SigilMetadataWithOptionals)?.transfersWindowRootV14 ?? "—"}</span>
      </div>

      {/* ── EXPIRY / WINDOW ───────────────────────────────────────── */}
      {/* Parent open-link expiry info */}
      {canonicalContext === "parent" && (() => {
        const pe = getParentOpenExpiry(meta, pulseNow);
        return pe.expireAt ? (
          <div className="kv">
            <span className="k">Inhale expires @:</span>
            <span className="v">{pe.expireAt}</span>
          </div>
        ) : null;
      })()}

      {/* Child lock/expiry info */}
      {canonicalContext === "derivative" && (
        <>
          {(meta as SigilMetadataWithOptionals)?.sendLock?.used && (
            <div className="kv">
              <span className="k">One-time lock:</span>
              <span className="v">Used</span>
            </div>
          )}
    
        </>
      )}



      {/* ── STRUCTURE & STATS ─────────────────────────────────────── */}
      <div className="kv">
        <span className="k">Hardened transfers:</span>
        <span className="v">{meta.hardenedTransfers?.length ?? 0}</span>
      </div>
      <div className="kv">
        <span className="k">Segments:</span>
        <span className="v">{meta.segments?.length ?? 0}</span>
      </div>
      <div className="kv">
        <span className="k">Segment size:</span>
        <span className="v">{meta.segmentSize ?? SEGMENT_SIZE}</span>
      </div>
      <div className="kv">
        <span className="k">Segment Depth:</span>
        <span className="v">{meta.cumulativeTransfers ?? 0}</span>
      </div>
      <div className="kv wide">
        <span className="k">Segment Tree Root:</span>
        <span className="v mono" style={{ overflowWrap: "anywhere" }}>{meta.segmentsMerkleRoot ?? "—"}</span>
      </div>

      {/* ── DEV SIGNALS ───────────────────────────────────────────── */}
      {rgbSeed && (
        <div className="kv">
          <span className="k">RGB seed:</span>
          <span className="v">{rgbSeed.join(", ")}</span>
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
                          let exhaleInfo:
                            | {
                                unit?: "USD" | "PHI";
                                amountPhi?: string;
                                amountUsd?: string;
                                usdPerPhi?: number;
                              }
                            | null = null;
                          try {
                            if (t.payload?.mime?.startsWith("application/vnd.kairos-exhale")) {
                              const obj = JSON.parse(base64DecodeUtf8(t.payload.encoded)) as {
                                kind?: string;
                                unit?: "USD" | "PHI";
                                amountPhi?: string;
                                amountUsd?: string;
                                usdPerPhi?: number;
                              } | null;
                              if (obj?.kind === "exhale") exhaleInfo = { unit: obj.unit, amountPhi: obj.amountPhi, amountUsd: obj.amountUsd, usdPerPhi: obj.usdPerPhi };
                            }
                          } catch (err) {
                            logError("lineage.decodeExhalePayload", err);
                          }

                          let lineagePhi = "";
                          let lineageUsd = "";
                          try {
                            if (exhaleInfo?.amountPhi) {
                              lineagePhi = fmtPhiFixed4(exhaleInfo.amountPhi);
                              if (typeof exhaleInfo.amountUsd === "string" && exhaleInfo.amountUsd) lineageUsd = exhaleInfo.amountUsd;
                              else if (typeof exhaleInfo.usdPerPhi === "number" && Number.isFinite(exhaleInfo.usdPerPhi)) {
                                const phiNum = Number(exhaleInfo.amountPhi);
                                lineageUsd = fmtUsdNoSym((Number.isFinite(phiNum) ? phiNum : 0) * exhaleInfo.usdPerPhi);
                              } else lineageUsd = "0.00";
                            }
                          } catch (err) {
                            logError("lineage.computeDisplay", err);
                          }

                          return (
                            <li key={i} className={open ? "transfer open" : "transfer closed"}>
                              <header>
                                <span className="index">#{i + 1}</span>
                                <span className={`state ${open ? "open" : "closed"}`}>{open ? "Pending receive" : "Sealed"}</span>
                              </header>
                              <div className="row">
                                <span className="k">Exhaler Σ</span>
                                <span className="v mono" style={{ overflowWrap: "anywhere" }}>
                                  {t.senderSignature}
                                </span>
                              </div>
                              <div className="row">
                                <span className="k">Exhaler Seal:</span>
                                <span className="v mono" style={{ overflowWrap: "anywhere" }}>
                                  {t.senderStamp}
                                </span>
                              </div>
                              <div className="row">
                                <span className="k">Exhaler Pulse</span>
                                <span className="v">{t.senderKaiPulse}</span>
                              </div>

                              {exhaleInfo?.amountPhi && (
                                <div className="row">
                                  <span className="k">Exhaled</span>
                                  <span className="v">
                                    Φ {lineagePhi} · ${lineageUsd}
                                  </span>
                                </div>
                              )}

                              {hardened && (
                                <>
                                  <div className="row">
                                    <span className="k">Prev-Head</span>
                                    <span className="v mono" style={{ overflowWrap: "anywhere" }}>
                                      {hardened.previousHeadRoot}
                                    </span>
                                  </div>
                                  <div className="row">
                                    <span className="k">Exhale leaf</span>
                                    <span className="v mono" style={{ overflowWrap: "anywhere" }}>
                                      {hardened.transferLeafHashSend}
                                    </span>
                                  </div>
                                  {hardened.transferLeafHashReceive && (
                                    <div className="row">
                                      <span className="k">Inhale leaf</span>
                                      <span className="v mono" style={{ overflowWrap: "anywhere" }}>
                                        {hardened.transferLeafHashReceive}
                                      </span>
                                    </div>
                                  )}
                                  {hardened.zkSend && (
                                    <div className="row">
                                      <span className="k">ZK Exhale:</span>
                                      <span className="v">{hardened.zkSend.verified ? "✓" : "•"} {hardened.zkSend.scheme}</span>
                                    </div>
                                  )}
                                  {hardened.zkSendBundle && (
                                    <div className="row">
                                      <span className="k">ZK Exhale hash:</span>
                                      <span className="v mono" style={{ overflowWrap: "anywhere" }}>
                                        {hardened.zkSend?.proofHash}
                                      </span>
                                    </div>
                                  )}
                                  {hardened.zkReceive && (
                                    <div className="row">
                                      <span className="k">ZK Inhale</span>
                                      <span className="v">{hardened.zkReceive.verified ? "✓" : "•"} {hardened.zkReceive.scheme}</span>
                                    </div>
                                  )}
                                  {hardened.zkReceiveBundle && (
                                    <div className="row">
                                      <span className="k">ZK Inhale hash</span>
                                      <span className="v mono" style={{ overflowWrap: "anywhere" }}>
                                        {hardened.zkReceive?.proofHash}
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}

                              {t.receiverSignature && (
                                <>
                                  <div className="row">
                                    <span className="k">Inhaler Σ</span>
                                    <span className="v mono" style={{ overflowWrap: "anywhere" }}>
                                      {t.receiverSignature}
                                    </span>
                                  </div>
                                  <div className="row">
                                    <span className="k">Inhaler Seal</span>
                                    <span className="v mono" style={{ overflowWrap: "anywhere" }}>
                                      {t.receiverStamp}
                                    </span>
                                  </div>
                                  <div className="row">
                                    <span className="k">Inhaler Pulse</span>
                                    <span className="v">{t.receiverKaiPulse}</span>
                                  </div>
                                </>
                              )}

                              {t.payload && (
                                <details className="payload" open>
                                  <summary>Payload</summary>
                                  <div className="row">
                                    <span className="k">Name</span>
                                    <span className="v">{t.payload.name}</span>
                                  </div>
                                  <div className="row">
                                    <span className="k">MIME</span>
                                    <span className="v">{t.payload.mime}</span>
                                  </div>
                                  <div className="row">
                                    <span className="k">Size</span>
                                    <span className="v">{t.payload.size} bytes</span>
                                  </div>
                                </details>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <p className="empty">No stewardship yet — ready to exhale from Sigil-Glyph.</p>
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
                      <pre className="raw-json" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                        {rawMeta}
                      </pre>
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
  {error && (
    <p className="status error" style={{ overflowWrap: "anywhere" }}>
      {error}
    </p>
  )}

  <div
    className="footer-actions"
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",          // ← NEW: allow a controlled wrap
      width: "100%",             // ← NEW: full width
      boxSizing: "border-box",   // ← NEW
    }}
  >
    {uiState === "unsigned" && (
      <button className="secondary" onClick={sealUnsigned}>
        Seal content (Σ + Φ)
      </button>
    )}

    {(uiState === "readySend" || uiState === "verified") && (
      <>
   
<SendPhiAmountField
  amountMode={amountMode}
  setAmountMode={setAmountMode}
  usdInput={usdInput}
  phiInput={phiInput}
  setUsdInput={setUsdInput}
  setPhiInput={setPhiInput}
  convDisplayRight={conv.displayRight}
  remainingPhiDisplay4={remainingPhiDisplay4}
  canonicalContext={canonicalContext}
  phiFormatter={fmtPhiCompact}
/>


        <button
          className="primary"
          onClick={send}
          aria-label="Exhale (send)"
          title={canShare ? "Exhale (seal & share)" : "Exhale (seal & copy link)"}
          disabled={!canExhale}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            padding: 0,
            flex: "0 0 auto", // ← NEW
          }}
        >
          <Svg path="send" label="Exhale" />
        </button>
      </>
    )}
     <button
          className="secondary"
          onClick={() => fileInput.current?.click()}
          aria-label="Attach a file"
          title="Attach a file"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            padding: 0,
            flex: "0 0 auto", // ← NEW: keep icon button compact
          }}
        >
          <Svg path="paperclip" label="Attach" />
        </button>
        <input ref={fileInput} type="file" hidden onChange={handleAttach} />

    {uiState === "readyReceive" && (
      <button
        className="primary"
        onClick={receive}
        aria-label="Inhale (receive)"
        title={
          canonicalContext === "derivative"
            ? childExpired
              ? "Link expired"
              : childUsed
              ? "Link already used"
              : "Inhale"
            : parentOpenExp
            ? "Send expired"
            : "Inhale"
        }
        disabled={
          (canonicalContext === "derivative" && (childExpired || childUsed)) ||
          (canonicalContext === "parent" && parentOpenExp)
        }
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 44,
          height: 44,
          padding: 0,
          flex: "0 0 auto", // ← NEW
        }}
      >
        <Svg path="recv" label="Inhale" />
      </button>
    )}

   {(meta?.transfers?.length ?? 0) > 0 && (
      <button
        className="secondary"
        onClick={sealSegmentNow}
        aria-label="Segment head window"
        title="Roll current head-window into a segment (continuous)"
        disabled={isSendFilename}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          padding: 0,
          flex: "0 0 auto", // ← NEW
        }}
      >
        <Svg path="stack" label="Segment" />
      </button>
    )}
  </div>
</footer>

            </>
          )}
        </div>
      </dialog>

      {/* Seal moment dialog (share link after SEND) */}
      <SealMomentModal
        open={sealOpen}
        url={sealUrl}
        hash={sealHash}
        onClose={() => {
          setSealOpen(false);
          setRotateOut(false);
          openVerifier();
        }}
        onDownloadZip={downloadZip}
      />

      {/* Valuation */}
      {meta && metaLiteForNote && (
        <ValuationModal
          open={valuationOpen}
          onClose={closeValuation}
          meta={metaLiteForNote}
          nowPulse={pulseNow}
          initialGlyph={initialGlyph ?? undefined}
          onAttach={uiState === "verified" ? onAttachValuation : undefined}
        />
      )}

      {/* Note printer */}
      <dialog
        ref={noteDlgRef}
        className="glass-modal fullscreen"
        id="note-dialog"
        data-open={noteOpen ? "true" : "false"}
        aria-label="Note Exhaler"
        style={{ width: "100vw", maxWidth: "100vw", height: "100dvh", maxHeight: "100dvh", margin: 0, padding: 0, overflow: "hidden" }}
      >
        <div className="modal-viewport" style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", maxWidth: "100vw", overflow: "hidden" }}>
          <div className="modal-topbar" style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center" }}>
            <div style={{ paddingInline: 12, fontSize: 12, color: "var(--dim)" }}>Kairos — Note Exhaler</div>
            <button className="close-btn holo" data-aurora="true" aria-label="Close" title="Close" onClick={closeNote} style={{ justifySelf: "end", marginRight: 8 }}>
              ×
            </button>
          </div>
          <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
            {sigilSvgRaw && metaLiteForNote ? (
              <NotePrinter meta={metaLiteForNote} initial={noteInitial} />
            ) : sigilSvgRaw ? (
              <div style={{ padding: 16, color: "var(--dim)" }}>Missing valuation metadata for Note — upload/parse a sigil first.</div>
            ) : (
              <div style={{ padding: 16, color: "var(--dim)" }}>Load a sigil to print a note.</div>
            )}
          </div>
        </div>
      </dialog>

      {/* Explorer */}
      <dialog
        ref={explorerDlgRef}
        className="explorer-dialog"
        id="explorer-dialog"
        aria-label="Sigil Explorer"
        data-open={explorerOpen ? "true" : "false"}
        style={{ width: "100vw", height: "100dvh", margin: 0, padding: 0, overflow: "hidden" }}
      >
        <div className="explorer-chrome" style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: "100vw" }}>
          <div className="explorer-topbar" style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center" }}>
            <h3 className="explorer-title">ΦStream</h3>
            <button className="close-btn holo" data-aurora="true" aria-label="Close explorer" title="Close" onClick={closeExplorer} style={{ justifySelf: "end", marginRight: 6 }}>
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

/* Wrapped export with ErrorBoundary + Suspense */
export default function VerifierStamper() {
  return (
    <VerifierErrorBoundary onReset={() => { /* optional: clear local state or reload */ }}>
      <React.Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
        <VerifierStamperInner />
      </React.Suspense>
    </VerifierErrorBoundary>
  );
}
