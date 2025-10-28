// src/zk/types.ts
// Minimal Groth16 proof shape used by snarkjs in the browser.
export type Groth16Proof = {
  pi_a: [string, string, string?];
  pi_b: [[string, string], [string, string], [string, string]?];
  pi_c: [string, string, string?];
  protocol?: "groth16";
  curve?: string;
};

// Minimal shape for the subset of snarkjs we use at runtime.
// This lets us avoid `typeof import("snarkjs")` in type positions.
export type SnarkJs = {
  groth16: {
    fullProve(
      input: Record<string, string | number | bigint>,
      wasmPath: string,
      zkeyPath: string
    ): Promise<{ proof: Groth16Proof; publicSignals: string[] }>;
    verify(
      vkey: unknown,
      publicSignals: string[],
      proof: Groth16Proof
    ): Promise<boolean>;
  };
};
