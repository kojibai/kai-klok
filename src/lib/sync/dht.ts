import type { IpfsLike } from "./ipfsAdapter";

export type DhtBlock = {
  headCid: string;          // may be ""
  prevCid?: string;
  ipns?: string;            // self-certifying name (optional)
  headSig?: string;         // base64url(sig over headCid||merkleRoot||pulse)
  pubKeyJwk?: JsonWebKey;
  peersHint?: string[];     // optional bootstrap multiaddrs
};

export async function buildDhtBlock(opts: {
  ipfs: IpfsLike;
  packedLedgerBytes: Uint8Array;
  prevCid?: string;
  sign?: (msg: Uint8Array) => Promise<Uint8Array>;
  pubKeyJwk?: JsonWebKey;
  merkleRoot: string;
  pulse: number;
}): Promise<DhtBlock> {
  const { ipfs, packedLedgerBytes, prevCid, sign, pubKeyJwk, merkleRoot, pulse } = opts;
  const { headCid } = await ipfs.publish(packedLedgerBytes).catch(() => ({ headCid: "" }));
  let headSig = "";
  if (headCid && sign) {
    const msg = new TextEncoder().encode(`${headCid}|${merkleRoot}|${pulse}`);
    const sig = await sign(msg);
    headSig = b64url(sig);
  }
  return { headCid, prevCid, headSig, pubKeyJwk };
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
