import { blake2bHex } from "blakejs";

/**
 * LocalStorage key constants.
 */
const KEY_USER_PHI = "kai:identity:userPhiKey";
const KEY_PHRASE = "kai:identity:phrase";

/**
 * Returns the current user’s PhiKey from storage.
 * Throws if not present.
 */
export function getUserPhiKey(): string {
  const key = localStorage.getItem(KEY_USER_PHI);
  if (!key || key.trim().length === 0) {
    throw new Error("User PhiKey not found in storage");
  }
  return key;
}

/**
 * Stores the current user’s PhiKey.
 */
export function setUserPhiKey(phiKey: string): void {
  localStorage.setItem(KEY_USER_PHI, phiKey);
}

/**
 * Gets the phrase from storage and returns its BLAKE2b hash.
 * Throws if not set.
 */
export function getPhraseHash(): string {
  const phrase = localStorage.getItem(KEY_PHRASE);
  if (!phrase || phrase.trim().length === 0) {
    throw new Error("User phrase not found in storage");
  }
  return hashPhrase(phrase);
}

/**
 * Stores the raw phrase (optional, if using a UI form).
 */
export function setUserPhrase(phrase: string): void {
  localStorage.setItem(KEY_PHRASE, phrase);
}

/**
 * Computes a deterministic BLAKE2b hash of the input phrase.
 * Returns hex string.
 */
export function hashPhrase(phrase: string): string {
  return blake2bHex(phrase.normalize("NFKC"));
}

/**
 * Lightweight client-side check that the provided ZK proof / publicSignals
 * correspond to the provided userPhiKey. This is a *best-effort* precheck;
 * do your canonical verification with snarkjs or a verifier contract.
 */
export function verifyUserPhiKeyIdentity(
  proof: unknown,
  publicSignals: string[],
  userPhiKey: string
): boolean {
  // Heuristics:
  // 1) direct match (some circuits export raw phi key)
  if (publicSignals.includes(userPhiKey)) return true;

  // 2) hash match (some circuits export field hash)
  const hashed = blake2bHex(userPhiKey);
  if (publicSignals.includes(hashed)) return true;

  // 3) optional nested phiKeyField inside proof object
  if (typeof proof === "object" && proof !== null) {
    const phiKeyField = (proof as Record<string, unknown>)["phiKeyField"];
    if (typeof phiKeyField === "string" && (phiKeyField === userPhiKey || phiKeyField === hashed)) {
      return true;
    }
  }

  return false;
}
