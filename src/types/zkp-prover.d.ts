// src/types/zkp_prover.d.ts
declare module "*zkp_prover.js" {
    export default function (): Promise<void>;
  
    export function generate_proof(
      kaiSignature: string,
      salt: string,
      phiKey: string
    ): Promise<string>;
  }
  