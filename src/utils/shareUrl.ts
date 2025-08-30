// src/utils/shareUrl.ts
export function base64urlJson(obj: unknown): string {
    const json = JSON.stringify(obj);
    // btoa expects binary string → encodeURIComponent first for UTF-8 safety
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }
  
  export function rewriteUrlPayload(baseUrl: string, enriched: object, token?: string): string {
    const u = new URL(baseUrl, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    u.searchParams.set("p", base64urlJson(enriched));
    if (token) u.searchParams.set("t", token);
    return u.toString();
  }
  