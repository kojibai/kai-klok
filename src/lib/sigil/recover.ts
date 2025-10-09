// utils/parsePackedLedger.ts
import type { LedgerV1, PackedLedgerV1 } from "../ledger/types";
import { gunzipSync } from "fflate";

/** Convert standard or URL-safe base64 to a Uint8Array */
function b64ToUint8(b64: string): Uint8Array {
  // normalize URL-safe base64 ( -_, no padding ) → standard ( +/, with padding )
  let s = b64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);

  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Parse a gzip+base64 packed ledger into a typed object */
export function parsePackedLedger(input: string | PackedLedgerV1): LedgerV1 {
  const b64gz = typeof input === "string" ? input : input.payload;

  const gzBytes = b64ToUint8(b64gz);
  const decompressed = gunzipSync(gzBytes);

  const json = new TextDecoder().decode(decompressed);
  const ledger = JSON.parse(json) as LedgerV1;

  // (optional) quick sanity checks to catch wrong payloads early
  if (ledger?.v !== 1) throw new Error("Unsupported ledger version");
  if (!("root" in ledger) || !("leaves" in ledger)) {
    throw new Error("Malformed LedgerV1 payload");
  }
  return ledger;
}
