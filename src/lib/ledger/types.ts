export type MintEntry = {
    v: 1;
    pulse: number;
    beat: number;
    stepIndex: number;
    chakraDay: "Root"|"Sacral"|"Solar Plexus"|"Heart"|"Throat"|"Third Eye"|"Crown";
    stepsPerBeat: number;
    kaiSignature?: string;  // optional cosmetic
    userPhiKey?: string;    // optional cosmetic
    ts?: string;            // ISO
  };
  
  export type MerkleLeaf = { hash: string; }; // blake3 hex of canonical MintEntry
  export type MerkleRoot = string;            // blake3 hex
  export type MerkleProof = { path: Array<{dir:"L"|"R"; hash:string}> };
  
  export type LedgerV1 = {
    v: 1;
    leaves: MerkleLeaf[];   // deterministic order of mints
    root: MerkleRoot;
    lastPulse: number;      // monotonic for de-forking
  };
  
  export type PackedLedgerV1 = {
    v: 1;
    codec: "gzip+base64";
    payload: string;        // gz(b64(json(LedgerV1)))
  };
  