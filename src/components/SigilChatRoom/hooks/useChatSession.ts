import { useEffect, useState } from "react";
import {
  generateSigilZKProof,
  verifySigilZKProof,
} from "../lib/SigilZK"; // adjust path if different

import { getKaiPulseEternalInt } from "../../../SovereignSolar";
import { getUserPhiKey, getPhraseHash } from "../utils/identity";

export interface ChatZKSession {
  kaiPulse: number;
  userPhiKey: string;
  phraseHash: string;
  proof: Record<string, unknown>;
  publicSignals: string[];
  isVerified: boolean;
}

/**
 * Initializes and verifies a ZK-backed chat session tied to the current Kai-Pulse.
 */
export function useChatSession(): ChatZKSession | null {
  const [session, setSession] = useState<ChatZKSession | null>(null);

  useEffect(() => {
    async function initSession() {
      try {
        const kaiPulse = getKaiPulseEternalInt();
        const userPhiKey = getUserPhiKey(); // from local storage or biometric key cache
        const phraseHash = getPhraseHash(); // BLAKE2b hash of phrase, etc.

        const { proof, publicSignals } = await generateSigilZKProof({
          pulse: kaiPulse,
          userPhiKey,
          phraseHash,
        });

        const isVerified = await verifySigilZKProof(proof, publicSignals);

        setSession({
          kaiPulse,
          userPhiKey,
          phraseHash,
          proof,
          publicSignals,
          isVerified,
        });
      } catch (err) {
        console.error("ZK chat session init failed:", err);
        setSession(null);
      }
    }

    void initSession();
  }, []);

  return session;
}
