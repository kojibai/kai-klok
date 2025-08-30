import type { HashHex } from "./types";

/* ═════════════ CRYPTO ═════════════ */

export const bytesToHex = (u8: Uint8Array) =>
  Array.from(u8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export async function sha256Hex(msg: string | Uint8Array): Promise<string> {
  const data = typeof msg === "string" ? new TextEncoder().encode(msg) : msg;
  const buf = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(buf));
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Encode(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) + BigInt(b);
  let out = "";
  while (n > 0n) {
    const mod = Number(n % 58n);
    out = B58[mod] + out;
    n /= 58n;
  }
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) out = "1" + out;
  return out;
}

export async function base58Check(payload: Uint8Array, version = 0x00): Promise<string> {
  const v = new Uint8Array(1 + payload.length);
  v[0] = version;
  v.set(payload, 1);
  const c1 = await crypto.subtle.digest("SHA-256", v);
  const c2 = await crypto.subtle.digest("SHA-256", c1);
  const checksum = new Uint8Array(c2).slice(0, 4);
  const full = new Uint8Array(v.length + 4);
  full.set(v);
  full.set(checksum, v.length);
  return base58Encode(full);
}

/* base64url helpers (for SPKI + signatures) */
export const b64u = {
  encode(bytes: Uint8Array): string {
    const b64 = btoa(String.fromCharCode(...bytes));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  },
  decode(s: string): Uint8Array {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

/* Φ from PUBLIC KEY bytes (SPKI → SHA-256 → first 20 bytes → Base58Check)
   NOTE: we DO NOT change UI text or throw mismatch; this is silent binding. */
export async function phiFromPublicKey(spkiB64u: string): Promise<string> {
  const spki = b64u.decode(spkiB64u);
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", spki));
  return base58Check(h.slice(0, 20), 0x00);
}

/* Small generic helper many modules use (stub to avoid cycles) */
export async function hashAny(x: unknown): Promise<HashHex> {
  void x; // mark param as used to satisfy no-unused-vars
  throw new Error(
    "hashAny is implemented in sigilUtils to avoid cycles. Import from sigilUtils."
  );
}
