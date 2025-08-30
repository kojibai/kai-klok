/**
 * BLAKE3 hashing via hash-wasm (browser & Node friendly).
 * Note: functions are async because WASM initializes on first use.
 */
import type { blake3 as blake3Fn } from "hash-wasm";

/** Convert bytes → hex (lowercase). */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Convert hex → bytes. Accepts upper/lowercase; optional 0x prefix. */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase().replace(/^0x/, "");
  if (clean.length % 2 !== 0) throw new Error("HEX_LENGTH_MUST_BE_EVEN");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = clean.slice(i * 2, i * 2 + 2);
    const val = Number.parseInt(byte, 16);
    if (Number.isNaN(val)) throw new Error("HEX_PARSE_ERROR");
    out[i] = val;
  }
  return out;
}

/**
 * Compute BLAKE3 digest (hex). Keep this as the one exported API most code needs.
 * Usage: const hex = await blake3Hex(bytes)
 */
export async function blake3Hex(bytes: Uint8Array): Promise<string> {
  // dynamic import so Vite splits WASM nicely
  const { blake3 } = (await import("hash-wasm")) as { blake3: typeof blake3Fn };
  return blake3(bytes);
}

/**
 * If you ever need raw bytes:
 */
export async function blake3(bytes: Uint8Array): Promise<Uint8Array> {
  const hex = await blake3Hex(bytes);
  return hexToBytes(hex);
}
