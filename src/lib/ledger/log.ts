import { gzipB64 } from "../sigil/codec";
import type { MintEntry, LedgerV1, PackedLedgerV1 } from "./types";
import { leafOf, merkleRoot } from "./merkle";

export async function createLedger(entries: MintEntry[]): Promise<LedgerV1> {
  const leaves = await Promise.all(entries.map(leafOf));
  const root = await merkleRoot(leaves);
  return {
    v: 1,
    leaves,
    root,
    lastPulse: Math.max(...entries.map(e => e.pulse), 0),
  };
}

export async function packLedger(ledger: LedgerV1): Promise<PackedLedgerV1> {
  const json = JSON.stringify(ledger);
  const payload = gzipB64(new TextEncoder().encode(json));
  return { v: 1, codec: "gzip+base64", payload };
}
