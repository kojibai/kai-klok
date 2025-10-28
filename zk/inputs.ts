// src/zk/inputs.ts
import { buildPoseidonOpt } from "circomlibjs"; // already common in your stack

export type CanonLike = {
  pulse: number;
  beat: number;
  stepIndex: number;
  chakraDayKey: string; // e.g. "Throat"
};

function chakraIndex(day: string): number {
  // Map your 7-day naming to the circuit's expected index
  const order = ["Root","Sacral","Solar","Heart","Throat","Brow","Crown"];
  const i = order.findIndex(d => d.toLowerCase() === day.toLowerCase());
  return i >= 0 ? i : 0;
}

function hexToBigInt(hex?: string): bigint {
  if (!hex) return 0n;
  const clean = hex.startsWith("0x") ? hex : `0x${hex}`;
  return BigInt(clean);
}

/**
 * Default input builder:
 * Poseidon over (pulse, beat, step, chakraIndex, kaiSigLo) – adjust to your circuit.
 */
export async function buildCircuitInput(
  canon: CanonLike,
  userPhiKey?: string,   // optional if your circuit binds wallet
  kaiSignatureHex?: string
): Promise<Record<string, string>> {
  const poseidon = await buildPoseidonOpt(); // fast poseidon
  const preimage = [
    BigInt(canon.pulse),
    BigInt(canon.beat),
    BigInt(canon.stepIndex),
    BigInt(chakraIndex(canon.chakraDayKey)),
    // If your circuit uses identity binding, include a reduced kaiSignature limb:
    hexToBigInt(kaiSignatureHex)
  ];

  // Poseidon hash result as BigInt → decimal string for snarkjs
  const H = poseidon.F.toObject(poseidon(preimage)).toString();

  // Name keys to match your circom input signals.
  // If your circuit expects different names, rename them here.
  return {
    pulse: String(canon.pulse),
    beat: String(canon.beat),
    step: String(canon.stepIndex),
    chakra: String(chakraIndex(canon.chakraDayKey)),
    H, // <- the Poseidon commitment the circuit recomputes/exports
  };
}
