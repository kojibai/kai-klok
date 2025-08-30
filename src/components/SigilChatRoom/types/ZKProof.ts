/**
 * Canonical zero-knowledge proof format for Kairos-verified actions.
 *
 * This proof structure aligns with the Groth16 format using Poseidon hashing
 * and BLS12-381 curves, and is generated using Arkworks-compatible circuits.
 */

export interface ZKProof {
    /** Public signal: the sender's PhiKey address (as a field element) */
    phiKeyField: string;
  
    /** Public signal: the Kai pulse (harmonic timestamp) */
    kaiPulse: number;
  
    /** Groth16 full proof object */
    proof: {
      pi_a: [string, string];               // G1 point
      pi_b: [[string, string], [string, string]]; // G2 point
      pi_c: [string, string];               // G1 point
    };
  
    /** Public signals used during verification (field elements as strings) */
    publicSignals: string[];
  }
  