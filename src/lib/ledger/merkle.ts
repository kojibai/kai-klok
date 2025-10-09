import { blake3Hex } from "../sigil/hash";
import type { MintEntry, MerkleLeaf, MerkleRoot } from "./types";

export function canon(entry: MintEntry): string {
  // Stable JSON without undefineds
  const o = {
    v: 1,
    pulse: entry.pulse,
    beat: entry.beat,
    stepIndex: entry.stepIndex,
    chakraDay: entry.chakraDay,
    stepsPerBeat: entry.stepsPerBeat,
    kaiSignature: entry.kaiSignature ?? null,
    userPhiKey: entry.userPhiKey ?? null,
    ts: entry.ts ?? null,
  };
  return JSON.stringify(o);
}

export async function leafOf(entry: MintEntry): Promise<MerkleLeaf> {
  return { hash: await blake3Hex(new TextEncoder().encode(canon(entry))) };
}

export async function merkleRoot(leaves: MerkleLeaf[]): Promise<MerkleRoot> {
  if (leaves.length === 0) return await blake3Hex(new Uint8Array());
  let level = leaves.map(l => l.hash);
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i], b = level[i+1] ?? level[i]; // duplicate last if odd
      const cat = new TextEncoder().encode(a + b);
      next.push(await blake3Hex(cat));
    }
    level = next;
  }
  return level[0];
}
