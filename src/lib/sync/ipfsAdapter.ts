// lib/sync/ipfsAdapter.ts
// Minimal IPFS HTTP adapter that implements: export interface IpfsLike { publish(buf: Uint8Array): Promise<{ headCid: string }> }

export type PublishResult = { headCid: string };

export interface IpfsLike {
  publish(buf: Uint8Array): Promise<PublishResult>;
}

/**
 * Options for the HTTP adapter.
 * - endpoint: base URL of an IPFS API endpoint, e.g. "https://ipfs.infura.io:5001"
 * - authToken: optional Bearer token for providers that require auth
 * - requestInit: optional extra fetch init (headers, mode, etc.)
 */
export type IpfsHttpOptions = {
  endpoint: string;
  authToken?: string;
  requestInit?: Omit<RequestInit, "method" | "body" | "headers"> & {
    headers?: Record<string, string>;
  };
};

/** Shapes seen from /api/v0/add responses (single file case). */
type IpfsAddLegacy = { Name?: string; Hash?: string; Size?: string };
type IpfsAddCidObject = { "/": string };
type IpfsAddModern = { Name?: string; Cid?: IpfsAddCidObject; Size?: string };
type IpfsAddResponse = IpfsAddLegacy & IpfsAddModern;

/**
 * Create an IpfsLike that talks to a standard IPFS HTTP API (`/api/v0/add`).
 * It sends a multipart/form-data request containing the bytes and returns the CID.
 */
export function createIpfsHttpAdapter(opts: IpfsHttpOptions): IpfsLike {
  const { endpoint, authToken, requestInit } = opts;

  // Normalize endpoint (drop trailing slash)
  const base = endpoint.replace(/\/+$/, "");
  const addUrl = `${base}/api/v0/add?pin=true&cid-version=1&raw-leaves=true`;

  return {
    async publish(buf: Uint8Array): Promise<PublishResult> {
      // Build a multipart/form-data body with the bytes as a file part
      const form = new FormData();
      const blob = new Blob([buf], { type: "application/octet-stream" });
      // Always append as Blob; filename allowed when value is a Blob.
      form.append("file", blob, "payload.bin");

      const headers: Record<string, string> = {
        ...(requestInit?.headers ?? {}),
      };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const res = await fetch(addUrl, {
        method: "POST",
        body: form,
        ...requestInit,
        headers,
      });

      if (!res.ok) {
        let detail = "";
        try {
          detail = await res.text();
        } catch {
          /* ignore */
        }
        throw new Error(
          `[ipfsAdapter] HTTP ${res.status} ${res.statusText} while adding file${
            detail ? ` — ${detail}` : ""
          }`
        );
      }

      // IPFS can stream multiple JSON lines; parse the last non-empty one.
      const text = await res.text();
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length === 0) {
        throw new Error("[ipfsAdapter] Empty response from IPFS add");
      }

      const last: IpfsAddResponse = JSON.parse(lines[lines.length - 1]) as IpfsAddResponse;

      const cidFromLegacy = typeof last.Hash === "string" ? last.Hash : undefined;
      const cidFromModern =
        last.Cid && typeof last.Cid["/"] === "string" ? last.Cid["/"] : undefined;

      const cid = cidFromLegacy ?? cidFromModern;

      if (!cid) {
        throw new Error("[ipfsAdapter] Could not parse CID from IPFS add response");
      }

      return { headCid: cid };
    },
  };
}

/**
 * Default export: an adapter configured from environment variables.
 * - NEXT_PUBLIC_IPFS_API or IPFS_API for endpoint
 * - NEXT_PUBLIC_IPFS_AUTH or IPFS_AUTH for bearer token
 *
 * Example endpoint values:
 *   - "https://ipfs.infura.io:5001"
 *   - "https://api.web3.storage"
 */
const DEFAULT_ENDPOINT =
  (typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_IPFS_API || process.env.IPFS_API)) ||
  "https://ipfs.infura.io:5001";

const DEFAULT_AUTH =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_IPFS_AUTH || process.env.IPFS_AUTH
    : undefined;

export const ipfs: IpfsLike = createIpfsHttpAdapter({
  endpoint: DEFAULT_ENDPOINT,
  authToken: DEFAULT_AUTH,
});

/**
 * A tiny in-memory "nop" adapter useful for offline/dev.
 * It returns a deterministic pseudo-CID for the given bytes and stores them
 * in a local Map so you can retrieve them later if needed (e.g., for tests).
 */
export function createNopAdapter(): IpfsLike & {
  store: Map<string, Uint8Array>;
} {
  const store = new Map<string, Uint8Array>();
  let seq = 0;

  // Cheap, deterministic pseudo-hash (NOT a real CID! For offline/testing only)
  const pseudoCid = (bytes: Uint8Array): string => {
    // FNV-1a 32-bit
    let h = 0x811c9dc5 >>> 0;
    for (let i = 0; i < bytes.length; i++) {
      h ^= bytes[i];
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return `inmem-${(++seq).toString(36)}-${h.toString(16).padStart(8, "0")}`;
  };

  return {
    store,
    async publish(buf: Uint8Array): Promise<PublishResult> {
      const id = pseudoCid(buf);
      store.set(id, buf);
      return { headCid: id };
    },
  };
}

export const ipfsNop = createNopAdapter();
