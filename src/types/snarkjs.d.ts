declare module "snarkjs" {
  export interface Groth16Proof {
    pi_a: [string, string] | string[];
    pi_b: [[string, string], [string, string]] | string[][];
    pi_c: [string, string] | string[];
    protocol: "groth16";
    curve: string;
  }

  export namespace groth16 {
    function fullProve(
      input: Record<string, string | number | bigint>,
      wasmPath: string,
      zkeyPath: string
    ): Promise<{ proof: Groth16Proof; publicSignals: string[] }>;

    function verify(
      vkey: unknown,
      publicSignals: readonly (string | number | bigint)[],
      proof: Groth16Proof
    ): Promise<boolean>;
  }
}
