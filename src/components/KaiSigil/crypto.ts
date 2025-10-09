/* Safe web-crypto wrappers and helpers (fixes BufferSource/SAB issues) */

export const bytesToHex = (bytes: Uint8Array) =>
    [...bytes].map((b) => b.toString(16)).map((s) => s.padStart(2, "0")).join("");
  
  /** Convert any Uint8Array (even SAB-backed / subarray) into an ArrayBuffer safely */
  export function toBufferSource(u8: Uint8Array): ArrayBuffer {
    if (
      !(typeof SharedArrayBuffer !== "undefined" && u8.buffer instanceof SharedArrayBuffer) &&
      u8.byteOffset === 0 &&
      u8.byteLength === u8.buffer.byteLength
    ) {
      return u8.buffer as ArrayBuffer;
    }
    return u8.slice().buffer as ArrayBuffer;
  }
  
  export async function sha256(data: string | Uint8Array): Promise<Uint8Array> {
    const buf = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const hash = await crypto.subtle.digest("SHA-256", toBufferSource(buf));
    return new Uint8Array(hash);
  }
  
  /* base58 + base58check */
  const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  export function base58Encode(buffer: Uint8Array): string {
    let intVal = 0n;
    for (const byte of buffer) intVal = (intVal << 8n) + BigInt(byte);
    let out = "";
    while (intVal > 0n) {
      const mod = intVal % 58n;
      out = B58_ALPHABET[Number(mod)] + out;
      intVal /= 58n;
    }
    for (let i = 0; i < buffer.length && buffer[i] === 0; i += 1)
      out = B58_ALPHABET[0] + out;
    return out;
  }
  
  export async function base58CheckEncode(
    payload: Uint8Array,
    version = 0x00
  ): Promise<string> {
    const versioned = new Uint8Array(1 + payload.length);
    versioned[0] = version;
    versioned.set(payload, 1);
    const checksumFull = await sha256(await sha256(versioned));
    const checksum = checksumFull.slice(0, 4);
    const full = new Uint8Array(versioned.length + 4);
    full.set(versioned);
    full.set(checksum, versioned.length);
    return base58Encode(full);
  }
  
  export function mulberry32(a: number) {
    let state = a >>> 0;
    return function next(): number {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | state)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  export function hashToUint32(s: string) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  
  export const hexToBytes = (hex: string) => {
    const h = hex.replace(/^0x/i, "");
    const out = new Uint8Array(h.length / 2);
    for (let i = 0; i < out.length; i += 1) out[i] = parseInt(h.substr(i * 2, 2), 16);
    return out;
  };
  
  export function crc32(bytes: Uint8Array): number {
    let c = ~0 >>> 0;
    for (let i = 0; i < bytes.length; i += 1) {
      c ^= bytes[i];
      for (let k = 0; k < 8; k += 1)
        c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return ~c >>> 0;
  }
  
  /* browser b64→u8 */
  export const b64ToUint8 = (b64: string): Uint8Array => {
    let s = b64.replace(/-/g, "+").replace(/_/g, "/");
    const pad = s.length % 4;
    if (pad) s += "=".repeat(4 - pad);
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };
  