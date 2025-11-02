// /components/KaiVoh/PhiKeyResolver.ts
import blake from "blakejs";

export interface PhiKeyResolution {
  phiKey: string;
  isValid: boolean;
  reason?: string;
}

export function resolvePhiKeyFromSigil(meta: unknown): PhiKeyResolution {
  if (
    typeof meta !== "object" ||
    meta === null ||
    !("kaiSignature" in meta) ||
    !("userPhiKey" in meta)
  ) {
    return {
      phiKey: "unknown",
      isValid: false,
      reason: "Invalid metadata format or missing fields.",
    };
  }

  const { kaiSignature, userPhiKey } = meta as {
    kaiSignature: string;
    userPhiKey: string;
  };

  if (!kaiSignature || !userPhiKey) {
    return {
      phiKey: "unknown",
      isValid: false,
      reason: "Missing Kai Signature or PhiKey.",
    };
  }

  // Re-derive PhiKey from Kai Signature (blake2b hash of signature)
  const derivedPhiKey = `φK-${blake.blake2bHex(kaiSignature, undefined, 16)}`;

  const isValid = derivedPhiKey === userPhiKey;

  return {
    phiKey: derivedPhiKey,
    isValid,
    reason: isValid ? undefined : "Derived PhiKey mismatch with embedded identity.",
  };
}
