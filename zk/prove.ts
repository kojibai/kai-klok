// src/zk/prove.ts
import type { Groth16Proof, SnarkJs } from "./types";

type CircuitInput = Record<string, string | number | bigint>;

export interface ZkProof {
  proof: Groth16Proof;
  publicSignals: string[];
}

const WASM_URL = "/zk/sigil_proof_js/sigil_proof.wasm";
const ZKEY_URL = "/zk/sigil_proof_final.zkey";

/** Browser-safe proof generation with lazy import of snarkjs (no types leak). */
export async function generateSigilProof(input: CircuitInput): Promise<ZkProof> {
  if (typeof window === "undefined") {
    throw new Error("generateSigilProof must run in the browser");
  }

  // Normalize bigints to decimal strings (snarkjs requirement)
  const norm: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(input)) {
    norm[k] = typeof v === "bigint" ? v.toString() : v;
  }

  const { groth16 } = (await import("snarkjs")) as unknown as SnarkJs;
  const { proof, publicSignals } = await groth16.fullProve(norm, WASM_URL, ZKEY_URL);
  return { proof, publicSignals };
}
