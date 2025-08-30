// src/components/VerifierStamper/keys.ts
import { b64u } from "./crypto";

export type Keypair = { priv: CryptoKey; pub: CryptoKey; spkiB64u: string };

const KEY_PRIV = "kairos:key:pkcs8";
const KEY_PUB = "kairos:key:spki";

const algo = { name: "ECDSA", namedCurve: "P-256" } as const;
const sigParams = { name: "ECDSA", hash: "SHA-256" } as const;

function u8ToBuf(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

async function importPriv(pkcs8: ArrayBuffer) {
  return crypto.subtle.importKey("pkcs8", pkcs8, algo, true, ["sign"]);
}
async function importPub(spki: ArrayBuffer) {
  return crypto.subtle.importKey("spki", spki, algo, true, ["verify"]);
}

async function exportPriv(pk: CryptoKey): Promise<string> {
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", pk);
  return b64u.encode(new Uint8Array(pkcs8));
}
async function exportPub(pk: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey("spki", pk);
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
      const priv = await importPriv(u8ToBuf(b64u.decode(pkcs8B64)));
      const pub = await importPub(u8ToBuf(b64u.decode(spkiB64)));
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
  const sig = await crypto.subtle.sign(sigParams, priv, msg);
  return b64u.encode(new Uint8Array(sig));
}

export async function verifySig(pubB64u: string, msg: Uint8Array, sigB64u: string): Promise<boolean> {
  const pub = await importPub(u8ToBuf(b64u.decode(pubB64u)));
  const sig = b64u.decode(sigB64u);
  return crypto.subtle.verify(sigParams, pub, sig, msg);
}

// Ensure named exports are visible to the module loader
export { importPriv, importPub };
