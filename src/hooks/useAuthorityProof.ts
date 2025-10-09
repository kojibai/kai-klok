import * as React from "react";
import type { SigilPayload } from "../types/sigil";
import {
  ETERNAL_STEPS_PER_BEAT as STEPS_PER_BEAT,
  stepIndexFromPulse,
} from "../SovereignSolar";
import {
  sha256HexCanon,
  derivePhiKeyFromSigCanon,
  verifierSigmaString,
  readIntentionSigil,
} from "../pages/SigilPage/verifierCanon";

export type BreathProof = {
  pulse: number;
  beat: number;
  stepsPerBeat: number;
  stepIndex: number;
  chakraDay: string;
  intention: string | null;
  sigmaString: string;
  sigmaHash: string;
  derivedPhiKey: string;
  payloadKaiSignature?: string | null;
  payloadUserPhiKey?: string | null;
  matches: { sigma: boolean; phi: boolean };
};

/** Computes Proof•of•Breath for a payload; memoized and cancellation-safe. */
export function useAuthorityProof(payload: SigilPayload | null) {
  const [proof, setProof] = React.useState<BreathProof | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!payload) { setProof(null); return; }
        const stepsNum: number = (payload.stepsPerBeat ?? STEPS_PER_BEAT) as number;
        const sealedIdx = stepIndexFromPulse(payload.pulse, stepsNum);
        const intention = readIntentionSigil(payload);

        const sigmaString = verifierSigmaString(
          payload.pulse,
          payload.beat,
          sealedIdx,
          String(payload.chakraDay ?? ""),
          intention
        );

        const sigmaHash = await sha256HexCanon(sigmaString);
        const derivedPhiKey = await derivePhiKeyFromSigCanon(sigmaHash);

        const sigmaMatches =
          typeof payload.kaiSignature === "string"
            ? payload.kaiSignature.toLowerCase() === sigmaHash.toLowerCase()
            : true;

        const phiMatches =
          typeof payload.userPhiKey === "string"
            ? payload.userPhiKey.toLowerCase() === derivedPhiKey.toLowerCase()
            : true;

        if (!cancelled) {
          setProof({
            pulse: payload.pulse,
            beat: payload.beat,
            stepsPerBeat: stepsNum,
            stepIndex: sealedIdx,
            chakraDay: String(payload.chakraDay ?? ""),
            intention: intention ?? null,
            sigmaString,
            sigmaHash,
            derivedPhiKey,
            payloadKaiSignature: payload.kaiSignature ?? null,
            payloadUserPhiKey: payload.userPhiKey ?? null,
            matches: { sigma: sigmaMatches, phi: phiMatches },
          });
        }
      } catch {
        if (!cancelled) setProof(null);
      }
    })();
    return () => { cancelled = true; };
  }, [payload?.pulse, payload?.beat, payload?.stepsPerBeat, payload?.chakraDay, payload?.kaiSignature, payload?.userPhiKey]);

  return proof;
}
