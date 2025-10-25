// src/components/VerifierStamper/keys.ts
import { b64u } from "./crypto";

export type Keypair = { priv: CryptoKey; pub: CryptoKey; spkiB64u: string };

const KEY_PRIV = "kairos:key:pkcs8";
const KEY_PUB = "kairos:key:spki";

const algo = { name: "ECDSA", namedCurve: "P-256" } as const;
const sigParams = { name: "ECDSA", hash: "SHA-256" } as const;

/**
 * Create a fresh ArrayBuffer copy from any Uint8Array, guaranteeing the
 * backing buffer is a real ArrayBuffer (not SharedArrayBuffer/ArrayBufferLike).
 */
function u8ToBuf(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}

async function importPriv(pkcs8: ArrayBuffer) {
  // WebCrypto accepts BufferSource; we pass a clean ArrayBuffer.
  return crypto.subtle.importKey("pkcs8", pkcs8, algo, true, ["sign"]);
}
async function importPub(spki: ArrayBuffer) {
  return crypto.subtle.importKey("spki", spki, algo, true, ["verify"]);
}

async function exportPriv(pk: CryptoKey): Promise<string> {
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", pk); // ArrayBuffer
  return b64u.encode(new Uint8Array(pkcs8));
}
async function exportPub(pk: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey("spki", pk); // ArrayBuffer
  return b64u.encode(new Uint8Array(spki));
}

async function createKeypair(): Promise<Keypair> {
  const pair = await crypto.subtle.generateKey(algo, true, ["sign", "verify"]);
  const spkiB64u = await exportPub(pair.publicKey);
  return { priv: pair.privateKey, pub: pair.publicKey, spkiB64u };
}

export async function loadOrCreateKeypair(): Promise<Keypair> {
  try {
    const pkcs8B64 = localStorage.getItem(KEY_PRIV);
    const spkiB64 = localStorage.getItem(KEY_PUB);

    if (pkcs8B64 && spkiB64) {
      // Decode → force real ArrayBuffer → import
      const privBytes = b64u.decode(pkcs8B64); // Uint8Array<ArrayBufferLike>
      const pubBytes = b64u.decode(spkiB64);   // Uint8Array<ArrayBufferLike>
      const priv = await importPriv(u8ToBuf(privBytes));
      const pub = await importPub(u8ToBuf(pubBytes));
      return { priv, pub, spkiB64u: spkiB64 };
    }

    const kp = await createKeypair();
    localStorage.setItem(KEY_PRIV, await exportPriv(kp.priv));
    localStorage.setItem(KEY_PUB, kp.spkiB64u);
    return kp;
  } catch {
    // Fallback (no localStorage, private mode, etc.): ephemeral in-memory keys
    return createKeypair();
  }
}

export async function signB64u(priv: CryptoKey, msg: Uint8Array): Promise<string> {
  // Pass an explicit ArrayBuffer to satisfy strict BufferSource typing.
  const msgBuf = u8ToBuf(msg);
  const sig = await crypto.subtle.sign(sigParams, priv, msgBuf);
  return b64u.encode(new Uint8Array(sig));
}

export async function verifySig(pubB64u: string, msg: Uint8Array, sigB64u: string): Promise<boolean> {
  const pubBytes = b64u.decode(pubB64u);   // Uint8Array<ArrayBufferLike>
  const pub = await importPub(u8ToBuf(pubBytes));

  const sigBytes = b64u.decode(sigB64u);   // Uint8Array<ArrayBufferLike>
  const sigBuf = u8ToBuf(sigBytes);
  const msgBuf = u8ToBuf(msg);

  return crypto.subtle.verify(sigParams, pub, sigBuf, msgBuf);
}

// Ensure named exports are visible to the module loader
export { importPriv, importPub };
