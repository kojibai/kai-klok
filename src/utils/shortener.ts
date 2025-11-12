// src/utils/shortener.ts
// Sovereign shortener client with robust fallbacks (no `any`)

/** Successful response contract from PSHORT API */
export type ShortenResponse = { url: string };

/** Resolve PSHORT origin from window or Vite env (trimmed; empty if absent) */
function resolvePSHORT(): string {
  try {
    // Read optional runtime global without declaring it globally here
    const g =
      typeof window !== "undefined"
        ? (window as unknown as { __PSHORT__?: string }).__PSHORT__
        : undefined;

    // Read Vite env without redeclaring ImportMetaEnv here
    let v: string | undefined;
    if (typeof import.meta !== "undefined") {
      const env = (import.meta as unknown as {
        env?: Record<string, string | undefined>;
      }).env;
      v = env?.VITE_PSHORT;
    }

    return (g?.trim() || v?.trim() || "");
  } catch {
    return "";
  }
}

const PSHORT: string = resolvePSHORT();

/** Base URL resolved against PSHORT or current origin */
function shortBase(): URL {
  try {
    if (PSHORT) return new URL("/", PSHORT);
  } catch {
    /* ignore invalid PSHORT */
  }
  const href =
    typeof window !== "undefined" ? window.location.href : "https://example.com";
  return new URL("/", href);
}

/** Path-only alias (no API): https://PSHORT/p~<token> */
function pathOnlyShort(token: string): string {
  const base = shortBase();
  base.pathname = `/p~${encodeURIComponent(token)}`;
  base.search = "";
  base.hash = "";
  return base.toString();
}

/** Type guard for ShortenResponse */
function isShortenResponse(x: unknown): x is ShortenResponse {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { url?: unknown }).url === "string"
  );
}

/**
 * Try POST /api/shorten on PSHORT; fall back to path-only /p~<token>.
 * Server may embed `parent` into the short mapping for threading.
 */
export async function shortenToken(
  token: string,
  parent?: string | undefined,
): Promise<string> {
  // Fast exit if PSHORT isn’t configured (don’t delay share UX)
  if (!PSHORT) return pathOnlyShort(token);

  const endpoint = new URL("/api/shorten", shortBase());
  const ctrl = new AbortController();
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => ctrl.abort(), 2500);

  try {
    const res = await fetch(endpoint.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, parent }),
      signal: ctrl.signal,
      credentials: "omit",
      cache: "no-store",
    });

    if (!res.ok) throw new Error(String(res.status));

    const data: unknown = await res.json();
    if (isShortenResponse(data) && data.url.startsWith("http")) {
      return data.url;
    }
    return pathOnlyShort(token);
  } catch {
    return pathOnlyShort(token);
  } finally {
    clearTimeout(timer);
  }
}
