import {
    sha256HexCanon,
    derivePhiKeyFromSigCanon,
    verifierSigmaString as buildSigma,
  } from "./verifierCanon";
  
  /** The exact API we expose to verifier.html */
  export type KaiVerifierShape = {
    sha256HexCanon: (sigma: string) => Promise<string>;
    derivePhiKeyFromSigCanon: (sigmaHex: string) => Promise<string>;
    verifierSigmaString: (
      pulse: number,
      beat: number,
      stepIndex: number,
      chakraDay: string,
      intention: string | null
    ) => string;
  };
  
  const verifierSigmaStringAdapter: KaiVerifierShape["verifierSigmaString"] = (
    pulse,
    beat,
    stepIndex,
    chakraDay,
    intention
  ) => buildSigma(pulse, beat, stepIndex, chakraDay, intention ?? undefined);
  
  const api = {
    sha256HexCanon,
    derivePhiKeyFromSigCanon,
    verifierSigmaString: verifierSigmaStringAdapter,
  } as const satisfies KaiVerifierShape;
  
  // Install read-only global for the offline verifier
  Object.defineProperty(globalThis, "KaiVerifier", {
    value: api,
    writable: false,
    enumerable: false,
    configurable: true,
  });
  
  declare global {
    // eslint-disable-next-line no-var
    var KaiVerifier: KaiVerifierShape;
    interface Window { KaiVerifier: KaiVerifierShape }
  }
  