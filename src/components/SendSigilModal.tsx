// src/components/SendSigilModal.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./SendSigilModal.css";
import type { Glyph } from "../glyph/types";
import { sendGlyphFromSource } from "../glyph/glyphUtils";
import { XCircle, SendHorizontal } from "lucide-react";
import JSZip from "jszip";

/* Hidden renderer to mint fresh art + metadata we can export */
import KaiSigil, { type KaiSigilHandle } from "./KaiSigil";

/* Sovereign time — exact Kairos (no Chronos/UTC) */
import {
  getKaiPulseEternalInt,
  getKaiPulseToday,
  getDisplayAlignedCounters,
  getSolarArcName,
  pulsesIntoBeatFromPulse,
} from "../SovereignSolar";

/* Canonical sigil URLs (compact v2 + lineage + live registry) */
import {
  makeSigilUrl,
  type SigilSharePayload,
  registerSigilUrl,
} from "../utils/sigilUrl";

/* Import verifier constants so our embedded <metadata> matches exactly */
import { SIGIL_CTX, SIGIL_TYPE, SEGMENT_SIZE } from "../components/VerifierStamper/constants";

/* ===== Types ===== */
type HashHex = string;

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
  eternalPulse: number; // absolute pulse at exhale
  sigilPulse: number; // seed's canonical pulse
  dayName: string;
  dayIndex1: number;
  dayInMonth1: number;
  dayInYear1: number;
  monthIndex1: number;
  monthName: string;
  weekIndex1: number;
  beatIndex: number; // 0..35 (today-mapped)
  stepIndex: number; // 0..43 (today-mapped)
  pulsesIntoBeat: number; // 0..483 (absolute Kairos mapping)
  kaiPulseToday: number; // whole pulses in today’s φ-day window
  percentIntoStep: number; // 0..100
  arcName: string; // one of the 6 solar arcs
  chakraDay: ChakraDay; // carried seed context
  text: string; // human string (deterministic)
}

interface TransferPayload {
  kind: "phi.transfer";
  version: 1;
  amountPhi: number;
  recipient: string | null;
  message: string | null;

  /** No Chronos/UTC — creation anchored to the Eternal pulse */
  createdAtPulseEternal: number;

  /** The sigil’s canonical pulse (from the seed glyph) */
  sigilPulse: number;

  /** Sender’s actual Eternal pulse at exhale */
  sendPulse: number;

  rgbSeed: [number, number, number];

  /** Canonical hash + rotated share URL for claim/deduction flow */
  canonicalHash: string | null;
  shareUrl: string | null;

  /** Anchor of the source sender (if present) */
  sourcePhiKey: string | null;

  /** Rich Kairos moment stamp (human + machine) */
  kairosStamp: KairosStamp;
}

interface TransferLitePayload {
  name: string;
  mime: string;
  size: number;
  encoded: string; // base64 (no data: prefix)
}

interface SigilTransferLite {
  senderSignature: string;
  senderStamp: string;
  senderKaiPulse: number; // Eternal pulse at send
  receiverSignature?: string;
  receiverStamp?: string;
  receiverKaiPulse?: number;
  payload?: TransferLitePayload;
}

/* ===== Small crypto + helpers (parity with Verifier) ===== */

const bytesToHex = (u8: Uint8Array) =>
  Array.from(u8).map((b) => b.toString(16).padStart(2, "0")).join("");

/**
 * TS 5.x makes TypedArrays generic over the backing buffer (ArrayBufferLike),
 * while SubtleCrypto expects a BufferSource (ArrayBuffer | ArrayBufferView<ArrayBuffer>).
 * To avoid the 'Uint8Array<ArrayBufferLike>' -> 'BufferSource' error, we ensure we pass
 * a real ArrayBuffer (or a Uint8Array backed by one). This helper guarantees ArrayBuffer.
 */
function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const buf = view.buffer;
  // If already an ArrayBuffer and spans exactly the view, reuse it; else copy to a new ArrayBuffer
  if (buf instanceof ArrayBuffer && view.byteOffset === 0 && view.byteLength === buf.byteLength) {
    return buf;
  }
  return view.slice().buffer as ArrayBuffer;
}

async function sha256Hex(msg: string | Uint8Array): Promise<string> {
  const view = typeof msg === "string" ? new TextEncoder().encode(msg) : msg;
  const input: ArrayBuffer = toArrayBuffer(view);
  const buf = await crypto.subtle.digest("SHA-256", input);
  return bytesToHex(new Uint8Array(buf));
}

/** Centre-pixel “live” signature, same formula used by Verifier */
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

/** Base64-url (no padding) for URL params */
function b64url(bytes: Uint8Array): string {
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlJson(obj: unknown): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  return b64url(bytes);
}

/** Classic base64 (no data: prefix) for embedding */
function b64encodeJson(obj: unknown): string {
  const json = JSON.stringify(obj);
  const b64 = btoa(
    encodeURIComponent(json).replace(
      /%([0-9A-F]{2})/g,
      (_: string, h: string) => String.fromCharCode(parseInt(h, 16))
    )
  );
  return b64.replace(/=+$/g, "");
}

/** Deterministic filename like Verifier’s: prefix_<sigilPulse>_<eventPulse> */
function pulseFilename(prefix: string, sigilPulse: number, eventPulse: number) {
  return `${prefix}_${sigilPulse}_${eventPulse}`;
}

/** Append a compact claim token to an existing canonical sigil URL. */
function attachClaimToken(
  baseUrl: string,
  claim: {
    amountPhi: number;
    sendPulse: number;
    senderStamp: string;
    canonicalHash: string | null;
  }
): string {
  try {
    const u = new URL(
      baseUrl,
      typeof window !== "undefined" ? window.location.origin : "http://localhost"
    );
    const compact = {
      k: "phi.transfer.claim",
      v: 1,
      a: claim.amountPhi,
      p: claim.sendPulse,
      s: claim.senderStamp,
      h: claim.canonicalHash,
    };
    // Keep existing params; add non-breaking token (decoder can read ?x=t:<b64url>)
    u.searchParams.set("x", "t:" + b64urlJson(compact));
    return u.toString();
  } catch {
    return baseUrl;
  }
}

/* ===== Narrowing helpers (no `any`) ===== */
type Rec = Record<string, unknown>;
const isObject = (v: unknown): v is Rec =>
  typeof v === "object" && v !== null;

const getNum = (obj: unknown, key: string): number | undefined => {
  if (!isObject(obj)) return undefined;
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
};
const getStr = (obj: unknown, key: string): string | undefined => {
  if (!isObject(obj)) return undefined;
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
};
const getDay = (v: unknown): ChakraDay | undefined => {
  const s = typeof v === "string" ? v : undefined;
  const allowed: ReadonlyArray<ChakraDay> = [
    "Root",
    "Sacral",
    "Solar Plexus",
    "Heart",
    "Throat",
    "Third Eye",
    "Crown",
  ];
  return s && (allowed as readonly string[]).includes(s) ? (s as ChakraDay) : undefined;
};

interface SigilSeed {
  pulse: number;
  beat: number;
  stepsPerBeat: number;
  stepIndex: number;
  chakraDay: ChakraDay;
  userPhiKey?: string;
  kaiSignature?: string;
  creatorPublicKey?: string;
}

/** Safely extract the minimal seed we need from `sourceGlyph` (no `any`). */
function extractSeedFromGlyph(glyph: Glyph): SigilSeed {
  const maybeMeta: unknown =
    isObject(glyph) && "meta" in glyph ? (glyph as Rec).meta : undefined;

  const pulse =
    getNum(maybeMeta, "pulse") ??
    (isObject(glyph) ? getNum(glyph, "pulseCreated") : undefined) ??
    getKaiPulseEternalInt();

  const beat = getNum(maybeMeta, "beat") ?? 0;

  const stepsPerBeat = getNum(maybeMeta, "stepsPerBeat") ?? 44; // default to 44 for canonical grid

  const stepIndex =
    getNum(maybeMeta, "stepIndex") ??
    Math.floor((getNum(maybeMeta, "stepPct") ?? 0.5) * stepsPerBeat);

  const dayFromMeta = getStr(maybeMeta, "chakraDay");
  const dayFromGlyph = isObject(glyph) ? getStr(glyph, "chakraDay") : undefined;
  const chakraDay =
    getDay(dayFromMeta) ?? (dayFromGlyph ? getDay(dayFromGlyph) : undefined) ?? "Root";

  const userPhiKey = getStr(maybeMeta, "userPhiKey");
  const kaiSignature = getStr(maybeMeta, "kaiSignature");
  const creatorPublicKey = getStr(maybeMeta, "creatorPublicKey");

  return {
    pulse,
    beat,
    stepsPerBeat,
    stepIndex,
    chakraDay,
    userPhiKey: userPhiKey || undefined,
    kaiSignature: kaiSignature || undefined,
    creatorPublicKey: creatorPublicKey || undefined,
  };
}

/* Build a deterministic Kairos stamp for human + machine */
function buildKairosStamp(nowPulse: number, sigilPulse: number, chakraDay: ChakraDay): KairosStamp {
  const now = new Date(); // used only as an input to engine; not surfaced
  const { kaiPulseToday, beatIndex, stepIndex, percentIntoStep } = getKaiPulseToday(now);
  const { display } = getDisplayAlignedCounters(now);
  const arcName = getSolarArcName(now);
  const pib = pulsesIntoBeatFromPulse(nowPulse); // absolute Kairos mapping

  const text =
    `Kairos • ${display.dayName} (D${display.dayIndex1}/6) • ` +
    `Month ${display.monthIndex1} ${display.monthName} • ` +
    `Day ${display.dayInMonth1}/42 • YearDay ${display.dayInYear1}/336 • ` +
    `Beat ${beatIndex + 1}/36 • Step ${stepIndex + 1}/44 ` +
    `• ΦPulse ${nowPulse} • Ark ${arcName} • Chakra ${chakraDay}`;

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

/** random, short base64url nonce (deterministic enough for share token) */
function genNonce(bytes = 9): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return b64url(arr);
}

/** Safely write a PRIMARY verifier metadata block (<metadata id="sigil-meta"> …) and
 *  also append a secondary <metadata id="phi-transfer"> with the human share payload.
 *  This ensures the Verifier reads our block first and still preserves the provenance blob.
 */
async function writeVerifierMetadataIntoSvg(
  svgBlob: Blob,
  metaObject: Record<string, unknown>,
  transferBlock: TransferPayload
): Promise<Blob> {
  const raw = await svgBlob.text();

  const jsonMain = JSON.stringify(metaObject, null, 2).replace(/]]>/g, "]]]]><![CDATA[>");
  const jsonXfer = JSON.stringify({ phiTransfer: transferBlock }, null, 2).replace(/]]>/g, "]]]]><![CDATA[>");

  const mainTag = `<metadata id="sigil-meta" data-type="application/json"><![CDATA[${jsonMain}]]></metadata>`;
  const transferTag = `<metadata id="phi-transfer" data-type="application/json"><![CDATA[${jsonXfer}]]></metadata>`;

  // Replace the first <metadata>…</metadata> with our MAIN meta. If none exists, insert after <svg …>
  let patched = raw;
  if (/<metadata[\s>]/i.test(patched)) {
    patched = patched.replace(/<metadata[\s\S]*?<\/metadata>/i, mainTag);
  } else {
    patched = patched.replace(/<svg(\s[^>]*)?>/i, (m) => `${m}${mainTag}`);
  }
  // Append the transfer metadata as a sibling just before </svg>
  patched = patched.replace(/<\/svg>\s*$/i, `${transferTag}</svg>`);

  return new Blob([patched], { type: "image/svg+xml" });
}

/* ===== Component ===== */
export interface SendSigilModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceGlyph: Glyph;
  onSend: (newGlyph: Glyph) => void;
}

export default function SendSigilModal({
  isOpen,
  onClose,
  sourceGlyph,
  onSend,
}: SendSigilModalProps) {
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Hidden renderer (we mint the art + metadata offscreen)
  const sigilRef = useRef<KaiSigilHandle>(null);

  // Persist readiness info from KaiSigil (canonical hash + url)
  const [readyHash, setReadyHash] = useState<HashHex | null>(null);
  const [readyUrl, setReadyUrl] = useState<string | null>(null); // canonical (without claim token) — used and exported
  const [readyMetaJson, setReadyMetaJson] = useState<string | null>(null);

  const availableBalance = useMemo(
    () =>
      Number(
        isObject(sourceGlyph) && "value" in sourceGlyph ? (sourceGlyph as Rec).value : 0
      ),
    [sourceGlyph]
  );

  const seed = useMemo(() => extractSeedFromGlyph(sourceGlyph), [sourceGlyph]);
  const stepPct = Math.min(Math.max(seed.stepIndex / seed.stepsPerBeat, 0), 1);

  useEffect(() => {
    if (!isOpen) {
      setAmount("");
      setRecipient("");
      setMessage("");
      setError(null);
      setBusy(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSend = async () => {
    setError(null);

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError("Enter a valid Φ amount.");
      return;
    }
    if (amt > availableBalance) {
      setError(`Insufficient balance. Only ${availableBalance.toFixed(3)} Φ available.`);
      return;
    }

    try {
      setBusy(true);

      // Eternal pulses only (no Chronos/UTC)
      const nowPulse = getKaiPulseEternalInt();
      const sigilPulse = seed.pulse;

      // 1) Export art at full fidelity
      const ref = sigilRef.current;
      if (!ref) throw new Error("Renderer unavailable");
      const svgBlob = await ref.exportBlob("image/svg+xml");
      const pngBlob = await ref.exportBlob("image/png", 3);

      // 2) Compute live centre-pixel signature (same as Verifier)
      const { sig: liveSig, rgb } = await centrePixelSigFromPngBlob(
        pngBlob,
        sigilPulse
      );
      const senderStamp = await sha256Hex(`${liveSig}-${sigilPulse}-${nowPulse}`);

      // 3) Build Kairos stamp (human + machine)
      const kairosStamp = buildKairosStamp(nowPulse, sigilPulse, seed.chakraDay);

      // 4) Build canonical sigil URL (compact v2 + lineage).
      if (!readyHash) throw new Error("Sigil hash not ready");
      const basePayload: SigilSharePayload = {
        pulse: seed.pulse,
        beat: seed.beat,
        stepIndex: seed.stepIndex,
        chakraDay: seed.chakraDay,
        stepsPerBeat: seed.stepsPerBeat,
        kaiSignature: seed.kaiSignature,
        userPhiKey: seed.userPhiKey,
      };
      const canonicalUrl =
        readyUrl ??
        makeSigilUrl(readyHash, basePayload, {
          origin: typeof window !== "undefined" ? window.location.origin : "",
          autoInferParent: true,
        });

      // 5) Attach compact claim token for deduction flow
      const rotatedUrl = attachClaimToken(canonicalUrl, {
        amountPhi: amt,
        sendPulse: nowPulse,
        senderStamp,
        canonicalHash: readyHash,
      });

      // 6) Build transfer payload (used for secondary <metadata> + manifest JSON)
      const transferPayload: TransferPayload = {
        kind: "phi.transfer",
        version: 1,
        amountPhi: amt,
        recipient: recipient || null,
        message: message || null,
        createdAtPulseEternal: nowPulse,
        sigilPulse,
        sendPulse: nowPulse,
        rgbSeed: rgb,
        canonicalHash: readyHash,
        shareUrl: rotatedUrl,
        sourcePhiKey: seed.userPhiKey ?? null,
        kairosStamp,
      };

      // 7) Build Verifier-native metadata block with COMPLETE provenance
      const transferLiteEncoded = b64encodeJson(transferPayload);
      const transferLite: SigilTransferLite = {
        senderSignature: liveSig,
        senderStamp,
        senderKaiPulse: nowPulse,
        payload: {
          name: "phi_transfer_value.json",
          mime: "application/phi.transfer+json",
          size: transferLiteEncoded.length,
          encoded: transferLiteEncoded,
        },
      };

      // Preserve any renderer metadata for forensics (but structure for the Verifier)
      const embeddedMeta =
        readyMetaJson && readyMetaJson.trim().length > 0
          ? (JSON.parse(readyMetaJson) as unknown)
          : null;

      const verifierMeta: Record<string, unknown> = {
        "@context": SIGIL_CTX,
        type: SIGIL_TYPE,
        // CORE: these MUST be present for the Verifier to accept
        pulse: sigilPulse,
        beat: seed.beat,
        stepIndex: seed.stepIndex,
        chakraDay: seed.chakraDay,
        // Helpful extras (kept verbatim if present)
        stepsPerBeat: seed.stepsPerBeat,
        kaiSignature: seed.kaiSignature ?? undefined,
        userPhiKey: seed.userPhiKey ?? undefined,
        creatorPublicKey: seed.creatorPublicKey ?? undefined,
        kaiPulse: nowPulse, // seal anchor
        canonicalHash: readyHash,
        transferNonce: genNonce(),
        segmentSize: SEGMENT_SIZE,
        transfers: [transferLite],
        // keep the canonical (non-rotated) for reference; rotated shared via claim token
        canonicalUrl,
        shareUrl: rotatedUrl,
        // For completeness: preserve what the renderer gave us (never lost)
        embeddedMeta,
      };

      // 8) Write verifier metadata (primary) + transfer metadata (secondary) into the SVG
      const enhancedSvg = await writeVerifierMetadataIntoSvg(
        svgBlob,
        verifierMeta,
        transferPayload
      );

      // 9) Bundle (SVG + PNG + manifest.json) with deterministic filename
      const base = pulseFilename("sigil_transfer", sigilPulse, nowPulse);
      const manifest = {
        version: 1 as const,
        kind: "phi.sigil.mint" as const,
        canonicalHash: readyHash,
        canonicalUrl,
        shareUrl: rotatedUrl,
        meta: verifierMeta,
      };
      const zip = new JSZip();
      zip.file(`${base}.svg`, enhancedSvg);
      zip.file(`${base}.png`, pngBlob);
      zip.file(`${base}.json`, JSON.stringify(manifest, null, 2));
      const zipBlob = await zip.generateAsync({ type: "blob" });

      // 10) Download ZIP immediately
      const a = document.createElement("a");
      const url = URL.createObjectURL(zipBlob);
      a.href = url;
      a.download = `${base}.zip`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);

      // 11) Register rotated URL globally (live bus + storage)
      registerSigilUrl(rotatedUrl);

      // 12) Update your app state (same behaviour as before)
      const newGlyph = sendGlyphFromSource(
        sourceGlyph,
        amt,
        nowPulse,
        recipient,
        message
      );
      onSend(newGlyph);

      setBusy(false);
      onClose();
    } catch (err) {
      setBusy(false);
      setError(
        "Failed to mint & send glyph. " +
          (err instanceof Error ? err.message : String(err))
      );
    }
  };

  return (
    <div className="modal-overlay">
      <dialog className="send-sigil-modal" open>
        <button className="close-btn" onClick={onClose} aria-label="Close">
          <XCircle size={22} />
        </button>
        <h2>Exhale Composite Derivative Breath</h2>

        {/* Hidden KaiSigil to mint art+metadata (QR-free) */}
        <div
          aria-hidden
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
        >
          <KaiSigil
            ref={sigilRef}
            pulse={seed.pulse}
            beat={seed.beat}
            stepPct={stepPct}
            chakraDay={seed.chakraDay}
            userPhiKey={seed.userPhiKey}
            kaiSignature={seed.kaiSignature}
            creatorPublicKey={seed.creatorPublicKey}
            origin={
              typeof window !== "undefined" ? window.location.origin : undefined
            }
            animate={false}
            quality="high"
            showZKBadge={false}
            onReady={({ hash, metadataJson }) => {
              // Build canonical URL via utils (compact v2 + lineage from current page)
              const payload: SigilSharePayload = {
                pulse: seed.pulse,
                beat: seed.beat,
                stepIndex: seed.stepIndex,
                chakraDay: seed.chakraDay,
                stepsPerBeat: seed.stepsPerBeat,
                kaiSignature: seed.kaiSignature,
                userPhiKey: seed.userPhiKey,
              };
              const builtUrl = makeSigilUrl(hash, payload, {
                origin: typeof window !== "undefined" ? window.location.origin : "",
                autoInferParent: true,
              });
              setReadyHash(hash);
              setReadyUrl(builtUrl); // keep for rotation + manifest export
              setReadyMetaJson(metadataJson);
            }}
            onError={() => {
              /* keep UI going; sending still works */
            }}
          />
        </div>

        <div className="field-group">
          <label>Recipient Hash (optional)</label>
          <input
            type="text"
            placeholder="e.g. phikey::sig"
            value={recipient}
            onChange={(e) => setRecipient(e.currentTarget.value)}
          />
        </div>

        <div className="field-group">
          <label>Memory (optional)</label>
          <input
            type="text"
            placeholder="Message to attach"
            value={message}
            onChange={(e) => setMessage(e.currentTarget.value)}
          />
        </div>

        <div className="field-group">
          <label>Amount to Exhale (Φ)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.currentTarget.value)}
            placeholder="0.0"
            min="0"
            step="0.001"
          />
        </div>

        <div className="balance-hint">Available: {availableBalance.toFixed(3)} Φ</div>

        {error && <div className="error-msg">{error}</div>}

        <button className="send-btn" onClick={handleSend} disabled={busy}>
          <SendHorizontal size={18} /> {busy ? "Exhaling…" : "Exhale Breath"}
        </button>

        <p className="small subtle" style={{ marginTop: 8 }}>
          {readyHash ? `canonical: ${readyHash.slice(0, 10)}…` : "remembering sigil…"}
        </p>
      </dialog>
    </div>
  );
}
