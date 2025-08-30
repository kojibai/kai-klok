import { useState, useEffect } from "react";
import { useKaiPulse } from "./useKaiPulse";
import { verifyKaiSignature } from "../utils/verifyKaiSignature";
import type { SigilMetadata } from "../types/SigilMetadata";

/**
 * Hook to detect active participants in the current chatroom pulse window.
 * Validates harmonic alignment using KaiSignature and Kai-Klok.
 */
export function usePresence(
  roomId: string,
  knownSigils: SigilMetadata[],
  phraseSignature: string,
  windowSize: number = 2
): string[] {
  const pulse = useKaiPulse();
  const [presentUsers, setPresentUsers] = useState<string[]>([]);

  useEffect(() => {
    const withinWindow = (sigil: SigilMetadata): boolean => {
      const delta = Math.abs(sigil.pulse - pulse);
      const sameRoom =
        sigil.parentSigilHash === roomId ||
        sigil.lineageTag === roomId ||
        sigil.userPhiKey === roomId;

      const isValid = verifyKaiSignature(
        sigil.kaiSignature,
        sigil.userPhiKey,
        sigil.pulse,
        phraseSignature
      );

      return delta <= windowSize && sameRoom && isValid;
    };

    const participants = knownSigils
      .filter(withinWindow)
      .map((sigil) => sigil.userPhiKey);

    setPresentUsers(participants);
  }, [pulse, knownSigils, phraseSignature, roomId, windowSize]);

  return presentUsers;
}
