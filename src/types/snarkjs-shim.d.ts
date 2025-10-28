// src/types/snarkjs-shim.d.ts
declare module "snarkjs" {
  export type Groth16Proof = {
    pi_a: [string, string, string?];
    pi_b: [[string, string], [string, string], [string, string]?];
    pi_c: [string, string, string?];
    protocol?: "groth16";
    curve?: string;
  };

  export const groth16: {
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
}
