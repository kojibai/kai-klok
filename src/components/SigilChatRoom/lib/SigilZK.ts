export interface ZKInput {
    pulse: number;
    userPhiKey: string;
    phraseHash: string;
  }
  
  export interface ZKProofResult {
    proof: Record<string, unknown>;
    publicSignals: string[];
  }
  
  type FullProveFn = (
    input: Record<string, unknown>,
    wasmPath: string,
    zkeyPath: string
  ) => Promise<{
    proof: Record<string, unknown>;
    publicSignals: string[];
  }>;
  
  type VerifyFn = (
    vkey: unknown,
    publicSignals: string[],
    proof: Record<string, unknown>
  ) => Promise<boolean>;
  
  /**
   * Loads snarkjs.groth16 with safe casting and explicit ZK proof types.
   */
  async function loadGroth16(): Promise<{
    fullProve: FullProveFn;
    verify: VerifyFn;
  }> {
    const snark = await import("snarkjs");
  
    const { fullProve, verify } = snark.groth16 as unknown as {
      fullProve: FullProveFn;
      verify: VerifyFn;
    };
  
    return { fullProve, verify };
  }
  
  /**
   * Generates a zero-knowledge proof for a sigil.
   */
  export async function generateSigilZKProof(input: ZKInput): Promise<ZKProofResult> {
    const { fullProve } = await loadGroth16();
  
    const wasmPath = "/zk/sigil.zk.wasm";
    const zkeyPath = "/zk/sigil_final.zkey";
  
    const { proof, publicSignals } = await fullProve(
      {
        pulse: input.pulse,
        userPhiKey: input.userPhiKey,
        phraseHash: input.phraseHash,
      },
      wasmPath,
      zkeyPath
    );
  
    return { proof, publicSignals };
  }
  
  /**
   * Verifies a ZK proof for sigil presence.
   */
  export async function verifySigilZKProof(
    proof: Record<string, unknown>,
    publicSignals: string[]
  ): Promise<boolean> {
    const { verify } = await loadGroth16();
    const vkey = await fetch("/zk/verification_key.json").then((res) => res.json());
  
    return await verify(vkey, publicSignals, proof);
  }
  