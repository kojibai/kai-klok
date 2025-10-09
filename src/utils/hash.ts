// src/utils/hash.ts
// STRICT: no any, uses Web Crypto. Throws with a clear message if unavailable.

function toHex(bytes: Uint8Array): string {
    return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  
  export async function sha256Hex(input: string | Uint8Array): Promise<string> {
    if (!crypto?.subtle) {
      throw new Error("Web Crypto not available for sha256Hex");
    }
    const data =
      typeof input === "string" ? new TextEncoder().encode(input) : input;
    const buf = await crypto.subtle.digest("SHA-256", data);
    return toHex(new Uint8Array(buf));
  }
  