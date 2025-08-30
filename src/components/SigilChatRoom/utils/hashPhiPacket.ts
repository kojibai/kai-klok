import { blake2bHex } from "blakejs";
import type { PhiPacket } from "../types/PhiPacket";

/**
 * Generates a deterministic hash of a PhiPacket.
 * Used as a signature or message ID.
 * Hash includes pulse, from, kaiSignature, message, and any declared optional fields in canonical order.
 */
export function hashPhiPacket(packet: PhiPacket): string {
  const {
    pulse,
    from,
    kaiSignature,
    message,
    type = "",
    to = "",
    lineageTag = "",
  } = packet;

  if (
    typeof pulse !== "number" ||
    typeof from !== "string" ||
    typeof kaiSignature !== "string" ||
    typeof message !== "string"
  ) {
    throw new Error("Invalid PhiPacket: missing required fields.");
  }

  const canonical = [
    `pulse:${pulse}`,
    `from:${from}`,
    `kaiSignature:${kaiSignature}`,
    `message:${message}`,
    `type:${type}`,
    `to:${to}`,
    `lineageTag:${lineageTag}`,
  ].join("|");

  return blake2bHex(canonical);
}
