import type { SigilMetadata, SegmentEntry, SegmentFile, SigilTransfer } from "./types";
import { headCanonicalHash } from "./sigilUtils";
import { buildMerkleRoot } from "./merkle";
import { SEGMENT_SIZE } from "./constants";
import { sha256Hex } from "./crypto";

/* FIX: sealed window into a segment, returns updated meta + blob (unchanged behavior) */
export async function sealCurrentWindowIntoSegment(meta: SigilMetadata) {
  const live = meta.transfers ?? [];
  if (live.length === 0) return { meta, segmentFileBlob: null as Blob | null };

  // Build segment
  const segmentIndex = meta.segments?.length ?? 0;
  const startGlobal = meta.cumulativeTransfers ?? 0;
  const endGlobal = startGlobal + live.length - 1;

  // hash leaves (transfer minified)
  const leaves = await Promise.all(live.map(async (t: SigilTransfer) => {
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
  }));

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
