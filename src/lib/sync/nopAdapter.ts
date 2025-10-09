// src/lib/sync/nopAdapter.ts
// ────────────────────────────────────────────────────────────────
// Noop IPFS Adapter — "offline / sovereign" path
// Implements IpfsLike but discards data (never publishes).
// Useful for production builds where no external network is allowed.
// ────────────────────────────────────────────────────────────────

import type { IpfsLike, PublishResult } from "./ipfsAdapter";

/**
 * A no-op implementation of the IpfsLike interface.
 * It satisfies the interface but never actually publishes.
 */
export const NoopIpfs: IpfsLike = {
  async publish(_buf: Uint8Array): Promise<PublishResult> {
    // Explicitly mark the argument as unused to satisfy ESLint
    void _buf;

    // Always return a dummy CID to indicate "nothing published"
    return { headCid: "" };
  },
};
