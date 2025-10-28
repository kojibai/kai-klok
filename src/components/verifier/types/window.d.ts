// src/components/verifier/types/window.d.ts
/* ────────────────────────────────────────────────────────────────
   Global window augmentation for Verifier
   NOTE: Keep in sync with native code. Avoid `any`; use `unknown`.
────────────────────────────────────────────────────────────────── */

import type { SigilMetadata } from "./local";

declare global {
  interface Window {
    KKVerifier?:
      | {
          /** Bridge used by Note printer modal to fetch payload on demand. */
          getNoteData?: () => Promise<unknown> | unknown;
        }
      | undefined;

    /** Optional verifying key snapshot that may be injected at runtime. */
    SIGIL_ZK_VKEY?: unknown;

    /** Optional ZK helpers the host app can provide. */
    SIGIL_ZK?: {
      provideSendProof?: (args: {
        meta: SigilMetadata;
        /** Hash of sender-side leaf (pre-receive). */
        leafHash: string;
        /** Head-window Merkle root before this transfer. */
        previousHeadRoot: string;
        /** Transfer nonce (b64url or hex). */
        nonce: string;
      }) => Promise<
        | {
            proof: unknown;
            publicSignals: unknown;
            vkey?: unknown;
          }
        | null
      >;

      provideReceiveProof?: (args: {
        meta: SigilMetadata;
        /** Hash of full leaf after receive. */
        leafHash: string;
        /** Head-window Merkle root before this transfer. */
        previousHeadRoot: string;
        /** Sender link signature (hardened link). */
        linkSig: string;
      }) => Promise<
        | {
            proof: unknown;
            publicSignals: unknown;
            vkey?: unknown;
          }
        | null
      >;
    };

    /** Optional global registry for UI integrations. */
    __SIGIL__?:
      | {
          /** Optional deep-link reg (used by explorer/rotation). */
          registerSigilUrl?: (url: string) => void;
          /** Optional send recorder hook. */
          registerSend?: (rec: unknown) => void;
        }
      | undefined;
  }
}

export {};
