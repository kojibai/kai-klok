// src/types/snarkjs-shim.d.ts
declare module "snarkjs" {
    export namespace groth16 {
      export function verify(
        vkey: Record<string, unknown>,
        publicSignals:
          | readonly (string | number | bigint)[]
          | Record<string, string | number | bigint>,
        proof: Record<string, unknown>
      ): Promise<boolean>;
    }
  }
  