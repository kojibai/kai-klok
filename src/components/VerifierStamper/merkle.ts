import type { HashHex, TransferProof } from "./types";
import { sha256Hex } from "./crypto";

export async function hashPair(a: HashHex, b: HashHex): Promise<HashHex> {
  const ab = new TextEncoder().encode(a + "|" + b);
  return sha256Hex(ab);
}

// Build merkle root (binary; duplicate last at odd levels)
export async function buildMerkleRoot(leaves: HashHex[]): Promise<HashHex> {
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

export async function merkleProof(leaves: HashHex[], index: number): Promise<TransferProof> {
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

export async function verifyProof(root: HashHex, proof: TransferProof): Promise<boolean> {
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
