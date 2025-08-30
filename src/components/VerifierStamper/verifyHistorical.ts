import type {
    SigilMetadata,
    SegmentProofBundle,
    HeadWindowProofBundle,
  } from "./types";
  import { verifyProof, buildMerkleRoot, hashPair } from "./merkle";
  
  /* Optional verifier that can consume proof bundles (for Explorer) */
  export async function verifyHistorical(
    head: SigilMetadata,
    bundle: SegmentProofBundle | HeadWindowProofBundle
  ): Promise<boolean> {
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
      // order-independence
      acc = await hashPair(
        pair[0] <= pair[1] ? pair[0] : pair[1],
        pair[0] <= pair[1] ? pair[1] : pair[0]
      );
      idx = Math.floor(idx / 2);
    }
    if (acc !== head.segmentsMerkleRoot) return false;
  
    // prove transfer ∈ segmentRoot
    return verifyProof(bundle.segmentRoot, bundle.transferProof);
  }
  
  /* Re-export to keep the buildMerkleRoot import “used” without altering behavior */
  export { buildMerkleRoot as __keep_buildMerkleRoot };
  