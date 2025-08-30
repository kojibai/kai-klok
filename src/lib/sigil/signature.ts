/**
 * signature.ts
 * Minimal signer bridge for Kai Sigils.
 *
 * - getSigner(): tries an explicitly set signer, then global providers (window.phiSigner / window.kaiSigner)
 * - signHash(hex): signs a hex hash if a signer is available
 * - Types are strict; no `any`.
 */

export type HarmonicSig = {
    alg: "harmonic-sig";
    public: string;   // address / public key / phikey (display form)
    value: string;    // signature bytes as hex (lowercase)
  };
  
  export interface HarmonicSigner {
    /** Human/address form to embed in the sigil integrity object */
    publicKey: string;
    /** Sign a lowercase hex string, return signature as lowercase hex */
    sign(hexLowercase: string): Promise<string>;
  }
  
  /* Optional explicit injection (e.g., from app bootstrap) */
  let explicitSigner: HarmonicSigner | null = null;
  
  /** Allow apps to set a signer programmatically. */
  export function setSigner(signer: HarmonicSigner | null): void {
    explicitSigner = signer;
  }
  
  /** Type-safe peek at global providers without using `any`. */
  function getGlobalProvider(): HarmonicSigner | null {
    // Build a minimal typed view of globalThis
    type MaybeGlobal = {
      phiSigner?: HarmonicSigner;
      kaiSigner?: HarmonicSigner;
    };
  
    const g = globalThis as unknown as MaybeGlobal;
    if (g && typeof g === "object") {
      if (g.phiSigner && typeof g.phiSigner.sign === "function") return g.phiSigner;
      if (g.kaiSigner && typeof g.kaiSigner.sign === "function") return g.kaiSigner;
    }
    return null;
  }
  
  /**
   * Return the best available signer:
   * 1) explicitly set signer (setSigner)
   * 2) global window.phiSigner / window.kaiSigner
   * 3) null if none found
   */
  export function getSigner(): HarmonicSigner | null {
    return explicitSigner ?? getGlobalProvider();
  }
  
  /**
   * Sign a payload hash (lowercase hex). If no signer exists, returns undefined.
   */
  export async function signHash(hexLowercase: string): Promise<HarmonicSig | undefined> {
    const signer = getSigner();
    if (!signer) return undefined;
  
    const normalized = hexLowercase.toLowerCase();
    const sig = await signer.sign(normalized);
  
    return {
      alg: "harmonic-sig",
      public: signer.publicKey,
      value: sig.toLowerCase(),
    };
  }
  