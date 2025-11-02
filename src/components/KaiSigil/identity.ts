import { base58CheckEncode, sha256 } from "./crypto";

export async function deriveCreatorIdentity(opts: {
  creatorPublicKey?: string;
  userPhiKey?: string;
  kaiSignature?: string;
  origin?: string;
  pulse: number;
  beat: number;
  chakraDay: string;
  stepIndex: number;
}): Promise<{ creator: string; creatorId: string; creatorAlg: string }> {
  const {
    creatorPublicKey,
    userPhiKey,
    kaiSignature,
    origin,
    pulse,
    beat,
    chakraDay,
    stepIndex,
  } = opts;
  if (creatorPublicKey)
    return {
      creator: `did:key:${creatorPublicKey}`,
      creatorId: creatorPublicKey,
      creatorAlg: "did:key",
    };
  if (userPhiKey)
    return {
      creator: `phi:${userPhiKey}`,
      creatorId: userPhiKey,
      creatorAlg: "phi-b58chk",
    };
  if (kaiSignature) {
    const sigBytes = await sha256(kaiSignature);
    const phiLike = await base58CheckEncode(sigBytes.slice(0, 20));
    return {
      creator: `phi:${phiLike}`,
      creatorId: phiLike,
      creatorAlg: "sig→sha256→b58chk",
    };
  }
  const seed = await sha256(
    `anon:${origin ?? ""}:${pulse}|${beat}|${chakraDay}|${stepIndex}`
  );
  const anon = await base58CheckEncode(seed.slice(0, 20));
  return { creator: `anon:${anon}`, creatorId: anon, creatorAlg: "anon-b58chk" };
}

export function jwkToJSONLike(jwk: JsonWebKey): { [k: string]: string | boolean | string[] | undefined } {
  const out: { [k: string]: string | boolean | string[] | undefined } = {};
  const prim = ["kty","crv","alg","kid","x","y","n","e","d","p","q","dp","dq","qi"] as const;
  for (const k of prim) {
    const v = (jwk as Record<string, unknown>)[k];
    if (typeof v === "string") out[k] = v;
  }
  if (Array.isArray(jwk.key_ops)) out.key_ops = jwk.key_ops.map((op) => String(op));
  if (typeof jwk.ext === "boolean") out.ext = jwk.ext;
  return out;
}