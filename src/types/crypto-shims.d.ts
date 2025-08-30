// Ambient stubs for crypto libs used in kai.ts
// They’re *minimal*: only what the project actually calls.

/* ── circomlibjs ─────────────────────────────────────────────── */
declare module "circomlibjs" {
    /** Poseidon hash – deterministic field hash. */
    export function poseidon(inputs: bigint[]): bigint;
  
    /** Basic prime-field helper (we only call `toString`). */
    export class F1Field {
      constructor(prime: bigint);
      toString(x: bigint): string;
    }
  }
  
  /* ── @noble/hashes helpers ───────────────────────────────────── */
  declare module "@noble/hashes/utils" {
    /** Converts a byte array to lower-case hex. */
    export function bytesToHex(bytes: Uint8Array): string;
  }
  
  declare module "@noble/hashes/blake3" {
    /** Pure-JS BLAKE3 – returns 32-byte hash. */
    export function blake3(input: Uint8Array | string): Uint8Array;
  }
  
/* poseidon-lite type stub – no `any`, full signature */
declare module "poseidon-lite" {
    export function poseidon(inputs: bigint[]): bigint;
    const _default: typeof poseidon;
    export default _default;
  }
  