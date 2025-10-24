/* ────────────────────────────────────────────────────────────────
   VerifierStamper.tsx · Divine Sovereign Transfer Gate (mobile-first)
   v14.4 — Sovereign hardening++++ (ECDSA + optional ZK bind)
   (modularized, unchanged behavior) — NOTE bridge + NotePrinter wired
   + Live USD/Φ switcher, icon buttons, lineage amount display
   + HARD CAP on exhale (cannot send more Φ than available on sigil)
   + Balance persists across segmentations (branchBasePhi/branchSpentPhi)
────────────────────────────────────────────────────────────────── */

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import "./VerifierStamper.css";

/* ── Explorer + Seal modals ─────────────────────────────────── */
import SealMomentModal from "../SealMomentModal";
import SigilExplorer from "../SigilExplorer";
import ValuationModal from "../ValuationModal";
import { buildValueSeal, attachValuation, type SigilMetadataLite, type ValueSeal } from "../../utils/valuation";
// NEW — Note Exhaler (preview + print only)
import NotePrinter from "../ExhaleNote";
import type {
  VerifierBridge,
  BanknoteInputs as NoteBanknoteInputs,
} from "../exhale-note/types";

/* Project utils (types + URL helper) */
import { makeSigilUrl, type SigilSharePayloadLoose, encodeSigilHistory, type SigilTransferLite } from "../../utils/sigilUrl";

/* Local modular imports */
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

/* ⭐ New: lightweight header valuation helpers */
import { DEFAULT_ISSUANCE_POLICY, quotePhiForUsd } from "../../utils/phi-issuance";
import { BREATH_MS } from "../valuation/constants";

/* Helper type: optional fields that may exist in metadata */
type SigilMetadataWithOptionals = SigilMetadata & {
  stepsPerBeat?: number;
  transfersWindowRoot?: string;
  transfersWindowRootV14?: string;
  zkVerifyingKey?: unknown;
  creatorPublicKey?: string;
  /* NEW: persist branch balance across segmentations */
  branchBasePhi?: string;  // decimal string (up to 18dp)
  branchSpentPhi?: string; // decimal string (up to 18dp)
};

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

/** Append ?p= (and ?t= if provided) to a base URL; optionally add &h= */
function rewriteUrlPayload(
  baseUrl: string,
  enriched: SigilSharePayloadLoose & {
    canonicalHash?: string;
    transferNonce?: string;
  },
  token?: string,
  historyParam?: string
): string {
  const u = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  u.searchParams.set("p", base64urlJson(enriched));
  if (token) u.searchParams.set("t", token);
  if (historyParam && historyParam.length > 0) u.searchParams.set("h", historyParam);
  return u.toString();
}

/* ────────────────────────────────────────────────────────────────
   NOTE bridge types + helpers (for ExhaleNote)
────────────────────────────────────────────────────────────────── */

declare global {
  interface Window {
    KKVerifier?: VerifierBridge | undefined;
    SIGIL_ZK_VKEY?: unknown;
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
  }
}

/* ────────────────────────────────────────────────────────────────
   Small utilities (logging + UTF-8 base64 helpers)
────────────────────────────────────────────────────────────────── */

function logError(where: string, err: unknown) {
  // eslint-disable-next-line no-console
  console.error(`[VerifierStamper] ${where}`, err);
  try {
    window.dispatchEvent(
      new CustomEvent("kk:error", {
        detail: { where, error: err instanceof Error ? err.message : String(err) },
      })
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[VerifierStamper] Error dispatching kk:error from ${where}`, e);
  }
}

function base64EncodeUtf8(str: string): string {
  try {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  } catch (err) {
    logError("base64EncodeUtf8", err);
    return "";
  }
}

function base64DecodeUtf8(b64: string): string {
  try {
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch (err) {
    logError("base64DecodeUtf8", err);
    return "";
  }
}

function buildNotePayload(opts: {
  meta: SigilMetadata | null;
  sigilSvgRaw: string | null;
  verifyUrl?: string;
  pulseNow: number;
}): NoteBanknoteInputs {
  const { meta: m, sigilSvgRaw, verifyUrl, pulseNow } = opts;
  if (!m) return { nowPulse: String(pulseNow) };

  const readStr = (obj: unknown, key: string, fallback = ""): string => {
    const rec = obj as Record<string, unknown>;
    const v = rec?.[key];
    return typeof v === "string" ? v : fallback;
  };

  const valuation = (m.valuation ?? null) as
    | {
        valuePhi?: number;
        premiumPhi?: number;
        algorithm?: string | number;
        stamp?: string | number;
      }
    | null;

  const extra = m as unknown as {
    sigmaCanon?: string;
    shaHex?: string;
    phiDerived?: string;
    zk?: { scheme?: string; poseidon?: string };
  };

  const prov =
    (m.transfers ?? []).map((t) => ({
      action: t.receiverSignature ? "receive" : "send",
      pulse: t.senderKaiPulse,
      beat: m.beat,
      stepIndex: m.stepIndex,
      ownerPhiKey: m.userPhiKey,
    })) ?? [];

  return {
    purpose: readStr(m, "purpose"),
    to: readStr(m, "to"),
    from: readStr(m, "from"),
    location: readStr(m, "location"),
    witnesses: readStr(m, "witnesses"),
    reference: readStr(m, "reference"),
    remark: readStr(m, "remark", "In Yahuah We Trust — Secured by Φ, not man-made law"),
    valuePhi: valuation?.valuePhi != null ? String(valuation.valuePhi) : "",
    premiumPhi: valuation?.premiumPhi != null ? String(valuation.premiumPhi) : "",
    computedPulse: typeof m.pulse === "number" ? String(m.pulse) : "",
    nowPulse: String(pulseNow),
    kaiSignature: m.kaiSignature ?? "",
    userPhiKey: m.userPhiKey ?? "",
    sigmaCanon: extra.sigmaCanon ?? "",
    shaHex: extra.shaHex ?? "",
    phiDerived: extra.phiDerived ?? "",
    valuationAlg: valuation?.algorithm != null ? String(valuation.algorithm) : "",
    valuationStamp: valuation?.stamp != null ? String(valuation.stamp) : "",
    provenance: prov.slice(-7),
    zk: extra.zk ? { scheme: extra.zk.scheme, poseidon: extra.zk.poseidon } : undefined,
    sigilSvg: sigilSvgRaw ?? "",
    verifyUrl: verifyUrl || "",
  };
}

/* ────────────────────────────────────────────────────────────────
   Modal helpers (fix native <dialog> stacking)
────────────────────────────────────────────────────────────────── */
function safeShowDialog(d: HTMLDialogElement | null | undefined) {
  if (!d) return;
  try {
    if (!d.open) d.showModal();
  } catch (err) {
    logError("safeShowDialog.showModal", err);
    try {
      d.show?.();
    } catch (err2) {
      logError("safeShowDialog.show", err2);
    }
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

/* ────────────────────────────────────────────────────────────────
   Tiny decimal toolkit (no rounding for Φ; we truncate for math)
   + display helpers (rounded output for UX)
────────────────────────────────────────────────────────────────── */
const SCALE = 18n; // 18 decimal places for Φ precision

function pow10(n: bigint): bigint {
  let r = 1n;
  for (let i = 0n; i < n; i++) r *= 10n;
  return r;
}
const TEN_S = pow10(SCALE);

/** Convert a decimal string to scaled BigInt (SCALE places). Accepts "", ".", etc. */
function toScaledBig(s: string): bigint {
  const t = (s || "").trim();
  if (!t) return 0n;
  const sign = t.startsWith("-") ? -1n : 1n;
  const clean = t.replace(/[^0-9.]/g, "").replace(/^\.*/, (m) => (m ? "0." : ""));
  const [intPartRaw, fracRaw = ""] = clean.split(".");
  const intPart = intPartRaw.replace(/^0+(?=\d)/, "") || "0";
  const fracPart = (fracRaw + "0".repeat(Number(SCALE))).slice(0, Number(SCALE));
  const whole = BigInt(intPart) * TEN_S + BigInt(fracPart || "0");
  return sign * whole;
}

/** Scaled BigInt -> decimal string, trimming trailing zeros (no rounding). */
function fromScaledBig(bi: bigint): string {
  const sign = bi < 0n ? "-" : "";
  const v = bi < 0n ? -bi : bi;
  const intPart = v / TEN_S;
  let frac = (v % TEN_S).toString().padStart(Number(SCALE), "0");
  // trim trailing zeros
  frac = frac.replace(/0+$/, "");
  return frac.length ? `${sign}${intPart.toString()}.${frac}` : `${sign}${intPart.toString()}`;
}

/** (a * b) / 10^S, truncated */
function mulScaled(a: bigint, b: bigint): bigint {
  return (a * b) / TEN_S;
}
/** (a * 10^S) / b, truncated */
function divScaled(a: bigint, b: bigint): bigint {
  if (b === 0n) return 0n;
  return (a * TEN_S) / b;
}

/** Round a SCALE-scaled bigint to a fixed number of decimal places for display. */
function roundScaledToDecimals(bi: bigint, decimals: number): bigint {
  const d = Math.max(0, Math.min(Number(SCALE), decimals)) as number;
  const factor = pow10(SCALE - BigInt(d));
  const half = factor / 2n;
  if (bi >= 0n) return ((bi + half) / factor) * factor;
  return ((bi - half) / factor) * factor;
}

/** Format a SCALE-scaled bigint with a fixed number of decimals (e.g., 4) */
function fromScaledBigFixed(bi: bigint, decimals: number): string {
  const d = Math.max(0, Math.min(Number(SCALE), decimals));
  const sign = bi < 0n ? "-" : "";
  const v = bi < 0n ? -bi : bi;
  const cut = pow10(SCALE - BigInt(d));
  const val = v / cut; // integer now scaled by 10^d
  const tenD = pow10(BigInt(d));
  const intPart = val / tenD;
  const fracPart = (val % tenD).toString().padStart(d, "0");
  return `${sign}${intPart.toString()}.${fracPart}`;
}

/** Convenience: format a decimal string (Φ) to exactly 4 places for display */
function fmtPhiFixed4(phiStr: string): string {
  const scaled = toScaledBig(phiStr);
  const rounded = roundScaledToDecimals(scaled, 4);
  return fromScaledBigFixed(rounded, 4);
}

/* ────────────────────────────────────────────────────────────────
   Exhale helpers (sum Φ exhaled from lineage payloads)
   NOTE: counts all open/closed transfers to prevent double-spend.
────────────────────────────────────────────────────────────────── */
function exhalePhiFromTransferScaled(t: SigilTransfer | undefined): bigint {
  if (!t || !t.payload) return 0n;
  const pmime = t.payload.mime || "";
  if (!pmime.startsWith("application/vnd.kairos-exhale")) return 0n;
  try {
    const raw = base64DecodeUtf8(t.payload.encoded);
    const obj = JSON.parse(raw);
    if (obj?.kind === "exhale" && typeof obj.amountPhi === "string") {
      return toScaledBig(obj.amountPhi);
    }
  } catch (err) {
    logError("exhalePhiFromTransferScaled", err);
  }
  return 0n;
}

/* ═════════════ COMPONENT ═════════════ */
const VerifierStamper: React.FC = () => {
  const svgInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dlgRef = useRef<HTMLDialogElement>(null);
  const explorerDlgRef = useRef<HTMLDialogElement>(null);

  const [pulseNow, setPulseNow] = useState(kaiPulseNow());
  useEffect(() => {
    const id = window.setInterval(() => setPulseNow(kaiPulseNow()), 1000);
    return () => window.clearInterval(id);
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

  // explicit union so setPayload(null) is valid
  const [payload, setPayload] = useState<SigilPayload | null>(null);

  // NEW — amount entry (toggle USD/Φ)
  const [amountMode, setAmountMode] = useState<"USD" | "PHI">("PHI");
  const [phiInput, setPhiInput] = useState<string>("");
  const [usdInput, setUsdInput] = useState<string>("");

  const [uiState, setUiState] = useState<UiState>("idle");
  const [tab, setTab] = useState<TabKey>("summary");
  const [error, setError] = useState<string | null>(null);
  const [viewRaw, setViewRaw] = useState(false);

  /* On-device head-proof status */
  const [headProof, setHeadProof] = useState<{ ok: boolean; index: number; root: string } | null>(null);

  /* ── Modals ──────────────── */
  const [sealOpen, setSealOpen] = useState(false);
  const [sealUrl, setSealUrl] = useState("");
  const [sealHash, setSealHash] = useState("");
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [valuationOpen, setValuationOpen] = useState(false);

  // Note Exhaler
  const noteDlgRef = useRef<HTMLDialogElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);

  // raw SVG for NotePrinter
  const [sigilSvgRaw, setSigilSvgRaw] = useState<string | null>(null);

  /* v14 key (silent) */
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

  /* Auto-load verifying key */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/verification_key.json", { cache: "no-store" });
        if (!res.ok) return;
        const vkey: unknown = await res.json();
        if (!alive) return;
        (window as Window).SIGIL_ZK_VKEY = vkey;
      } catch (err) {
        logError("fetch(/verification_key.json)", err);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const openVerifier = () => {
    const d = dlgRef.current;
    if (!d) return;
    safeShowDialog(d);
  };
  const closeVerifier = () => {
    dlgRef.current?.close();
    dlgRef.current?.setAttribute("data-open", "false");
  };

  const openExplorer = () => {
    const d = explorerDlgRef.current;
    if (!d) return;
    safeShowDialog(d);
    setExplorerOpen(true);
  };
  const closeExplorer = () => {
    explorerDlgRef.current?.close();
    explorerDlgRef.current?.setAttribute("data-open", "false");
    setExplorerOpen(false);
  };

  /* ──────────────────────────────────────────────────────────────
     NOTE bridge hydration
  ────────────────────────────────────────────────────────────── */
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
      (window as Window).KKVerifier = { getNoteData: async () => p };
      try {
        window.dispatchEvent(new CustomEvent<NoteBanknoteInputs>("kk:note-data", { detail: p }));
      } catch (err) {
        logError("dispatchEvent(kk:note-data)", err);
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

  /* Valuation modal */
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

  /* Head window recompute + verify */
  const refreshHeadWindow = useCallback(async (m: SigilMetadata) => {
    const transfers = m.transfers ?? [];
    const root = await computeHeadWindowRoot(transfers);
    (m as SigilMetadataWithOptionals).transfersWindowRoot = root;

    if (transfers.length > 0) {
      const leaves = await Promise.all(transfers.map(hashTransfer));
      const index = leaves.length - 1;
      const proof = await merkleProof(leaves, index);
      const okDirect = await verifyProof(root, proof);
      const okBundle = await verifyHistorical(m, {
        kind: "head",
        windowMerkleRoot: root,
        transferProof: proof,
      });
      setHeadProof({ ok: okDirect && okBundle, index, root });
    } else {
      setHeadProof(null);
    }

    // v14 hardened window root
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
      void (async () => {
        await verifyZkOnHead(m);
        setMeta({ ...m });
      })();
    } catch (err) {
      logError("refreshHeadWindow.verifyZkOnHead", err);
    }

    return m;
  }, []);

  /* SVG upload */
  const handleSvg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    try {
      setSigilSvgRaw(await f.text());
    } catch (err) {
      logError("handleSvg.readFile", err);
      setSigilSvgRaw(null);
    }

    setError(null);
    setPayload(null);
    setTab("summary");
    setViewRaw(false);

    const url = URL.createObjectURL(f);
    setSvgURL(url);

    const { meta: m, contextOk, typeOk } = await parseSvgFile(f);

    m.segmentSize ??= SEGMENT_SIZE;
    const segCount = (m.segments ?? []).reduce((a, s) => a + (s.count || 0), 0);
    if (typeof m.cumulativeTransfers !== "number") {
      m.cumulativeTransfers = segCount + (m.transfers?.length ?? 0);
    }
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
      typeof m.pulse === "number" &&
      typeof m.beat === "number" &&
      typeof m.stepIndex === "number" &&
      typeof m.chakraDay === "string";

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

    // reset amount inputs on fresh file
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

  /* Seal unsigned */
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

    try {
      if (!(m as SigilMetadataWithOptionals).creatorPublicKey && me) (m as SigilMetadataWithOptionals).creatorPublicKey = me.spkiB64u;
    } catch (err) {
      logError("sealUnsigned.setCreatorPublicKey", err);
    }

    const durl = await embedMetadata(svgURL, m);
    download(durl, `${safeFilename("sigil_sealed", nowPulse)}.svg`);

    const m2 = await refreshHeadWindow(m);
    setMeta(m2);
    setRawMeta(JSON.stringify(m2, null, 2));
    setUiState((prev) => (prev === "unsigned" ? "readySend" : prev));
    setError(null);
  };

  /* Share link */
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

    const enriched = { ...sharePayload, canonicalHash: canonical, transferNonce: token };

    let base = "";
    try {
      base = makeSigilUrl(canonical, sharePayload);
    } catch (err) {
      logError("shareTransferLink.makeSigilUrl", err);
      const u = new URL(typeof window !== "undefined" ? window.location.href : "http://localhost");
      u.pathname = `/s/${canonical}`;
      base = u.toString();
    }

    let historyParam: string | undefined;
    try {
      const lite: SigilTransferLite[] = [];
      for (const t of m.transfers ?? []) {
        if (!t || typeof t.senderSignature !== "string" || typeof t.senderKaiPulse !== "number") continue;
        const entry: SigilTransferLite = { s: t.senderSignature, p: t.senderKaiPulse };
        if (typeof t.receiverSignature === "string" && t.receiverSignature) entry.r = t.receiverSignature;
        lite.push(entry);
      }
      if (lite.length > 0) {
        const enc = encodeSigilHistory(lite); // "h:<b64url>"
        historyParam = enc.startsWith("h:") ? enc.slice(2) : enc;
      }
    } catch (err) {
      logError("shareTransferLink.encodeSigilHistory", err);
    }

    const url = rewriteUrlPayload(base, enriched, token, historyParam);
    setSealUrl(url);
    setSealHash(canonical);
    setSealOpen(true);
  }, []);

  /* ──────────────────────────────────────────────────────────────
     QUOTES / FORMATTING
  ────────────────────────────────────────────────────────────── */
  const fmtPhiCompact = useCallback((s: string) => {
    // keep user-entered precision; just strip leading zeros if any
    let t = (s || "").trim();
    if (!t) return "0";
    if (t.startsWith(".")) t = "0" + t;
    // remove trailing decimal dot
    t = t.replace(/\.?$/, (m) => (/\.\d/.test(t) ? m : ""));
    return t;
  }, []);
  const fmtUsdNoSym = useCallback((v: number) => {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    }).format(Math.max(0, v || 0));
  }, []);

  const canShare = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const nav = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
      canShare?: (data: ShareData) => boolean;
    };
    return typeof nav.share === "function";
  }, []);

  /* Revoke object URLs to avoid leaks */
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

  const metaLite = useMemo(() => (meta ? (meta as unknown as SigilMetadataLite) : null), [meta]);

  const metaLiteForNote = useMemo<SigilMetadataLite | null>(() => {
    if (!meta) return null;
    const mOpt = meta as SigilMetadataWithOptionals;
    const day = normalizeChakraDay(meta.chakraDay) ?? "Root";
    const steps = mOpt.stepsPerBeat ?? 12;
    const twr = mOpt.transfersWindowRoot ?? mOpt.transfersWindowRootV14;
    const obj: Partial<SigilMetadataLite> & {
      pulse: number;
      beat: number;
      stepIndex: number;
      stepsPerBeat: number;
      chakraDay: ChakraDay;
    } = {
      pulse: meta.pulse as number,
      beat: meta.beat as number,
      stepIndex: meta.stepIndex as number,
      stepsPerBeat: steps,
      chakraDay: day,
      kaiSignature: meta.kaiSignature ?? "",
      userPhiKey: meta.userPhiKey ?? "",
      transfersWindowRoot: twr,
    };
    return obj as SigilMetadataLite;
  }, [meta]);

  /* Seed Valuation */
  type InitialGlyph = { hash: string; value: number; pulseCreated: number; meta: SigilMetadataLite };
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
        const headHash =
          (meta as SigilMetadataWithOptionals)?.transfersWindowRoot ??
          (meta as SigilMetadataWithOptionals)?.transfersWindowRootV14;
        const { seal } = await buildValueSeal(metaLite, pulseNow, sha256Hex, headHash);
        if (!cancelled) {
          setInitialGlyph({
            hash: canonical,
            value: seal.valuePhi ?? 0,
            pulseCreated: metaLite.pulse ?? pulseNow,
            meta: metaLite,
          });
        }
      } catch (err) {
        logError("buildValueSeal", err);
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

  // ensure raw SVG for Note
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

  /* ──────────────────────────────────────────────────────────────
     Header valuation (Φ + USD ticker)
     (UPDATED to persist balance across segmentations)
  ────────────────────────────────────────────────────────────── */

  // ── NEW: read persisted branch base & spent (if any)
  const persistedBaseScaled = useMemo(
    () => toScaledBig(((meta as SigilMetadataWithOptionals | null)?.branchBasePhi ?? "")),
    [meta]
  );
  const persistedSpentScaled = useMemo(
    () => toScaledBig(((meta as SigilMetadataWithOptionals | null)?.branchSpentPhi ?? "0")),
    [meta]
  );

  // ── pivot logic within CURRENT head window only (post-seg)
  const pivotIndex = useMemo(() => {
    const trs = meta?.transfers ?? [];
    // last sealed receive (becomes our branch root). If none, use last open send.
    for (let i = trs.length - 1; i >= 0; i--) {
      if (trs[i]?.receiverSignature) return i;
    }
    return trs.length > 0 ? trs.length - 1 : -1;
  }, [meta?.transfers]);

  // Base Φ: prefer persisted branchBasePhi; else parent's sent at pivot; else initial valuation
  const basePhiScaled = useMemo(() => {
    if (persistedBaseScaled > 0n) return persistedBaseScaled;
    if (pivotIndex >= 0 && meta?.transfers) {
      const v = exhalePhiFromTransferScaled(meta.transfers[pivotIndex]);
      return v > 0n ? v : 0n;
    }
    return toScaledBig(((initialGlyph?.value ?? 0) as number).toString());
  }, [persistedBaseScaled, pivotIndex, meta?.transfers, initialGlyph]);

  // Spent AFTER pivot within CURRENT head window (not yet sealed)
  const currentWindowSpentScaled = useMemo(() => {
    let sum = 0n;
    try {
      const trs = meta?.transfers ?? [];
      for (let i = Math.max(0, pivotIndex + 1); i < trs.length; i++) {
        sum += exhalePhiFromTransferScaled(trs[i]);
      }
    } catch (err) {
      logError("remainingPhiScaled.sumAfterPivot", err);
    }
    return sum;
  }, [meta?.transfers, pivotIndex]);

  // Total spent across branch = persisted (sealed) + current window (unsealed)
  const totalSpentScaled = useMemo(() => persistedSpentScaled + currentWindowSpentScaled, [persistedSpentScaled, currentWindowSpentScaled]);

  // Remaining Φ available on this glyph (exact, matches send hard-cap)
  const remainingPhiScaled = useMemo(() => {
    return basePhiScaled > totalSpentScaled ? basePhiScaled - totalSpentScaled : 0n;
  }, [basePhiScaled, totalSpentScaled]);

  const remainingPhiNumber = useMemo(() => Number(fromScaledBig(remainingPhiScaled)), [remainingPhiScaled]);

  /* Header ticker state */
  const [headerPhi, setHeaderPhi] = useState<number | null>(null);
  const [headerFlash, setHeaderFlash] = useState<"up" | "down" | null>(null);
  const [headerTrend, setHeaderTrend] = useState<"up" | "down" | "flat">("flat");

  // Seed header with exact remaining Φ (no drift)
  useEffect(() => {
    if (initialGlyph) {
      setHeaderPhi(remainingPhiNumber);
      setHeaderTrend("flat");
    }
  }, [initialGlyph, remainingPhiNumber]);

  const issuancePolicy = DEFAULT_ISSUANCE_POLICY;
  const headerQuote = useMemo(() => {
    try {
      if (!metaLiteForNote) return { usdPerPhi: 0, phiPerUsd: 0 };
      return quotePhiForUsd(
        {
          meta: metaLiteForNote,
          nowPulse: pulseNow,
          usd: 100,
          currentStreakDays: 0,
          lifetimeUsdSoFar: 0,
        },
        issuancePolicy
      );
    } catch (err) {
      logError("quotePhiForUsd", err);
      return { usdPerPhi: 0, phiPerUsd: 0 };
    }
  }, [metaLiteForNote, pulseNow, issuancePolicy]);

  const headerUsd = (headerPhi ?? 0) * (headerQuote.usdPerPhi || 0);

  // Snap header to remaining Φ; keep trend flash for UX, but no noise
  useEffect(() => {
    if (!initialGlyph) return;
    let timer: number | undefined;
    const tick = () => {
      setHeaderPhi((last) => {
        const target = remainingPhiNumber;
        const prev = last ?? target;
        const next = target; // snap exactly so it always matches available
        const trend: "up" | "down" | "flat" = next > prev ? "up" : next < prev ? "down" : "flat";
        setHeaderTrend(trend);
        setHeaderFlash(trend === "flat" ? null : trend);
        window.setTimeout(() => setHeaderFlash(null), 420);
        return next;
      });
      timer = window.setTimeout(tick, BREATH_MS);
    };
    timer = window.setTimeout(tick, BREATH_MS);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [initialGlyph, remainingPhiNumber]);

  /* Live conversion for the input UI
     - Φ math remains exact (scaled bigint, truncated ops)
     - USD→Φ display (only) gets rounded to 4dp for readability
  */
  const usdPerPhiRateScaled = useMemo(() => {
    const rate = headerQuote?.usdPerPhi || 0;
    // toFixed prepares a normalized decimal string for scaling
    return toScaledBig(rate.toFixed(18));
  }, [headerQuote]);

  const conv = useMemo(() => {
    const mode = amountMode;
    if (mode === "PHI") {
      // normalize the user-entered string (keep precision, strip leading zeros / dangling dot)
      const phiNormalized = fmtPhiCompact(phiInput);
      const phiScaled = toScaledBig(phiNormalized);
      const usdScaled = mulScaled(phiScaled, usdPerPhiRateScaled);
      const usdNumber = Number(fromScaledBig(usdScaled)); // display convenience
      return {
        displayLeftLabel: "Φ",
        displayRight: Number.isFinite(usdNumber) ? `$ ${fmtUsdNoSym(usdNumber)}` : "$ 0.00",
        // preserve entered precision for the send payload
        phiStringToSend: phiNormalized,
        usdNumberAtSend: Number.isFinite(usdNumber) ? usdNumber : 0,
      };
    } else {
      const usdScaled = toScaledBig(usdInput);
      const phiScaled = divScaled(usdScaled, usdPerPhiRateScaled); // TRUNCATE => no rounding (math)
      const phiStrExact = fromScaledBig(phiScaled);
      // Display: round to 4dp for readability only
      const phiDisplay4 = fromScaledBigFixed(roundScaledToDecimals(phiScaled, 4), 4);
      return {
        displayLeftLabel: "$",
        displayRight: `≈ Φ ${phiDisplay4}`,
        phiStringToSend: phiStrExact, // computed phi (full precision string, truncated math)
        usdNumberAtSend: Number(fromScaledBig(usdScaled)) || 0,
      };
    }
  }, [amountMode, phiInput, usdInput, usdPerPhiRateScaled, fmtUsdNoSym, fmtPhiCompact]);

  /* ---------- Icon primitives ---------- */
  type IconKind = "ok" | "warn" | "err" | "info";

  const IconCircle: React.FC<{
    title: string;
    kind?: IconKind;
    children: React.ReactNode;
    badge?: number | null;
  }> = ({ title, kind = "info", children, badge = null }) => (
    <span
      className={`chip icon ${kind}`}
      role="img"
      aria-label={title}
      title={title}
      {...(badge != null ? { "data-badge": String(badge) } : {})}
    >
      {children}
    </span>
  );

  const Svg: React.FC<{
    path:
      | "check"
      | "x"
      | "warn"
      | "shield"
      | "sigma"
      | "phi"
      | "send"
      | "recv"
      | "done"
      | "stack"
      | "hash"
      | "zk"
      | "paperclip";
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
      paperclip:
        "M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.2a2 2 0 01-2.83-2.83l8.49-8.49",
    };
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="ico">
        {label ? <title>{label}</title> : null}
        <path d={p[path]} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    );
  };

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

  /* Header chip status */
  const statusChips = () => {
    const chips: React.ReactNode[] = [];
    if (uiState === "invalid") chips.push(<IconCircle key="inv" kind="err" title="Invalid"><Svg path="x" /></IconCircle>);
    if (uiState === "structMismatch") chips.push(<IconCircle key="struct" kind="err" title="Structure mismatch"><Svg path="warn" /></IconCircle>);
    if (uiState === "sigMismatch") chips.push(<IconCircle key="sigm" kind="err" title="Signature mismatch"><Svg path="x" /></IconCircle>);
    if (uiState === "notOwner") chips.push(<IconCircle key="owner" kind="warn" title="Not owner"><Svg path="shield" /></IconCircle>);
    if (uiState === "unsigned") chips.push(<IconCircle key="unsigned" kind="warn" title="Unsigned"><Svg path="hash" /></IconCircle>);
    if (uiState === "readySend") chips.push(<IconCircle key="send" kind="info" title="Ready to send"><Svg path="send" /></IconCircle>);
    if (uiState === "readyReceive") chips.push(<IconCircle key="recv" kind="info" title="Ready to receive"><Svg path="recv" /></IconCircle>);
    if (uiState === "complete") chips.push(<IconCircle key="done" kind="ok" title="Lineage sealed"><Svg path="done" /></IconCircle>);
    if (uiState === "verified") chips.push(<IconCircle key="ver" kind="ok" title="Verified"><Svg path="check" /></IconCircle>);
    if (contentSigMatches === true) chips.push(<IconCircle key="sigok" kind="ok" title="Content Σ match"><Svg path="sigma" /></IconCircle>);
    if (contentSigMatches === false) chips.push(<IconCircle key="sigerr" kind="err" title="Content Σ mismatch"><Svg path="sigma" /></IconCircle>);
    if (phiKeyMatches === true) chips.push(<IconCircle key="phiok" kind="ok" title="Φ-Key match"><Svg path="phi" /></IconCircle>);
    if (phiKeyMatches === false) chips.push(<IconCircle key="phierr" kind="err" title="Φ-Key mismatch"><Svg path="phi" /></IconCircle>);
    if (meta?.cumulativeTransfers != null) chips.push(<IconCircle key="cum" kind="info" title="Cumulative transfers" badge={meta.cumulativeTransfers}><Svg path="hash" /></IconCircle>);
    if ((meta?.segments?.length ?? 0) > 0) chips.push(<IconCircle key="segs" kind="info" title="Segments" badge={meta?.segments?.length ?? 0}><Svg path="stack" /></IconCircle>);
    if (headProof) chips.push(<IconCircle key="headproof" kind={headProof.ok ? "ok" : "err"} title={headProof.ok ? "Head proof verified" : "Head proof failed"}><Svg path="shield" /></IconCircle>);
    if ((meta as SigilMetadataWithOptionals | null)?.transfersWindowRootV14) chips.push(<IconCircle key="v14root" kind="info" title="v14 head root present"><Svg path="hash" /></IconCircle>);
    const anyZkVerified = (meta?.hardenedTransfers ?? []).some((ht) => ht.zkSend?.verified || ht.zkReceive?.verified);
    if (anyZkVerified) chips.push(<IconCircle key="zk" kind="ok" title="Zero-knowledge proof verified"><Svg path="zk" /></IconCircle>);
    return chips;
  };

  /* Export ZIP */
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
    const JSZipModule = await import("jszip");
    const zip = new JSZipModule.default();
    const sigilPulse = meta.pulse ?? 0;
    const last = meta.transfers?.slice(-1)[0];
    const sendPulse = last?.senderKaiPulse ?? meta.kaiPulse ?? kaiPulseNow();
    const base = pulseFilename("sigil_bundle", sigilPulse, sendPulse);
    zip.file(`${base}.svg`, svgBlob);
    if (pngBlob) zip.file(`${base}.png`, pngBlob);
    const zipBlob = await zip.generateAsync({ type: "blob" });
    download(zipBlob, `${base}.zip`);
  }, [meta, svgURL]);

  /* Send flow */
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

    // Payload from amount input (optional)
    let chosenPayload: SigilPayload | undefined = undefined;
    const rawPhiStr = conv.phiStringToSend; // either entered (Φ mode) or computed (USD mode)
    const usdNum = conv.usdNumberAtSend;

    // normalize with fmtPhiCompact (keeps precision, strips leading zeros)
    const normalizedPhi = fmtPhiCompact(rawPhiStr);
    const validPhi = normalizedPhi && /^(\d+(\.\d+)?|\.\d+)$/.test(normalizedPhi) ? normalizedPhi.replace(/^0+(?=\d)/, "") : "";
    const hasPhi = !!validPhi && Number(validPhi) > 0;

    /* ─────────────────────────────────────────────
       HARD CAP ENFORCEMENT (branch-aware, persists across seals)
       - base = persisted branchBasePhi if present, else parent's sent Φ at pivot,
               otherwise initial glyph valuation
       - spentSoFar = persisted branchSpentPhi (sealed) + Σ(exhale after pivot in CURRENT window)
       - remaining = base − spentSoFar
       - if requested > remaining => block
    ───────────────────────────────────────────── */
    const trs = m.transfers ?? [];
    let pivotIdx = -1;
    for (let i = trs.length - 1; i >= 0; i--) {
      if (trs[i]?.receiverSignature) {
        pivotIdx = i;
        break;
      }
    }
    if (pivotIdx === -1 && trs.length > 0) pivotIdx = trs.length - 1; // last open send (pre-receive)

    const persistedBase = toScaledBig(((m as SigilMetadataWithOptionals).branchBasePhi ?? ""));
    const baseScaled =
      persistedBase > 0n
        ? persistedBase
        : (pivotIdx >= 0
            ? exhalePhiFromTransferScaled(trs[pivotIdx])
            : toScaledBig(((initialGlyph?.value ?? 0) as number).toString()));

    const prevSpentScaled = toScaledBig(((m as SigilMetadataWithOptionals).branchSpentPhi ?? "0"));

    let currentWindowSpent = 0n;
    try {
      for (let i = Math.max(0, pivotIdx + 1); i < trs.length; i++) {
        currentWindowSpent += exhalePhiFromTransferScaled(trs[i]);
      }
    } catch (err) {
      logError("send.sumExhaledAfterPivot", err);
    }

    const spentSoFar = prevSpentScaled + currentWindowSpent;
    const remainingNowScaled = baseScaled > spentSoFar ? baseScaled - spentSoFar : 0n;

    const reqScaled = toScaledBig(validPhi || "0");
    if (!hasPhi || reqScaled <= 0n) {
      setError("Enter a Φ amount greater than zero.");
      return;
    }
    if (reqScaled > remainingNowScaled) {
      setError(
        `Exhale exceeds remaining Φ — requested Φ ${fromScaledBigFixed(reqScaled, 4)} but only Φ ${fromScaledBigFixed(
          remainingNowScaled,
          4
        )} remains on this glyph.`
      );
      return;
    }
    /* ───────────────────────────────────────────── */

    const cleanUsd = Number.isFinite(usdNum) ? Math.max(0, usdNum) : 0;

    if (hasPhi) {
      const body = {
        kind: "exhale",
        unit: amountMode, // "PHI" or "USD" (what the user chose)
        amountPhi: validPhi, // exact decimal string (no rounding)
        amountUsd: cleanUsd.toFixed(2), // user-friendly snapshot
        usdPerPhi: headerQuote?.usdPerPhi || 0,
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

    // Fallback to any attached payload if no amount provided
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

    /* v14 hardened + optional ZK SEND */
    try {
      if (me) {
        (updated as SigilMetadataWithOptionals).creatorPublicKey ??= me.spkiB64u;
        const indexV14 = updated.hardenedTransfers?.length ?? 0;
        const prevHeadV14 = await expectedPrevHeadRootV14(updated, indexV14);
        const nonce = updated.transferNonce!;
        const transferLeafHashSend = await hashTransferSenderSide(transfer);

        const { buildSendMessageV14, hashAny } = await import("./sigilUtils");
        const msg = buildSendMessageV14(updated, {
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

        if ((window as Window).SIGIL_ZK?.provideSendProof) {
          try {
            const proofObj = await (window as Window).SIGIL_ZK!.provideSendProof!({
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
              const vkey =
                proofObj.vkey ??
                (updated as SigilMetadataWithOptionals).zkVerifyingKey ??
                (window as Window).SIGIL_ZK_VKEY;
              const vkeyHash = vkey ? await hashAny(vkey) : undefined;
              hardened.zkSend = {
                scheme: "groth16",
                curve: "BLS12-381",
                publicHash,
                proofHash,
                vkeyHash,
              };
            }
          } catch (err) {
            logError("provideSendProof", err);
          }
        }

        updated.hardenedTransfers = [...(updated.hardenedTransfers ?? []), hardened];
      }
    } catch (err) {
      logError("send.hardenedBuild", err);
    }

    const durl = await embedMetadata(svgURL, updated);
    const sigilPulse = updated.pulse ?? 0;
    download(durl, `${pulseFilename("sigil_send", sigilPulse, nowPulse)}.svg`);

    // shard if needed
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
      setPhiInput("");
      setUsdInput("");
      await shareTransferLink(rolled2);
      return;
    }

    const updated2 = await refreshHeadWindow(updated);
    setMeta(updated2);
    setRawMeta(JSON.stringify(updated2, null, 2));
    setUiState("readyReceive");
    setError(null);
    setPhiInput("");
    setUsdInput("");

    await shareTransferLink(updated2);
  };

  /* Receive */
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

    try {
      if (me && (updated.hardenedTransfers?.length ?? 0) > 0) {
        const hLast = updated.hardenedTransfers![updated.hardenedTransfers!.length - 1];
        if (!hLast.receiverSig) {
          (updated as SigilMetadataWithOptionals).creatorPublicKey ??= me.spkiB64u;
          const transferLeafHashReceive = await hashTransfer(updatedLast);
          const { buildReceiveMessageV14, hashAny } = await import("./sigilUtils");
          const msgR = buildReceiveMessageV14({
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

          if ((window as Window).SIGIL_ZK?.provideReceiveProof) {
            try {
              const proofObj = await (window as Window).SIGIL_ZK!.provideReceiveProof!({
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
                const vkey =
                  proofObj.vkey ??
                  (updated as SigilMetadataWithOptionals).zkVerifyingKey ??
                  (window as Window).SIGIL_ZK_VKEY;
                const vkeyHash = vkey ? await hashAny(vkey) : undefined;
                newHLast.zkReceive = {
                  scheme: "groth16",
                  curve: "BLS12-381",
                  publicHash,
                  proofHash,
                  vkeyHash,
                };
              }
            } catch (err) {
              logError("provideReceiveProof", err);
            }
          }

          updated.hardenedTransfers = [...updated.hardenedTransfers!.slice(0, -1), newHLast];
        }
      }
    } catch (err) {
      logError("receive.hardenedSeal", err);
    }

    if (svgURL) {
      const durl = await embedMetadata(svgURL, updated);
      const sigilPulse = updated.pulse ?? 0;
      download(durl, `${pulseFilename("sigil_receive", sigilPulse, nowPulse)}.svg`);
    }

    const updated2 = await refreshHeadWindow(updated);
    setMeta(updated2);
    setRawMeta(JSON.stringify(updated2, null, 2));
    setUiState("complete");
    setError(null);

    if (updatedLast.payload) {
      const pmime = updatedLast.payload.mime || "";
      if (!pmime.startsWith("application/vnd.kairos-exhale")) {
        try {
          const bin = Uint8Array.from(atob(updatedLast.payload.encoded), (c) => c.charCodeAt(0));
          const blobURL = URL.createObjectURL(new Blob([bin], { type: updatedLast.payload.mime }));
          download(blobURL, updatedLast.payload.name);
        } catch (err) {
          logError("receive.downloadPayload", err);
        }
      }
    }
  };

  /* Manual segment seal */
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

      {/* ───── Verifier Modal (mobile-first full-screen) ───── */}
      <dialog
        ref={dlgRef}
        className="glass-modal fullscreen"
        id="verifier-dialog"
        data-open="false"
        aria-label="Kai-Sigil Verifier Modal"
        style={{ width: "100vw", maxWidth: "100vw", height: "100dvh", maxHeight: "100dvh", margin: 0, padding: 0, overflow: "hidden" }}
      >
        <div className="modal-viewport" style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", maxWidth: "100vw", overflow: "hidden" }}>
          {/* Close on RIGHT, status on the left */}
          <div className="modal-topbar" style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center" }}>
            <div className="status-strip" aria-live="polite" style={{ overflowX: "auto", whiteSpace: "nowrap" }}>{statusChips()}</div>
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

                  {/* Φ + USD live row */}
                  <div className="value-strip" aria-live="polite">
                    <div className={`value-chip phi ${headerTrend}${headerFlash ? " flash" : ""}`} data-trend={headerTrend} title="Current Φ valuation">
                      <span className="amount" aria-label="Phi value">
                        <span className="sym">Φ</span>
                        {headerPhi != null ? headerPhi.toString() : "0"}
                      </span>
                    </div>
                    <div className={`value-chip usd ${headerTrend}${headerFlash ? " flash" : ""}`} data-trend={headerTrend} title="Indicative USD (issuance model)">
                      <span className="amount" aria-label="USD value">
                        <span className="sym">$</span>
                        {fmtUsdNoSym(headerUsd)}
                      </span>
                    </div>
                  </div>

                  <div className="header-keys" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {meta.kaiSignature ? (
                      <span className="field">Σ <code>{meta.kaiSignature.slice(0, 16)}…</code></span>
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
                <button role="tab" aria-selected={tab === "summary"} className={tab === "summary" ? "active" : ""} onClick={() => setTab("summary")}>Summary</button>
                <button role="tab" aria-selected={tab === "lineage"} className={tab === "lineage" ? "active" : ""} onClick={() => setTab("lineage")}>Lineage</button>
                <button role="tab" aria-selected={tab === "data"} className={tab === "data" ? "active" : ""} onClick={() => setTab("data")}>Data</button>
                <button className="secondary" onClick={openValuation} disabled={!meta}>Φ Value</button>
                <button className="secondary" onClick={openNote} disabled={!svgURL}>Note</button>
              </nav>

              {/* Body */}
              <section className="modal-body" role="tabpanel" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", overflowX: "hidden", paddingBottom: 80 }}>
                {tab === "summary" && (
                  <div className="summary-grid">
                    <div className="kv">
                      <span className="k">Now</span>
                      <span className="v">{pulseNow}</span>
                    </div>
                    <div className="kv">
                      <span className="k">frequency (Hz)</span>
                      <span className="v" style={{ marginLeft: "4rem" }}>{meta.frequencyHz ?? "—"}</span>
                    </div>
                    <div className="kv">
                      <span className="k">Spiral</span>
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
                    {(meta as SigilMetadataWithOptionals).transfersWindowRoot && (
                      <div className="kv wide">
                        <span className="k">Head Breath Root</span>
                        <span className="v mono" style={{ overflowWrap: "anywhere" }}>{(meta as SigilMetadataWithOptionals).transfersWindowRoot}</span>
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
                          {contentSigMatches === true && <span className="chip ok">match</span>}
                          {contentSigMatches === false && <span className="chip err">mismatch</span>}
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
                          {phiKeyExpected && (phiKeyMatches ? <span className="chip ok">match</span> : <span className="chip err">mismatch</span>)}
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

                          // Decode Exhale payload to show Φ + USD snapshot
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
                              const raw = base64DecodeUtf8(t.payload.encoded);
                              const obj = JSON.parse(raw);
                              if (obj?.kind === "exhale") {
                                exhaleInfo = {
                                  unit: obj.unit,
                                  amountPhi: typeof obj.amountPhi === "string" ? obj.amountPhi : undefined,
                                  amountUsd: typeof obj.amountUsd === "string" ? obj.amountUsd : undefined,
                                  usdPerPhi: typeof obj.usdPerPhi === "number" ? obj.usdPerPhi : undefined,
                                };
                              }
                            }
                          } catch (err) {
                            logError("lineage.decodeExhalePayload", err);
                          }

                          // Display helpers for lineage row (always show both Φ and USD)
                          let lineagePhi = "";
                          let lineageUsd = "";
                          try {
                            if (exhaleInfo?.amountPhi) {
                              lineagePhi = fmtPhiFixed4(exhaleInfo.amountPhi);
                              if (typeof exhaleInfo.amountUsd === "string" && exhaleInfo.amountUsd) {
                                // use stored snapshot if present
                                lineageUsd = exhaleInfo.amountUsd;
                              } else if (typeof exhaleInfo.usdPerPhi === "number" && Number.isFinite(exhaleInfo.usdPerPhi)) {
                                const phiNum = Number(exhaleInfo.amountPhi);
                                const usdVal = Number.isFinite(phiNum) ? phiNum * exhaleInfo.usdPerPhi : 0;
                                lineageUsd = fmtUsdNoSym(usdVal);
                              } else {
                                lineageUsd = "0.00";
                              }
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

                              <div className="row"><span className="k">Sender Σ</span><span className="v mono" style={{ overflowWrap: "anywhere" }}>{t.senderSignature}</span></div>
                              <div className="row"><span className="k">Sender Stamp</span><span className="v mono" style={{ overflowWrap: "anywhere" }}>{t.senderStamp}</span></div>
                              <div className="row"><span className="k">Sender Pulse</span><span className="v">{t.senderKaiPulse}</span></div>

                              {/* Amount snapshot at exhale time — always Φ (4dp) and USD (2dp) */}
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
                      <p className="empty">No resonance yet — ready to exhale from Sigil-Glyph.</p>
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
                {error && <p className="status error" style={{ overflowWrap: "anywhere" }}>{error}</p>}

                <div className="footer-actions" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {uiState === "unsigned" && (
                    <button className="secondary" onClick={sealUnsigned}>Seal content (Σ + Φ)</button>
                  )}

                  {(uiState === "readySend" || uiState === "verified") && (
                    <>
                      {/* Attach (icon only) */}
                      <button
                        className="secondary"
                        onClick={() => fileInput.current?.click()}
                        aria-label="Attach a file"
                        title="Attach a file"
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, padding: 0 }}
                      >
                        <Svg path="paperclip" label="Attach" />
                      </button>
                      <input ref={fileInput} type="file" hidden onChange={handleAttach} />

                      {/* Amount switcher + input */}
                      <div className="send-amount" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {/* Segmented toggle */}
                        <div
                          role="tablist"
                          aria-label="Amount unit"
                          className="seg"
                          style={{
                            display: "inline-grid",
                            gridTemplateColumns: "1fr 1fr",
                            borderRadius: 999,
                            border: "1px solid var(--border, rgba(255,255,255,.18))",
                            overflow: "hidden",
                          }}
                        >
                          <button
                            role="tab"
                            aria-selected={amountMode === "USD"}
                            className={amountMode === "USD" ? "active" : ""}
                            onClick={() => setAmountMode("USD")}
                            style={{ padding: "6px 10px", fontSize: 12 }}
                            title="Enter in dollars"
                          >
                            $
                          </button>
                          <button
                            role="tab"
                            aria-selected={amountMode === "PHI"}
                            className={amountMode === "PHI" ? "active" : ""}
                            onClick={() => setAmountMode("PHI")}
                            style={{ padding: "6px 10px", fontSize: 12 }}
                            title="Enter in Φ"
                          >
                            Φ
                          </button>
                        </div>

                        {/* Amount input */}
                        <input
                          className="phi-amount"
                          inputMode="decimal"
                          aria-label={amountMode === "USD" ? "Dollar amount to exhale" : "Phi amount to exhale"}
                          placeholder={amountMode === "USD" ? "$" : "Φ"}
                          value={amountMode === "USD" ? usdInput : phiInput}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (/^\d*\.?\d*$/.test(v)) {
                              if (amountMode === "USD") setUsdInput(v);
                              else setPhiInput(fmtPhiCompact(v)); // ← use fmtPhiCompact while typing
                            }
                          }}
                          style={{
                            width: 150,
                            height: 36,
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: "1px solid var(--border, rgba(255,255,255,.18))",
                            background: "var(--glass, rgba(255,255,255,.06))",
                            color: "inherit",
                          }}
                        />

                        {/* Live conversion readout */}
                        <div
                          className="convert-readout"
                          aria-live="polite"
                          style={{ fontSize: 12, opacity: 0.9, minWidth: 90, textAlign: "left" }}
                          title={amountMode === "USD" ? "Converted to Φ at current model" : "Converted to USD at current model"}
                        >
                          {conv.displayRight}
                        </div>
                      </div>

                      {/* Exhale (icon only) */}
                      <button
                        className="primary"
                        onClick={send}
                        aria-label="Exhale (send)"
                        title={canShare ? "Exhale (seal & share)" : "Exhale (seal & copy link)"}
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, padding: 0 }}
                      >
                        <Svg path="send" label="Exhale" />
                      </button>
                    </>
                  )}

                  {uiState === "readyReceive" && (
                    <button
                      className="primary"
                      onClick={receive}
                      aria-label="Inhale (receive)"
                      title="Inhale"
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, padding: 0 }}
                    >
                      <Svg path="recv" label="Inhale" />
                    </button>
                  )}

                  {(meta?.transfers?.length ?? 0) > 0 && (
                    <button
                      className="secondary"
                      onClick={sealSegmentNow}
                      aria-label="Segment head window"
                      title="Roll current head-window into a segment"
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, padding: 0 }}
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

      {/* 🔗 Post-seal modal */}
      <SealMomentModal open={sealOpen} url={sealUrl} hash={sealHash} onClose={() => setSealOpen(false)} onDownloadZip={downloadZip} />

      {/* Φ Valuation modal */}
      {meta && (
        <ValuationModal
          open={valuationOpen}
          onClose={closeValuation}
          meta={metaLite ?? (meta as unknown as SigilMetadataLite)}
          nowPulse={pulseNow}
          initialGlyph={initialGlyph ?? undefined}
          onAttach={uiState === "verified" ? onAttachValuation : undefined}
        />
      )}

      {/* 🖨️ Note Exhaler */}
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

      {/* 🌲 Explorer dialog */}
      <dialog
        ref={explorerDlgRef}
        className="explorer-dialog"
        id="explorer-dialog"
        aria-label="Sigil Explorer"
        data-open={explorerOpen ? "true" : "false"}
        style={{ width: "100vw", maxWidth: "100vw", height: "100dvh", maxHeight: "100dvh", margin: 0, padding: 0, overflow: "hidden" }}
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

export default VerifierStamper;
