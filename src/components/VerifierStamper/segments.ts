import type { SigilMetadata, SegmentEntry, SegmentFile, SigilTransfer } from "./types";
import { headCanonicalHash } from "./sigilUtils";
import { buildMerkleRoot } from "./merkle";
import { SEGMENT_SIZE } from "./constants";
import { sha256Hex } from "./crypto";

/* ────────────────────────────────────────────────────────────────
   Local 18dp decimal + exhale helpers (match VerifierStamper math)
────────────────────────────────────────────────────────────────── */

const SCALE = 18n;
function pow10(n: bigint): bigint {
  let r = 1n;
  for (let i = 0n; i < n; i++) r *= 10n;
  return r;
}
const TEN_S = pow10(SCALE);

function toScaledBig(s: string): bigint {
  const t = (s || "").trim();
  if (!t) return 0n;
  const sign = t.startsWith("-") ? -1n : 1n;
  const clean = t.replace(/[^0-9.]/g, "").replace(/^\.*/, (m) => (m ? "0." : ""));
  const [i, f = ""] = clean.split(".");
  const intPart = (i || "0").replace(/^0+(?=\d)/, "") || "0";
  const fracPart = (f + "0".repeat(Number(SCALE))).slice(0, Number(SCALE));
  return sign * (BigInt(intPart) * TEN_S + BigInt(fracPart || "0"));
}
function fromScaledBig(bi: bigint): string {
  const sign = bi < 0n ? "-" : "";
  const v = bi < 0n ? -bi : bi;
  const intPart = v / TEN_S;
  let frac = (v % TEN_S).toString().padStart(Number(SCALE), "0");
  frac = frac.replace(/0+$/, "");
  return frac ? `${sign}${intPart}.${frac}` : `${sign}${intPart}`;
}
function base64DecodeUtf8(b64: string): string {
  try {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(arr);
  } catch {
    return "";
  }
}
function exhalePhiFromTransferScaled(t: SigilTransfer | undefined): bigint {
  if (!t?.payload?.mime?.startsWith("application/vnd.kairos-exhale")) return 0n;
  try {
    const obj = JSON.parse(base64DecodeUtf8(t.payload.encoded)) as { kind?: unknown; amountPhi?: unknown };
    if (obj?.kind === "exhale" && typeof obj.amountPhi === "string") {
      return toScaledBig(obj.amountPhi);
    }
  } catch {
    /* ignore parse errors */
  }
  return 0n;
}

/* FIX: sealed window into a segment, returns updated meta + blob
   (unchanged behavior + balance persistence across segmentations) */
export async function sealCurrentWindowIntoSegment(meta: SigilMetadata) {
  const live = meta.transfers ?? [];
  if (live.length === 0) return { meta, segmentFileBlob: null as Blob | null };

  /* ── NEW: compute pivot (last closed transfer in this head window) */
  let pivotIdx = -1;
  for (let i = live.length - 1; i >= 0; i--) {
    if (live[i]?.receiverSignature) {
      pivotIdx = i;
      break;
    }
  }

  /* ── NEW: Φ spent after pivot within THIS window */
  let spentInWindow = 0n;
  for (let i = Math.max(0, pivotIdx + 1); i < live.length; i++) {
    spentInWindow += exhalePhiFromTransferScaled(live[i]);
  }

  /* ── NEW: establish/keep branch base Φ (once per branch) */
  let branchBaseScaled = toScaledBig(meta.branchBasePhi ?? "");
  if (branchBaseScaled === 0n) {
    if (pivotIdx >= 0) {
      // Parent's sent Φ at pivot
      branchBaseScaled = exhalePhiFromTransferScaled(live[pivotIdx]);
    } else {
      // Fallback to initial glyph valuation (if present)
      const val = (meta as { valuation?: { valuePhi?: unknown } }).valuation;
      if (val && typeof val.valuePhi === "number") {
        branchBaseScaled = toScaledBig(String(val.valuePhi));
      }
    }
  }

  /* ── NEW: accumulate branch-spent Φ across seals */
  const prevSpent = toScaledBig(meta.branchSpentPhi ?? "0");
  const newSpent = prevSpent + spentInWindow;

  // ───────────────────────────────────────────────────────────────
  // Build segment (unchanged)
  // ───────────────────────────────────────────────────────────────
  const segmentIndex = meta.segments?.length ?? 0;
  const startGlobal = meta.cumulativeTransfers ?? 0;
  const endGlobal = startGlobal + live.length - 1;

  // hash leaves (transfer minified)
  const leaves = await Promise.all(
    live.map(async (t: SigilTransfer) => {
      const obj: Record<string, unknown> = {
        senderSignature: t.senderSignature,
        senderStamp: t.senderStamp,
        senderKaiPulse: t.senderKaiPulse,
      };
      if (t.payload) obj.payload = { name: t.payload.name, mime: t.payload.mime, size: t.payload.size };
      if (t.receiverSignature) obj.receiverSignature = t.receiverSignature;
      if (t.receiverStamp) obj.receiverStamp = t.receiverStamp;
      if (t.receiverKaiPulse != null) obj.receiverKaiPulse = t.receiverKaiPulse;
      return sha256Hex(JSON.stringify(obj));
    })
  );

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
  const newSegments: SegmentEntry[] = [
    ...(meta.segments ?? []),
    { index: segmentIndex, root: segmentRoot, cid, count: live.length },
  ];
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
    // ── NEW: persist branch base & spent so balance never resets
    ...(branchBaseScaled > 0n ? { branchBasePhi: fromScaledBig(branchBaseScaled) } : {}),
    branchSpentPhi: fromScaledBig(newSpent),
  };

  return { meta: updated, segmentFileBlob: segmentBlob };
}
