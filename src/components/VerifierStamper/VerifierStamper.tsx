/* ────────────────────────────────────────────────────────────────
   VerifierStamper.tsx · Divine Sovereign Transfer Gate (mobile-first)
   v14.3 — Sovereign hardening+++ (ECDSA + optional ZK bind)
   (modularized, unchanged behavior)
────────────────────────────────────────────────────────────────── */

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import "./VerifierStamper.css";

/* ── Explorer + Seal modals ─────────────────────────────────── */
import SealMomentModal from "../SealMomentModal";
import SigilExplorer from "../SigilExplorer";
import ValuationModal from "../ValuationModal";
import { buildValueSeal, type SigilMetadataLite, type ValueSeal } from "../../utils/valuation";

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
  SigilPayload, // ← add explicit type import
} from "./types";
import { normalizeChakraDay } from "./types";
import { sha256Hex, phiFromPublicKey } from "./crypto";
import { loadOrCreateKeypair, signB64u, type Keypair } from "./keys"; // ← remove unused verifySig
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
  // ← remove unused headCanonicalHashV14
} from "./sigilUtils";
import { buildMerkleRoot, merkleProof, verifyProof } from "./merkle";
import { sealCurrentWindowIntoSegment } from "./segments";
import { verifyHistorical } from "./verifyHistorical";
import { verifyZkOnHead } from "./zk";

/* Window augmentation to avoid any-casts */
declare global {
  interface Window {
    SIGIL_ZK_VKEY?: unknown;
    SIGIL_ZK?: {
      provideSendProof?: (ctx: {
        meta: SigilMetadata;
        leafHash: string; // sender-side leaf hash
        previousHeadRoot: string;
        nonce: string;
      }) => Promise<{ proof: unknown; publicSignals: unknown; vkey?: unknown } | null>;
      provideReceiveProof?: (ctx: {
        meta: SigilMetadata;
        leafHash: string; // full leaf hash
        previousHeadRoot: string;
        linkSig: string; // senderSig from hardened entry
      }) => Promise<{ proof: unknown; publicSignals: unknown; vkey?: unknown } | null>;
    };
  }
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
    u.searchParams.set("h", historyParam);
  }
  return u.toString();
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

  // FIX: explicit union type with null so setPayload(null) is valid
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

  /* SigilPage-style share builder (opens SealMomentModal & registers with Explorer)
     NOW appends compact history (&h=) built from meta.transfers. */
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

        const msg = (await import("./sigilUtils")).buildSendMessageV14(updated, {
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
              const { hashAny } = await import("./sigilUtils");
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

          const msgR = (await import("./sigilUtils")).buildReceiveMessageV14({
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
                const { hashAny } = await import("./sigilUtils");
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

  /* Revoke object URLs to avoid leaks */
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
    return meta ? (meta as unknown as SigilMetadataLite) : null;
  }, [meta]);

  /* NEW: Seed Valuation with the uploaded glyph so it opens "warm" */
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
          initialGlyph={initialGlyph ?? undefined}
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
