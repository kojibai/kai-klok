import type { SigilMetadata } from "../types/SigilMetadata";

/**
 * Returns true if two sigils belong to the same chatroom lineage.
 * Compares parentSigilHash, lineageTag, and PhiKey.
 */
export function isSameChatRoom(a: SigilMetadata, b: SigilMetadata): boolean {
  if (a.type !== "chatroom" || b.type !== "chatroom") return false;

  const parentMatch =
    typeof a.parentSigilHash === "string" &&
    a.parentSigilHash.length > 0 &&
    a.parentSigilHash === b.parentSigilHash;

  const lineageMatch =
    typeof a.lineageTag === "string" &&
    a.lineageTag.length > 0 &&
    a.lineageTag === b.lineageTag;

  const phiKeyMatch = a.userPhiKey === b.userPhiKey;

  return parentMatch || lineageMatch || phiKeyMatch;
}
