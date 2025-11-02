"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import "./MintCompositeModal.css";
import JSZip from "jszip";
import { XCircle } from "lucide-react";

import DonorsEditor, { type DonorRow } from "./DonorsEditor";
import KaiSigil, { type KaiSigilHandle } from "../KaiSigil";

/* Sovereign time — Kairos only (no Chronos/UTC) */
import {
  getKaiPulseEternalInt,
  getKaiPulseToday,
  getDisplayAlignedCounters,
  getSolarArcName,
  pulsesIntoBeatFromPulse,
} from "../../SovereignSolar";

/* Canonical sigil URLs (compact v2 + lineage + live registry) */
import {
  makeSigilUrl,
  type SigilSharePayload,
  registerSigilUrl,
  extractPayloadFromUrl,
} from "../../utils/sigilUrl";

/* Import verifier constants so our embedded <metadata> matches exactly */
import { SIGIL_CTX, SIGIL_TYPE, SEGMENT_SIZE } from "../VerifierStamper/constants";

/* ──────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────── */

export interface MintCompositeModalProps {
  isOpen: boolean;
  onClose: () => void;

  /* Donor editor state (you already own this in parent) */
  donors: DonorRow[];
  balancePhi: number;
  balanceForMintPhi: number;
  setBalanceForMintPhi: (n: number) => void;
  addDonor: () => void;
  removeDonor: (idx: number) => void;
  updateDonor: (idx: number, patch: Partial<DonorRow>) => void;
  totalDonorAmount: number;

  /* Optional identity for the ΦGlyph (passed to <KaiSigil/>) */
  userPhiKey?: string;
  kaiSignature?: string;
  creatorPublicKey?: string;

  /* Optional: choose chakra for the ΦGlyph (defaults Throat) */
  chakraDay?:
    | "Root"
    | "Sacral"
    | "Solar Plexus"
    | "Heart"
    | "Throat"
    | "Third Eye"
    | "Crown";

  /* Callback when minted (returns the manifest contents) */
  onMinted?: (manifest: CompositeManifest) => void;
}

type HashHex = string;

interface WalletDonor {
  canonicalHash: string;
  url?: string;            // original user-entered URL (if any)
  amountPhi: number;       // exact Φ for this donor
  originUrl?: string;      // inferred lineage origin (if URL had compact payload)
}

interface CompositeWallet {
  donors: ReadonlyArray<WalletDonor>;
  poolAllocationPhi: number;
  totalDonorPhi: number;
  totalPhi: number; // donors + pool
  createdAtPulseEternal: number; // Kairos pulse when composite minted
}

/** Rich human+machine Kairos stamp (parity with SendSigilModal) */
type ChakraDay =
  | "Root"
  | "Sacral"
  | "Solar Plexus"
  | "Heart"
  | "Throat"
  | "Third Eye"
  | "Crown";

interface KairosStamp {
  version: 1;
  eternalPulse: number; // absolute pulse at mint
  sigilPulse: number;   // same as eternalPulse for composite seeds
  dayName: string;
  dayIndex1: number;
  dayInMonth1: number;
  dayInYear1: number;
  monthIndex1: number;
  monthName: string;
  weekIndex1: number;
  beatIndex: number;       // 0..35 (today-mapped)
  stepIndex: number;       // 0..43 (today-mapped)
  pulsesIntoBeat: number;  // 0..483 (absolute Kairos mapping)
  kaiPulseToday: number;   // whole pulses in today’s φ-day window
  percentIntoStep: number; // 0..100
  arcName: string;         // one of the 6 solar arcs
  chakraDay: ChakraDay;    // carried seed context
  text: string;            // human string (deterministic)
}

interface CompositeProvenance {
  version: 1;
  mintedAtPulseEternal: number; // Kairos
  pulsesIntoBeat: number;       // 0..483 at mint
  kaiPulseToday: number;        // integer pulses in today’s window
  beatIndex: number;            // 0..35 (UI mapping)
  stepIndex: number;            // 0..43 (UI mapping)
  dayName: string;
  monthName: string;
  dayInMonth1: number;
  dayInYear1: number;
  monthIndex1: number;
  weekIndex1: number;
}

interface CompositeMetaForVerifier {
  "@context": string;
  type: string;
  // CORE seed used by verifier:
  pulse: number;       // Kairos
  beat: number;        // today grid
  stepIndex: number;   // today grid
  chakraDay: MintCompositeModalProps["chakraDay"];
  // Extras we preserve:
  stepsPerBeat: number;
  kaiSignature?: string;
  userPhiKey?: string;
  creatorPublicKey?: string;
  kaiPulse: number; // Eternal pulse at mint (same as pulse here)
  canonicalHash?: string; // filled after <KaiSigil onReady>
  transferNonce: string;
  segmentSize: number;

  // Composite specifics:
  composite: {
    kind: "phi.sigil.composite";
    wallet: CompositeWallet;
  };

  // Moment stamp (parity with SendSigilModal)
  kairosStamp: KairosStamp;

  // URLs:
  canonicalUrl?: string; // canonical share URL (non-rotated)
  shareUrl?: string;     // same as canonical for composites

  // Renderer-provided metadata (if present)
  embeddedMeta?: unknown;
}

export interface DonorManifestEntry {
  canonicalHash: string;
  amountPhi: number;
  url?: string;
  originUrl?: string;
}

export interface CompositeManifest {
  version: 1;
  kind: "phi.sigil.composite";
  canonicalHash: string;
  canonicalUrl: string;
  shareUrl: string;
  meta: CompositeMetaForVerifier;

  /** Rich summary, easy to read outside SVG */
  donors: DonorManifestEntry[];
  totals: {
    totalDonorPhi: number;
    poolAllocationPhi: number;
    totalPhi: number;
  };
  provenance: CompositeProvenance;
}

/* ──────────────────────────────────────────────────────────────
 * Helpers (no `any`, no empty catches)
 * ────────────────────────────────────────────────────────────── */

const bytesToHex = (u8: Uint8Array) =>
  Array.from(u8).map((b) => b.toString(16).padStart(2, "0")).join("");

/** Ensure SubtleCrypto always receives a real ArrayBuffer (not SharedArrayBuffer / generics). */
function abFromU8(view: Uint8Array): ArrayBuffer {
  const buf = view.buffer;
  if (buf instanceof ArrayBuffer && view.byteOffset === 0 && view.byteLength === buf.byteLength) {
    return buf;
  }
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return copy.buffer;
}

async function sha256Hex(msg: string | Uint8Array): Promise<string> {
  const view = typeof msg === "string" ? new TextEncoder().encode(msg) : msg;
  const buf = await crypto.subtle.digest("SHA-256", abFromU8(view));
  return bytesToHex(new Uint8Array(buf));
}

/** Centre-pixel “live” signature (parity with verification) */
async function centrePixelSigFromPngBlob(
  png: Blob,
  pulseForSeal: number
): Promise<{ sig: string; rgb: [number, number, number] }> {
  const url = URL.createObjectURL(png);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();

    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d");
    if (!g) throw new Error("Canvas 2D context unavailable");
    g.drawImage(img, 0, 0);
    const { data } = g.getImageData(
      Math.floor(img.width / 2),
      Math.floor(img.height / 2),
      1,
      1
    );
    const rgb: [number, number, number] = [data[0], data[1], data[2]];
    const sig = (await sha256Hex(`${pulseForSeal}-2:3-${rgb.join(",")}`)).slice(
      0,
      32
    );
    return { sig, rgb };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Base64url nonce for verifier aux */
function genNonce(bytes = 9): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  const b64 = btoa(String.fromCharCode(...arr));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Deterministic filename: prefix_<sigilPulse>_<eventPulse> */
function pulseFilename(prefix: string, sigilPulse: number, eventPulse: number) {
  return `${prefix}_${sigilPulse}_${eventPulse}`;
}

/** Build a deterministic Kairos stamp (no Chronos/UTC anywhere) */
function buildKairosStamp(
  nowPulse: number,
  sigilPulse: number,
  chakraDay: ChakraDay
): KairosStamp {
  const now = new Date(); // engine input only
  const { kaiPulseToday, beatIndex, stepIndex, percentIntoStep } = getKaiPulseToday(now);
  const { display } = getDisplayAlignedCounters(now);
  const arcName = getSolarArcName(now);
  const pib = pulsesIntoBeatFromPulse(nowPulse);

  const text =
    `Kairos • ${display.dayName} (D${display.dayIndex1}/6) • ` +
    `Month ${display.monthIndex1} ${display.monthName} • ` +
    `Day ${display.dayInMonth1}/42 • YearDay ${display.dayInYear1}/336 • ` +
    `Beat ${beatIndex + 1}/36 • Step ${stepIndex + 1}/44 ` +
    `• ΦPulse ${nowPulse} • Arc ${arcName} • Chakra ${chakraDay}`;

  return {
    version: 1,
    eternalPulse: nowPulse,
    sigilPulse,
    dayName: display.dayName,
    dayIndex1: display.dayIndex1,
    dayInMonth1: display.dayInMonth1,
    dayInYear1: display.dayInYear1,
    monthIndex1: display.monthIndex1,
    monthName: display.monthName,
    weekIndex1: display.weekIndex1,
    beatIndex,
    stepIndex,
    pulsesIntoBeat: pib,
    kaiPulseToday,
    percentIntoStep,
    arcName,
    chakraDay,
    text,
  };
}

/** Primary + secondary metadata injection into SVG */
async function writeCompositeMetadataIntoSvg(
  svgBlob: Blob,
  main: CompositeMetaForVerifier,
  walletBlock: CompositeWallet
): Promise<Blob> {
  const raw = await svgBlob.text();

  const jsonMain = JSON.stringify(main, null, 2).replace(/]]>/g, "]]]]><![CDATA[>");
  const jsonWallet = JSON.stringify({ wallet: walletBlock }, null, 2).replace(
    /]]>/g,
    "]]]]><![CDATA[>"
  );

  const mainTag = `<metadata id="sigil-meta" data-type="application/json"><![CDATA[${jsonMain}]]></metadata>`;
  const walletTag = `<metadata id="phi-wallet" data-type="application/json"><![CDATA[${jsonWallet}]]></metadata>`;

  // Replace first <metadata>…</metadata> with our MAIN meta; if none, insert after <svg …>
  let patched = raw;
  if (/<metadata[\s>]/i.test(patched)) {
    patched = patched.replace(/<metadata[\s\S]*?<\/metadata>/i, mainTag);
  } else {
    patched = patched.replace(/<svg(\s[^>]*)?>/i, (m) => `${m}${mainTag}`);
  }
  // Append wallet block just before </svg>
  patched = patched.replace(/<\/svg>\s*$/i, `${walletTag}</svg>`);
  return new Blob([patched], { type: "image/svg+xml" });
}

/* ──────────────────────────────────────────────────────────────
 * Component
 * ────────────────────────────────────────────────────────────── */

export default function MintCompositeModal({
  isOpen,
  onClose,

  donors,
  balancePhi,
  balanceForMintPhi,
  setBalanceForMintPhi,
  addDonor,
  removeDonor,
  updateDonor,
  totalDonorAmount,

  userPhiKey,
  kaiSignature,
  creatorPublicKey,
  chakraDay = "Throat",

  onMinted,
}: MintCompositeModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sigilRef = useRef<KaiSigilHandle>(null);

  const [readyHash, setReadyHash] = useState<HashHex | null>(null);
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const [readyMetaJson, setReadyMetaJson] = useState<string | null>(null);

  // current Eternal seed for the ΦGlyph
  const nowPulse = useMemo(() => getKaiPulseEternalInt(), []);
  const nowGrid = useMemo(() => getKaiPulseToday(new Date()), []);
  const stepPct = useMemo(
    () => Math.min(Math.max(nowGrid.stepIndex / 44, 0), 1),
    [nowGrid.stepIndex]
  );

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setBusy(false);
    }
  }, [isOpen]);

  const donorsNormalized: ReadonlyArray<WalletDonor> = useMemo(() => {
    // only include donors with a canonical hash & positive amount
    const list = donors
      .map((d) => ({
        canonicalHash: (d.canonicalHash || "").toLowerCase(),
        url: d.url || undefined,
        amountPhi: Math.max(0, Number.isFinite(d.amount) ? d.amount : 0),
      }))
      .filter((d) => d.canonicalHash && d.amountPhi > 0);

    // enrich with inferred originUrl, if we can decode payloads
    return list.map((d) => {
      let originUrl: string | undefined;
      try {
        if (d.url) {
          const p = extractPayloadFromUrl(d.url);
          originUrl = p?.originUrl;
        }
      } catch {
        originUrl = undefined;
      }
      return { ...d, originUrl };
    });
  }, [donors]);

  const totals = useMemo(() => {
    const totalDonorPhi = donorsNormalized.reduce((acc, d) => acc + d.amountPhi, 0);
    const pool = Math.max(0, Number.isFinite(balanceForMintPhi) ? balanceForMintPhi : 0);
    return {
      totalDonorPhi,
      poolAllocationPhi: +pool.toFixed(6),
      totalPhi: Number((totalDonorPhi + pool).toFixed(6)),
    };
  }, [donorsNormalized, balanceForMintPhi]);

  const handleMintComposite = useCallback(async () => {
    setError(null);

    // ensure we actually have value to embed (donors or pool)
    const hasAny = donorsNormalized.length > 0 || totals.poolAllocationPhi > 0;
    if (!hasAny) {
      setError("Add at least one donor or a pool allocation.");
      return;
    }

    try {
      setBusy(true);

      // Render art
      const ref = sigilRef.current;
      if (!ref) throw new Error("Renderer unavailable");
      const svgBlob = await ref.exportBlob("image/svg+xml");
      const pngBlob = await ref.exportBlob("image/png", 3);

      // Live centre-pixel signature (parity w/ verifier)
      const { sig: liveSig, rgb } = await centrePixelSigFromPngBlob(pngBlob, nowPulse);
      const sealStamp = await sha256Hex(`${liveSig}-${nowGrid.kaiPulseToday}-${nowPulse}`);

      // Human/machine display + provenance (Kairos only)
      const { display } = getDisplayAlignedCounters(new Date());
      const pib = pulsesIntoBeatFromPulse(nowPulse);

      const provenance: CompositeProvenance = {
        version: 1,
        mintedAtPulseEternal: nowPulse,
        pulsesIntoBeat: pib,
        kaiPulseToday: nowGrid.kaiPulseToday,
        beatIndex: nowGrid.beatIndex,
        stepIndex: nowGrid.stepIndex,
        dayName: display.dayName,
        monthName: display.monthName,
        dayInMonth1: display.dayInMonth1,
        dayInYear1: display.dayInYear1,
        monthIndex1: display.monthIndex1,
        weekIndex1: display.weekIndex1,
      };

      // Wallet block (deterministic)
      const wallet: CompositeWallet = {
        donors: donorsNormalized,
        poolAllocationPhi: totals.poolAllocationPhi,
        totalDonorPhi: +totals.totalDonorPhi.toFixed(6),
        totalPhi: +totals.totalPhi.toFixed(6),
        createdAtPulseEternal: nowPulse,
      };

      // Canonical URL (non-rotated; Temple-Glyphs don’t carry claim tokens)
      if (!readyHash) throw new Error("Sigil hash not ready");
      const basePayload: SigilSharePayload = {
        pulse: nowPulse,
        beat: nowGrid.beatIndex,
        stepIndex: nowGrid.stepIndex,
        chakraDay,
        stepsPerBeat: 44,
        kaiSignature: kaiSignature,
        userPhiKey: userPhiKey,
      };
      const canonicalUrl =
        readyUrl ??
        makeSigilUrl(readyHash, basePayload, {
          origin: typeof window !== "undefined" ? window.location.origin : "",
          autoInferParent: true,
        });

      // Preserve renderer metadata if present
      const embeddedMeta =
        readyMetaJson && readyMetaJson.trim().length > 0
          ? (JSON.parse(readyMetaJson) as unknown)
          : null;

      // Rich Kairos stamp (same shape as SendSigilModal)
      const kairosStamp = buildKairosStamp(nowPulse, nowPulse, chakraDay);

      // Verifier-native metadata (PRIMARY block)
      const meta: CompositeMetaForVerifier = {
        "@context": SIGIL_CTX,
        type: SIGIL_TYPE,
        // CORE
        pulse: nowPulse,
        beat: nowGrid.beatIndex,
        stepIndex: nowGrid.stepIndex,
        chakraDay,
        // Extras
        stepsPerBeat: 44,
        kaiSignature: kaiSignature || undefined,
        userPhiKey: userPhiKey || undefined,
        creatorPublicKey: creatorPublicKey || undefined,
        kaiPulse: nowPulse,
        canonicalHash: readyHash,
        transferNonce: genNonce(),
        segmentSize: SEGMENT_SIZE,
        composite: {
          kind: "phi.sigil.composite",
          wallet,
        },
        kairosStamp,
        canonicalUrl,
        shareUrl: canonicalUrl,
        embeddedMeta,
      };

      // Write PRIMARY (verifier) + SECONDARY (wallet) blocks into the SVG
      const enhancedSvg = await writeCompositeMetadataIntoSvg(svgBlob, meta, wallet);

      // Deterministic base filename
      const base = pulseFilename("sigil_phiglyph", nowPulse, nowPulse);

      // Manifest (include rich donors + totals + provenance)
      const manifest: CompositeManifest = {
        version: 1,
        kind: "phi.sigil.composite",
        canonicalHash: readyHash,
        canonicalUrl,
        shareUrl: canonicalUrl,
        meta,
        donors: donorsNormalized.map((d) => ({
          canonicalHash: d.canonicalHash,
          amountPhi: +d.amountPhi.toFixed(6),
          url: d.url,
          originUrl: d.originUrl,
        })),
        totals: {
          totalDonorPhi: +totals.totalDonorPhi.toFixed(6),
          poolAllocationPhi: totals.poolAllocationPhi,
          totalPhi: +totals.totalPhi.toFixed(6),
        },
        provenance,
      };

      // Include a small “forensics” file with seal stamp + rgb
      const forensic = {
        version: 1,
        centrePixelSig: liveSig,
        sealStamp,
        centreRgb: rgb,
        kairosStamp,
        provenance,
      };

      // Bundle ZIP (SVG + PNG + manifest.json + provenance)
      const zip = new JSZip();
      zip.file(`${base}.svg`, enhancedSvg);
      zip.file(`${base}.png`, pngBlob);
      zip.file(`${base}.json`, JSON.stringify(manifest, null, 2));
      zip.file(`${base}_provenance.json`, JSON.stringify(forensic, null, 2));
      const zipBlob = await zip.generateAsync({ type: "blob" });

      // Download ZIP immediately
      const a = document.createElement("a");
      const url = URL.createObjectURL(zipBlob);
      a.href = url;
      a.download = `${base}.zip`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);

      // Register canonical URL globally (live bus + storage)
      registerSigilUrl(canonicalUrl);

      onMinted?.(manifest);
      setBusy(false);
      onClose();
    } catch (e: unknown) {
      setBusy(false);
      setError(
        "Failed to exhale Temple-Glyph. " +
          (e instanceof Error ? e.message : String(e))
      );
    }
  }, [
    donorsNormalized,
    totals.poolAllocationPhi,
    totals.totalDonorPhi,
    totals.totalPhi,
    nowPulse,
    nowGrid.beatIndex,
    nowGrid.kaiPulseToday,
    nowGrid.stepIndex,
    chakraDay,
    readyHash,
    readyUrl,
    readyMetaJson,
    kaiSignature,
    userPhiKey,
    creatorPublicKey,
    onMinted,
    onClose,
  ]);

  // ⬇️ Return AFTER all hooks are declared to satisfy react-hooks/rules-of-hooks
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="presentation">
      <dialog className="send-sigil-modal" open aria-label="Mint Composite ΦGlyph">
        <div className="modal-viewport">
          <div className="modal-topbar">
            <h2 className="modal-title">Exhale Temple-Glyph</h2>
            <button className="close-btn" onClick={onClose} aria-label="Close">
              <XCircle size={22} />
            </button>
          </div>

          {/* Hidden KaiSigil to mint art+metadata (QR-free) */}
          <div
            aria-hidden
            style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
          >
            <KaiSigil
              ref={sigilRef}
              pulse={nowPulse}
              beat={nowGrid.beatIndex}
              stepPct={stepPct}
              chakraDay={chakraDay}
              userPhiKey={userPhiKey}
              kaiSignature={kaiSignature}
              creatorPublicKey={creatorPublicKey}
              origin={
                typeof window !== "undefined" ? window.location.origin : undefined
              }
              animate={false}
              quality="high"
              showZKBadge={false}
              onReady={({ hash, url, metadataJson }) => {
                setReadyHash(hash);
                setReadyUrl(url);
                setReadyMetaJson(metadataJson);
              }}
              onError={() => {
                /* keep UI going; mint still works */
              }}
            />
          </div>

          {/* Scrollable body */}
          <div className="modal-body">
            <DonorsEditor
              donors={donors}
              balancePhi={balancePhi}
              balanceForMintPhi={balanceForMintPhi}
              setBalanceForMintPhi={setBalanceForMintPhi}
              addDonor={addDonor}
              removeDonor={removeDonor}
              updateDonor={updateDonor}
              onMintComposite={(e) => {
                e.preventDefault();
                void handleMintComposite();
              }}
              minting={busy}
              totalDonorAmount={totalDonorAmount}
            />

            {error && <div className="error-msg" role="alert">{error}</div>}
          </div>

          {/* Sticky footer */}
          <div className="modal-footer">
            <button
              className="send-btn"
              onClick={() => void handleMintComposite()}
              disabled={busy}
              aria-label="Exhale Temple-Glyph"
              title="Exhale a Temple-Glyph at the current Eternal pulse"
            >
              <span className="ico-exhale" aria-hidden>⟿</span>
              {busy ? "Exhale..." : "Exhale Temple-Glyph"}
            </button>

            <p className="small subtle status-line" aria-live="polite">
              {readyHash ? `canonical: ${readyHash.slice(0, 10)}…` : "canonicalizing…"}
            </p>
          </div>
        </div>
      </dialog>
    </div>
  );
}
