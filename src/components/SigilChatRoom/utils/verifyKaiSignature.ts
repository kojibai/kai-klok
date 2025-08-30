import { blake2bHex } from "blakejs";

/**
 * Verifies a KaiSignature against expected user identity and pulse.
 * @param signature The provided kaiSignature to verify
 * @param userPhiKey The known identity of the user
 * @param pulse The Kai-Klok pulse the signature was generated from
 * @param phraseSignature Shared secret, derived from phrase/frequency/biometric seal
 * @returns true if valid, false otherwise
 */
export function verifyKaiSignature(
  signature: string,
  userPhiKey: string,
  pulse: number,
  phraseSignature: string
): boolean {
  const payload = `${userPhiKey}:${pulse}:${phraseSignature}`;
  const expected = blake2bHex(payload);
  return expected === signature;
}
