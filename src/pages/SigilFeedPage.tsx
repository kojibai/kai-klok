// /src/pages/SigilFeedPage.tsx
"use client";

/**
 * Glyph Stream — payload-aware feed + Reply Composer (mobile-first, overflow-safe)
 * - Accepts payload links:       /feed/p/<base64url-token>
 * - Replies require *fresh* sigil verification in this session
 * - Reply link form:             /feed/p/<token>?add=<parent>  (thread continuity)
 * - Never shows Chronos; renders Kai pulse & lattice info only.
 *
 * Notes for CSS:
 * - Page root uses .sf (already themed across app); keep everything fluid.
 * - No fixed widths. Prefer max-width and safe-area padding on containers.
 * - Ensure word wrapping on long URLs/text (word-break: break-word; overflow-wrap: anywhere).
 * - Prevent horizontal scrolling: html, body, .sf should not exceed 100vw; use overflow-x: hidden/clip.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import FeedCard from "../components/FeedCard";
import "./SigilFeedPage.css";

import {
  decodeFeedPayload,
  extractPayloadToken,
  encodeFeedPayload,
  type FeedPostPayload,
} from "../utils/feedPayload";

import {
  momentFromPulse,
  momentFromUTC,
  type KaiMoment,
} from "../utils/kai_pulse";

import { useSigilAuth } from "../components/KaiVoh/SigilAuthContext";
import SigilLogin from "../components/KaiVoh/SigilLogin";

/** ---------- Local types & constants ---------- */

type Source = { url: string };

const LS_KEY = "sf-links";
const SESSION_VERIFIED_PREFIX = "sf.verifiedSession:";

/** ---------- Utilities (pure) ---------- */

function parseStringArray(input: string | null): string[] {
  if (!input) return [];
  try {
    const parsed: unknown = JSON.parse(input);
    return Array.isArray(parsed) && parsed.every((v) => typeof v === "string")
      ? (parsed as string[])
      : [];
  } catch {
    return [];
  }
}

async function loadLinksJson(): Promise<Source[]> {
  try {
    const r = await fetch("/links.json", { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const data: unknown = await r.json();
    if (
      Array.isArray(data) &&
      data.every(
        (row) => row && typeof row === "object" && typeof (row as Source).url === "string",
      )
    ) {
      return data as Source[];
    }
    return [];
  } catch {
    return [];
  }
}

function prependUniqueToStorage(urls: string[]): void {
  try {
    const current = parseStringArray(localStorage.getItem(LS_KEY));
    const seen = new Set(current);
    const fresh = urls.filter((u) => !seen.has(u));
    if (fresh.length === 0) return;
    localStorage.setItem(LS_KEY, JSON.stringify([...fresh, ...current]));
  } catch {
    /* ignore storage failures */
  }
}

function kaiLabel(k: KaiMoment): string {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `Kai ${k.beat}:${pad2(k.stepIndex)} — ${k.weekday} • ${k.chakraDay}`;
}

function buildFeedUrl(token: string): string {
  const base = new URL("/", window.location.href);
  base.pathname = `/feed/p/${token}`.replace(/\/{2,}/g, "/");
  base.search = "";
  base.hash = "";
  return base.toString();
}

function currentPayloadUrl(): string | null {
  if (typeof window === "undefined") return null;
  const token = extractPayloadToken(window.location.pathname);
  if (!token) return null;
  return buildFeedUrl(token);
}

function isLikelySigilUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return (url.protocol === "https:" || url.protocol === "http:") && url.search.includes("p=");
  } catch {
    return false;
  }
}

function readStringProp(obj: unknown, key: string): string | undefined {
  if (typeof obj !== "object" || obj === null) return undefined;
  const o = obj as Record<string, unknown>;
  const direct = o[key];
  if (typeof direct === "string") return direct;
  const meta = o["meta"];
  if (typeof meta === "object" && meta !== null) {
    const mv = (meta as Record<string, unknown>)[key];
    if (typeof mv === "string") return mv;
  }
  return undefined;
}

function extractSigilActionUrlFromSvgText(
  svgText?: string | null,
  metaCandidate?: Record<string, unknown>,
): string | undefined {
  if (!svgText) return undefined;

  const keys = [
    "sigilActionUrl",
    "sigilUrl",
    "actionUrl",
    "url",
    "claimedUrl",
    "loginUrl",
    "sourceUrl",
    "originUrl",
    "link",
    "href",
  ];

  const isHttp = (s: unknown): s is string => {
    if (typeof s !== "string" || !s) return false;
    try {
      const u = new URL(s);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  };

  if (metaCandidate) {
    for (const k of keys) {
      const v = (metaCandidate as Record<string, unknown>)[k];
      if (isHttp(v)) return v;
    }
  }

  try {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");

    for (const el of Array.from(doc.getElementsByTagName("metadata"))) {
      const raw = (el.textContent ?? "").trim();
      if (!raw) continue;
      const peeled = raw.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
      try {
        const obj = JSON.parse(peeled) as unknown;
        if (typeof obj === "object" && obj !== null) {
          for (const k of keys) {
            const v = (obj as Record<string, unknown>)[k];
            if (isHttp(v)) return v;
          }
        }
      } catch {
        const m = peeled.match(/https?:\/\/[^\s"'<>)#]+/i);
        if (m && isHttp(m[0])) return m[0];
      }
    }

    for (const a of Array.from(doc.getElementsByTagName("a"))) {
      const href = a.getAttribute("href") || a.getAttribute("xlink:href");
      if (isHttp(href)) return href!;
    }
  } catch {
    /* ignore parse issues */
  }

  return undefined;
}

/** ---------- Component ---------- */

export default function SigilFeedPage() {
  /** ---------- Data ---------- */
  const [sources, setSources] = useState<Source[]>([]);

  // Payload context if we arrived via /feed/p/<token>
  const [payload, setPayload] = useState<FeedPostPayload | null>(null);
  const [payloadKai, setPayloadKai] = useState<KaiMoment | null>(null);
  const [payloadError, setPayloadError] = useState<string | null>(null);

  /** ---------- Auth (session-gated identity) ---------- */
  const { auth } = useSigilAuth();

  const sessionKey = useMemo(() => {
    if (typeof window === "undefined") return `${SESSION_VERIFIED_PREFIX}root`;
    const token = extractPayloadToken(window.location.pathname) || "root";
    return `${SESSION_VERIFIED_PREFIX}${token}`;
  }, []);

  const [verifiedThisSession, setVerifiedThisSession] = useState<boolean>(() => {
    try {
      return typeof window !== "undefined" && sessionStorage.getItem(sessionKey) === "1";
    } catch {
      return false;
    }
  });

  const composerMeta = useMemo(() => (verifiedThisSession ? auth.meta : null), [verifiedThisSession, auth.meta]);
  const composerSvgText = useMemo(() => (verifiedThisSession ? auth.svgText : null), [verifiedThisSession, auth.svgText]);

  /** ---------- Reply composer state ---------- */
  const [replyText, setReplyText] = useState("");
  const [replyAuthor, setReplyAuthor] = useState("");
  const [replyUrl, setReplyUrl] = useState<string>("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyErr, setReplyErr] = useState<string | null>(null);
  const [replyWarn, setReplyWarn] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  /** ---------- Effects: seed & query handling ---------- */

  useEffect(() => {
    (async () => {
      const seed = await loadLinksJson();
      const stored = parseStringArray(localStorage.getItem(LS_KEY));
      const merged: Source[] = [...stored.map((u) => ({ url: u })), ...seed];

      const seen = new Set<string>();
      const unique = merged.filter(({ url }) => (seen.has(url) ? false : (seen.add(url), true)));
      setSources(unique);
    })();
  }, []);

  // Keep support for ?add=<parent> so reply links can include thread parents.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const adds = params.getAll("add").map((s) => s.trim()).filter(Boolean);
      if (adds.length === 0) return;

      setSources((prev) => {
        const seen = new Set(prev.map((s) => s.url));
        const fresh = adds.filter((u) => !seen.has(u));
        if (fresh.length === 0) return prev;

        prependUniqueToStorage(fresh);
        return [...fresh.map((u) => ({ url: u })), ...prev];
      });
    } catch {
      /* ignore query parsing failures */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = extractPayloadToken(window.location.pathname);
    if (!token) return;

    const decoded = decodeFeedPayload(token);
    if (!decoded) {
      setPayloadError("Invalid or corrupted feed payload.");
      return;
    }

    setPayload(decoded);
    try {
      const k = momentFromPulse(decoded.pulse);
      setPayloadKai(k);
    } catch {
      setPayloadKai(null);
    }

    setSources((prev) => {
      const exists = prev.some((s) => s.url === decoded.url);
      if (exists) return prev;
      prependUniqueToStorage([decoded.url]);
      return [{ url: decoded.url }, ...prev];
    });
  }, []);

  /** ---------- Derived ---------- */

  const urls = useMemo(() => {
    const rest = payload ? sources.filter((s) => s.url !== payload.url) : sources;
    return payload ? [payload.url, ...rest.map((s) => s.url)] : rest.map((s) => s.url);
  }, [sources, payload]);

  const sigilActionUrl = useMemo(() => {
    if (!composerMeta) return "";
    const metaFirst =
      readStringProp(composerMeta as unknown, "sigilActionUrl") ||
      readStringProp(composerMeta as unknown, "sigilUrl") ||
      readStringProp(composerMeta as unknown, "actionUrl") ||
      readStringProp(composerMeta as unknown, "url") ||
      readStringProp(composerMeta as unknown, "claimedUrl") ||
      readStringProp(composerMeta as unknown, "loginUrl") ||
      readStringProp(composerMeta as unknown, "sourceUrl") ||
      readStringProp(composerMeta as unknown, "originUrl") ||
      readStringProp(composerMeta as unknown, "link") ||
      readStringProp(composerMeta as unknown, "href");

    if (metaFirst) return metaFirst;

    const extracted = extractSigilActionUrlFromSvgText(
      composerSvgText,
      composerMeta as unknown as Record<string, unknown>,
    );
    if (extracted) return extracted;

    return "";
  }, [composerMeta, composerSvgText]);

  /** ---------- Actions ---------- */

  const onVerifiedNow = () => {
    setVerifiedThisSession(true);
    try {
      sessionStorage.setItem(sessionKey, "1");
    } catch {
      /* ignore */
    }
  };

  const onGenerateReply = async () => {
    setReplyErr(null);
    setReplyWarn(null);
    setReplyUrl("");
    setReplyBusy(true);

    try {
      if (!verifiedThisSession || !composerMeta) {
        setReplyErr("Verify your sigil in this session to reply.");
        return;
      }

      const actionUrl = (sigilActionUrl || "").trim();
      if (!actionUrl || !isLikelySigilUrl(actionUrl)) {
        setReplyWarn("No canonical sigil action URL detected; proceeding with provided/fallback link.");
      }

      const pulse = momentFromUTC(new Date()).pulse;

      const payloadObj: FeedPostPayload = {
        v: 1,
        url: actionUrl || window.location.origin,
        pulse,
        caption: replyText.trim() ? replyText.trim() : undefined,
        author: replyAuthor.trim() ? replyAuthor.trim() : undefined,
        source: "manual",
        phiKey: composerMeta.userPhiKey ?? undefined,
        kaiSignature: composerMeta.kaiSignature ?? undefined,
        ts: Date.now(),
      };

      const token = encodeFeedPayload(payloadObj);
      let share = buildFeedUrl(token);

      const parent = currentPayloadUrl();
      if (parent) {
        const u = new URL(share);
        u.searchParams.append("add", parent);
        share = u.toString();
      }

      try {
        await navigator.clipboard.writeText(share);
      } catch {
        /* ignore */
      }

      setReplyUrl(share);

      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to generate reply link.";
      setReplyErr(msg);
    } finally {
      setReplyBusy(false);
    }
  };

  /** ---------- Render ---------- */

  return (
    <main
      className="sf"
      style={{
        maxWidth: "100vw",
        overflowX: "clip",
        paddingInline: "max(var(--space-2, 13px), env(safe-area-inset-left, 0px))",
      }}
    >
      <header className="sf-head" role="region" aria-labelledby="glyph-stream-title">
        <h1 id="glyph-stream-title" style={{ wordBreak: "break-word" }}>Glyph Stream</h1>

        {/* Payload banner (no Chronos shown) */}
        {payload ? (
          <div className="sf-payload">
            <div className="sf-payload-line" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
              <span className="sf-pill sf-pill--source">
                {payload.source === "x" ? "From X" : "Manual"}
              </span>
              {payload.author && <span className="sf-pill sf-pill--author">{payload.author}</span>}
              {payload.sigilId && <span className="sf-pill sf-pill--sigil">Sigil {payload.sigilId}</span>}
              {payload.phiKey && <span className="sf-pill sf-pill--phikey">ΦKey {payload.phiKey}</span>}
            </div>

            <div className="sf-payload-core" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
              <strong>Pulse</strong>&nbsp;{payload.pulse}
              {payloadKai && <span className="sf-kai-label"> • {kaiLabel(payloadKai)}</span>}
              {payload.caption && <span className="sf-caption"> — “{payload.caption}”</span>}
            </div>

            <div className="sf-payload-desc">
              This link carries a self-contained payload. The feed decodes it and renders the post.
            </div>
          </div>
        ) : payloadError ? (
          <div className="sf-error" role="alert">{payloadError}</div>
        ) : (
          <p className="sf-sub" style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
            Open a payload link at <code>/feed/p/&lt;token&gt;</code>.  
            Replies are Kai-sealed and automatically add themselves to the feed;  
            threads include parents via the <code>?add=</code> parameter in the reply link.
          </p>
        )}

        {/* Reply Composer (session-gated) */}
        {payload && (
          <section className="sf-reply" aria-labelledby="reply-title">
            <h2 id="reply-title" className="sf-reply-title">Reply</h2>

            {!verifiedThisSession ? (
              <div className="sf-reply-login">
                <p className="sf-sub">Upload your Kai-sealed glyph to post a reply (fresh verification required in this tab).</p>
                <SigilLogin onVerified={onVerifiedNow} />
              </div>
            ) : !composerMeta ? (
              <div className="sf-error" role="alert">
                Verified, but no sigil metadata found. Re-upload your glyph.
              </div>
            ) : (
              <>
                {/* Identity preview (only after fresh verify) */}
                <div className="sf-reply-id" style={{ rowGap: ".4rem", columnGap: ".4rem", display: "flex", flexWrap: "wrap" }}>
                  {composerMeta.userPhiKey && (
                    <span className="sf-pill sf-pill--phikey" title="Your ΦKey (session)">
                      ΦKey {composerMeta.userPhiKey}
                    </span>
                  )}
                  <span className="sf-pill sf-pill--ksig" title="Kai Signature (session)">KSig {composerMeta.kaiSignature}</span>
                </div>

                {/* Optional author handle */}
                <div className="sf-reply-row">
                  <label className="sf-label">
                    Author <span className="sf-muted">(optional)</span>
                  </label>
                  <input
                    className="sf-input"
                    type="text"
                    placeholder="@handle"
                    value={replyAuthor}
                    onChange={(e) => setReplyAuthor(e.target.value)}
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    inputMode="text"
                  />
                </div>

                {/* Reply text */}
                <div className="sf-reply-row">
                  <label className="sf-label">Message</label>
                  <textarea
                    className="sf-textarea"
                    rows={3}
                    placeholder="Type your reply…"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                  />
                </div>

                {/* Sigil action URL preview (locked) */}
                {sigilActionUrl ? (
                  <div className="sf-reply-row">
                    <label className="sf-label">
                      Sigil Action URL <span className="sf-muted">(locked)</span>
                    </label>
                    <input
                      className="sf-input sf-input--locked"
                      type="url"
                      value={sigilActionUrl}
                      readOnly
                    />
                    {!isLikelySigilUrl(sigilActionUrl) && (
                      <div className="sf-warn" role="status">
                        No canonical sigil link found; a fallback will be used.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="sf-warn" role="status">
                    No sigil action URL detected; a fallback will be used.
                  </div>
                )}

                {/* Errors / warnings */}
                {replyErr && <div className="sf-error" role="alert">{replyErr}</div>}
                {replyWarn && !replyErr && <div className="sf-warn" role="status">{replyWarn}</div>}

                {/* Actions */}
                <div className="sf-reply-actions">
                  <button
                    className="sf-btn"
                    onClick={onGenerateReply}
                    disabled={replyBusy}
                    aria-busy={replyBusy}
                  >
                    {replyBusy ? "Sealing…" : "Generate Reply Link"}
                  </button>
                  <button
                    className="sf-btn sf-btn--ghost"
                    onClick={() => {
                      setVerifiedThisSession(false);
                      try {
                        sessionStorage.removeItem(sessionKey);
                      } catch {/* ignore */}
                    }}
                  >
                    Use a different glyph
                  </button>
                </div>

                {/* Result */}
                {replyUrl && (
                  <div className="sf-reply-result" ref={resultRef}>
                    <label className="sf-label">Share this link</label>
                    <input
                      className="sf-input"
                      type="text"
                      readOnly
                      value={replyUrl}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <div className="sf-reply-actions">
                      <a className="sf-link" href={replyUrl} target="_blank" rel="noopener noreferrer">
                        Open reply →
                      </a>
                      <button
                        className="sf-btn sf-btn--ghost"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(replyUrl);
                          } catch { /* ignore */ }
                        }}
                      >
                        Copy
                      </button>
                    </div>
                    <p className="sf-sub">
                      The reply link includes the parent post via <code>?add=</code> so the thread stays intact.
                    </p>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </header>

      {/* Feed list */}
      <section className="sf-list">
        {urls.length === 0 ? (
          <div className="sf-empty">
            No items yet. Open a <code>/feed/p/&lt;payload&gt;</code> link and reply to start a thread.
          </div>
        ) : (
          urls.map((u) => <FeedCard key={u} url={u} />)
        )}
      </section>
    </main>
  );
}
