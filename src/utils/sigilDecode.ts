// src/utils/sigilDecode.ts
// STRICT: no 'any', no empty catches, production-safe

export interface MediaRef {
    kind: "url" | "svg" | "png" | "audio" | "video" | "pdf";
    url: string;
    sha256?: string;
  }
  
  export interface PostPayload {
    title?: string;
    text?: string;
    tags?: string[];
    media?: MediaRef[];
  }
  
  export interface MessagePayload {
    toUserId: string;
    text: string;
    media?: Array<Pick<MediaRef, "kind" | "url">>;
    threadId?: string;
  }
  
  export interface SharePayload {
    refUrl: string;
    note?: string;
  }
  
  export interface ReactionPayload {
    refUrl: string;
    emoji?: string;
    value?: number;
  }
  
  /** Legacy short keys present in compact capsules. */
  interface LegacyShorts {
    u?: number; // pulse
    b?: number; // beat
    s?: number; // stepIndex
    c?: string | number; // chakraDay
  }
  
  /** Canonical capsule shape (extensible with unknown extras). */
  export interface Capsule extends LegacyShorts {
    pulse?: number;
    beat?: number;
    stepIndex?: number;
    chakraDay?: string | number;
  
    userPhiKey?: string;
    userId?: string;
    kaiSignature?: string;
    timestamp?: string;
  
    appId?: string;
    kind?: string;
    nonce?: string;
  
    post?: PostPayload;
    message?: MessagePayload;
    share?: SharePayload;
    reaction?: ReactionPayload;
  
    /** Legacy/aux fields tolerated but not relied on. */
    work?: Record<string, unknown>;
    w?: Record<string, unknown>;
  
    /** Allow forward-compatible fields without loosening types globally. */
    [k: string]: unknown;
  }
  
  export interface DecodeOk {
    ok: true;
    data: {
      url: string;
      appId?: string;
      userId?: string;
      kind?: string;
      pulse?: number;
      beat?: number;
      stepIndex?: number;
      chakraDay?: string | number;
      capsule: Capsule;
      path: string[];
    };
  }
  
  export interface DecodeErr {
    ok: false;
    error: string;
  }
  
  type DecodeResult = DecodeOk | DecodeErr;
  
  /* ---------- helpers (strict, no any) ---------- */
  
  function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }
  
  function isNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
  }
  
  function isString(value: unknown): value is string {
    return typeof value === "string";
  }
  
  function normalizeBase64(input: string): string {
    // Accepts standard and base64url; pads to length % 4 === 0
    const isBase64Url = input.includes("-") || input.includes("_");
    let s = isBase64Url ? input.replace(/-/g, "+").replace(/_/g, "/") : input;
    const pad = s.length % 4;
    if (pad === 2) s += "==";
    else if (pad === 3) s += "=";
    else if (pad !== 0 && pad !== 1) {
      // pad===1 is actually invalid length; we still pass to atob and let it fail.
      // No throw here; failure is handled by caller.
    }
    return s;
  }
  
  function base64DecodeUtf8(b64: string): string {
    const payload = b64.startsWith("c:") ? b64.slice(2) : b64;
    const normalized = normalizeBase64(payload);
    try {
      // Browser-safe: atob + TextDecoder
      const binary = atob(normalized);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const decoded = new TextDecoder().decode(bytes);
      return decoded;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Base64 decode failure";
      throw new Error(message);
    }
  }
  
  function parseJson<T>(text: string): T {
    try {
      return JSON.parse(text) as T;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Invalid JSON";
      throw new Error(message);
    }
  }
  
  /* ---------- main API ---------- */
  
  export function decodeSigilUrl(url: string): DecodeResult {
    try {
      const u = new URL(url, window.location.origin);
      const pParam = u.searchParams.get("p");
      if (!pParam) {
        return { ok: false, error: "No ?p= payload" };
      }
  
      // Decode payload
      const jsonText = base64DecodeUtf8(pParam);
      const parsedUnknown = parseJson<unknown>(jsonText);
  
      if (!isObject(parsedUnknown)) {
        return { ok: false, error: "Payload is not an object" };
      }
  
      // Narrow to Capsule (tolerant to extra fields)
      const parsed = parsedUnknown as Capsule;
  
      // Resolve fields with short/long key support
      const pulse = isNumber(parsed.pulse) ? parsed.pulse : isNumber(parsed.u) ? parsed.u : undefined;
      const beat = isNumber(parsed.beat) ? parsed.beat : isNumber(parsed.b) ? parsed.b : undefined;
      const stepIndex = isNumber(parsed.stepIndex) ? parsed.stepIndex : isNumber(parsed.s) ? parsed.s : undefined;
      const chakraDay =
        isString(parsed.chakraDay) || isNumber(parsed.chakraDay)
          ? parsed.chakraDay
          : isString(parsed.c) || isNumber(parsed.c)
            ? parsed.c
            : undefined;
  
      const path = u.pathname.split("/").filter(Boolean);
      const appId = path[0] === "s" && path.length >= 2 ? path[1] : undefined;
  
      const userId =
        isString(parsed.userId) ? parsed.userId : isString(parsed.userPhiKey) ? parsed.userPhiKey : undefined;
  
      const kindFromPayload = isString(parsed.kind)
        ? parsed.kind
        : parsed.post
          ? "post"
          : parsed.message
            ? "message"
            : parsed.share
              ? "share"
              : parsed.reaction
                ? "reaction"
                : undefined;
  
      const kindFromPath = path.length >= 8 ? path[6] : undefined;
      const kind = kindFromPayload ?? kindFromPath;
  
      const capsule: Capsule = {
        ...parsed,
        pulse,
        beat,
        stepIndex,
        chakraDay,
        // Keep original keys too; callers can read either.
      };
  
      return {
        ok: true,
        data: {
          url,
          appId,
          userId,
          kind,
          pulse,
          beat,
          stepIndex,
          chakraDay,
          capsule,
          path,
        },
      };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Decode error";
      return { ok: false, error: message };
    }
  }
  