// types/SigilMetadata.ts
// Harmonic metadata embedded inside every sigil's <metadata> block or payload
// All values are Kai-Klok aligned — no Chronos timestamps allowed

export interface SigilMetadata {
    // ───────── Identity + Auth ─────────
  
    /** Unique PhiKey (resonant identity of user, like a wallet address) */
    userPhiKey: string;
  
    /** KaiSignature: hash of identity + breath + pulse (BLAKE2b or Poseidon) */
    kaiSignature: string;
  
    /** Optional ZK proof to validate entry without revealing full identity */
    zkProof?: string;
  
    // ───────── Harmonic Pulse Anchoring ─────────
  
    /** KaiPulse number when the sigil was created (integer from Kai-Klok) */
    pulse: number;
  
    /** Beat index at time of creation (0–35) */
    beat: number;
  
    /** Step index within the beat (0–43) */
    stepIndex: number;
  
    /** Chakra alignment for this sigil, used for filtering or coherence */
    chakraGate?: string;
  
    /** Optional chakra day label (Solhara, Kaelith, etc.) */
    chakraDay?: string;
  
    // ───────── Type & Lineage ─────────
  
    /** Declares the functional type of the sigil (e.g., "chatroom", "message", "presence") */
    type: "chatroom" | "message" | "presence" | "entry" | "seal" | "portal";
  
    /** Optional parent sigil hash if this sigil is a derivative */
    parentSigilHash?: string;
  
    /** Optional tag used to group sigils by shared ritual, event, or anchor */
    lineageTag?: string;
  
    /** Human-readable purpose or topic of the sigil (e.g., “Kai Summit Chat”) */
    topic?: string;
  
    // ───────── Communication-Specific ─────────
  
    /** Array of allowed PhiKeys for private chatrooms (if omitted, open to any harmonic match) */
    participants?: string[];
  
    /** Optional message or content encoded in this sigil (text-based chat or payload pointer) */
    message?: string;
  
    /** Version of the metadata schema */
    schemaVersion: number;
  }
  