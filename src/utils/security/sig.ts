// src/utils/security/sig.ts

const ALG = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIG = { name: "ECDSA", hash: "SHA-256" } as const;


export type TransferPrimitive = string | number | boolean | null;
export type TransferValue = TransferPrimitive | TransferObject
export interface TransferObject { [key: string]: TransferValue }
export type TransferPackage = TransferObject;


/* —— UTILS —— */

/** Convert ArrayBuffer to hex string */
function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Stable canonical stringify */
export function stableStringify(obj: TransferValue): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(",")}]`;
  const entries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** SHA-256 in hex */
export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const input = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", input);
  return toHex(hash);
}



/** Load or generate local ECDSA keypair */
async function getOrCreateKey(): Promise<CryptoKeyPair> {
  const skRaw = localStorage.getItem("phi:ecdsa:sk");
  const pkRaw = localStorage.getItem("phi:ecdsa:pk");

  if (skRaw && pkRaw) {
    const [privateKey, publicKey] = await Promise.all([
      crypto.subtle.importKey("jwk", JSON.parse(skRaw), ALG, true, ["sign"]),
      crypto.subtle.importKey("jwk", JSON.parse(pkRaw), ALG, true, ["verify"]),
    ]);
    return { privateKey, publicKey };
  }

  const keyPair = await crypto.subtle.generateKey(ALG, true, ["sign", "verify"]);
  const [jwkPriv, jwkPub] = await Promise.all([
    crypto.subtle.exportKey("jwk", keyPair.privateKey),
    crypto.subtle.exportKey("jwk", keyPair.publicKey),
  ]);

  localStorage.setItem("phi:ecdsa:sk", JSON.stringify(jwkPriv));
  localStorage.setItem("phi:ecdsa:pk", JSON.stringify(jwkPub));

  return keyPair;
}

/** Export public key as JWK */
export async function exportPublicKeyJwk(): Promise<JsonWebKey> {
  const { publicKey } = await getOrCreateKey();
  return crypto.subtle.exportKey("jwk", publicKey);
}

/** Sign payload and return base64 signature */
export async function signPackage(pkg: TransferPackage): Promise<string> {
  const { privateKey } = await getOrCreateKey();
  const data = new TextEncoder().encode(stableStringify(pkg));
  const sig = await crypto.subtle.sign(SIG, privateKey, data);
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

/** Verify signature against payload and public JWK */
export async function verifyPackage(pkg: TransferPackage, b64sig: string, jwkPub: JsonWebKey): Promise<boolean> {
  const publicKey = await crypto.subtle.importKey("jwk", jwkPub, ALG, true, ["verify"]);
  const data = new TextEncoder().encode(stableStringify(pkg));
  const sig = Uint8Array.from(atob(b64sig), c => c.charCodeAt(0));
  return crypto.subtle.verify(SIG, publicKey, sig, data);
}
