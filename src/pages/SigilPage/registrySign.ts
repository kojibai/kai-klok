import type { SigilPayload } from "../../types/sigil";
import { buildClaim, requestRegistrySignature, appendAttestationToUrl, embedAttestationInSvg } from "./registry";

/**
 * Signs a claim with the registry and appends/embeds the attestation.
 * Returns a (possibly) updated absolute URL.
 */
export async function signAndAttach(
  meta: SigilPayload,
  canonical: string,
  token: string,
  baseUrl: string,
  svgEl?: SVGSVGElement | null
): Promise<string> {
  try {
    const claim = buildClaim(meta, canonical, token);
    const signed = await requestRegistrySignature(claim);
    if (!signed) return baseUrl;

    const u = new URL(baseUrl, window.location.origin);
    appendAttestationToUrl(u, signed.r, signed.s, signed.kid);

    if (svgEl) embedAttestationInSvg(svgEl, claim, signed.s, signed.kid);

    return u.toString();
  } catch {
    return baseUrl;
  }
}
