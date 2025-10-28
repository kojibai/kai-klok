// src/zk/verify.ts
import type { Groth16Proof, SnarkJs } from "./types";

const VKEY_URL = "/zk/verification_key.json";

async function loadJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

export async function verifySigilProof(
  publicSignals: string[],
  proof: Groth16Proof
): Promise<boolean> {
  // No type import from 'snarkjs' — use our SnarkJs interface.
  const { groth16 } = (await import("snarkjs")) as unknown as SnarkJs;
  const vkey = await loadJson(VKEY_URL);
  return groth16.verify(vkey, publicSignals, proof);
}
