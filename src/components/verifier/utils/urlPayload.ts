// src/components/verifier/utils/urlPayload.ts
/* ────────────────────────────────────────────────────────────────
   urlPayload.ts
   • rewriteUrlPayload(): attach ?p= (sigil share payload),
     + optional ?t= token, ?h= encoded history
   • Always uses base64urlJson from sigilUtils
────────────────────────────────────────────────────────────────── */

import { base64urlJson } from "../../VerifierStamper/sigilUtils";
import type { SigilSharePayloadLoose } from "../../../utils/sigilUrl";

/**
 * Builds a shareable URL containing encoded sigil metadata.
 * Returns absolute URL.
 */
export function rewriteUrlPayload(
  baseUrl: string,
  enriched: SigilSharePayloadLoose & {
    canonicalHash?: string;
    transferNonce?: string;
  },
  token?: string,
  historyParam?: string
): string {
  const origin =
    typeof window !== "undefined" &&
    typeof window.location?.origin === "string"
      ? window.location.origin
      : "http://localhost";

  const u = new URL(baseUrl, origin);

  u.searchParams.set("p", base64urlJson(enriched));
  if (token) u.searchParams.set("t", token);
  if (historyParam && historyParam.length > 0) {
    u.searchParams.set("h", historyParam);
  }

  return u.toString();
}
