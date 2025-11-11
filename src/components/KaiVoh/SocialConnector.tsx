// src/components/KaiVoh/SocialConnector.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import "./styles/SocialConnector.css";
import { encodeFeedPayload, type FeedPostPayload } from "../../utils/feedPayload";
import { momentFromUTC } from "../../utils/kai_pulse";
import { useSigilAuth } from "./SigilAuthContext";

/** Non-blocking URL check for sigil/action links */
function isLikelySigilUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return (url.protocol === "https:" || url.protocol === "http:") && url.search.includes("p=");
  } catch {
    return false;
  }
}

/** trim-or-undef */
const opt = (s: string) => {
  const v = s.trim();
  return v.length ? v : undefined;
};

const short = (s: string, head = 8, tail = 6): string =>
  s.length <= head + tail ? s : `${s.slice(0, head)}…${s.slice(-tail)}`;

/** Safely read a string prop from an object or its nested `meta` */
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

/** Try to extract a canonical sigil/action URL out of the SVG text itself */
function extractSigilActionUrlFromSvgText(svgText?: string | null, metaCandidate?: Record<string, unknown>): string | undefined {
  if (!svgText) return undefined;

  // First try metaCandidate keys
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

    // Look through all <metadata> tags for JSON with url-ish fields
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
        // If not JSON, try regex URL
        const m = peeled.match(/https?:\/\/[^\s"'<>)#]+/i);
        if (m && isHttp(m[0])) return m[0];
      }
    }

    // Check <a href="..."> / xlink:href in the SVG
    for (const a of Array.from(doc.getElementsByTagName("a"))) {
      const href = a.getAttribute("href") || a.getAttribute("xlink:href");
      if (isHttp(href)) return href!;
    }
  } catch {
    /* ignore parse errors */
  }

  return undefined;
}

/** Build absolute feed URL like before: /feed/p/<token> */
function buildFeedUrl(token: string): string {
  const base = new URL("/", window.location.href);
  base.pathname = `/feed/p/${token}`.replace(/\/{2,}/g, "/");
  return base.toString();
}

export default function SocialConnector() {
  const { auth } = useSigilAuth();
  const sigilMeta = auth.meta;

  // Composer text (URL is locked & auto-populated)
  const [caption, setCaption] = useState<string>("");
  const [author, setAuthor] = useState<string>("");

  // Auto-populated identity (read-only display + payload bind)
  const [phiKey, setPhiKey] = useState<string>("");
  const [kaiSignature, setKaiSignature] = useState<string>("");

  // UX
  const [busy, setBusy] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [generatedUrl, setGeneratedUrl] = useState<string>("");

  const hasVerifiedSigil = Boolean(sigilMeta);

  /** 1) Prefer action URL from meta; 2) fallback: parse from auth.svgText; 3) last resort: window.origin */
  const sigilActionUrl = useMemo(() => {
    const metaFirst =
      readStringProp(sigilMeta as unknown, "sigilActionUrl") ||
      readStringProp(sigilMeta as unknown, "sigilUrl") ||
      readStringProp(sigilMeta as unknown, "actionUrl") ||
      readStringProp(sigilMeta as unknown, "url") ||
      readStringProp(sigilMeta as unknown, "claimedUrl") ||
      readStringProp(sigilMeta as unknown, "loginUrl") ||
      readStringProp(sigilMeta as unknown, "sourceUrl") ||
      readStringProp(sigilMeta as unknown, "originUrl") ||
      readStringProp(sigilMeta as unknown, "link") ||
      readStringProp(sigilMeta as unknown, "href");

    if (metaFirst) return metaFirst;

    const extracted = extractSigilActionUrlFromSvgText(auth.svgText, sigilMeta as unknown as Record<string, unknown>);
    if (extracted) return extracted;

    // Fallback (still allow generation, but warn)
    return window.location.origin;
  }, [sigilMeta, auth.svgText]);

  /** Lock identity values from sigil (if verified) */
  useEffect(() => {
    if (!sigilMeta) return;
    setPhiKey(sigilMeta.userPhiKey ?? "");
    setKaiSignature(sigilMeta.kaiSignature ?? "");
  }, [sigilMeta]);

  const onGenerate = async (): Promise<void> => {
    setErr(null);
    setWarn(null);
    setCopied(false);
    setGeneratedUrl("");

    const rawUrl = (sigilActionUrl || "").trim();

    // Warn (non-blocking) if the URL doesn't look like a sigil/action link
    if (!isLikelySigilUrl(rawUrl)) {
      setWarn(
        "Sigil action URL not detected in meta; using fallback. The feed link will still be generated."
      );
    }

    // Pulse sealed at moment of posting
    let pulse: number;
    try {
      pulse = momentFromUTC(new Date()).pulse;
    } catch {
      setErr("Failed to compute Kai pulse.");
      return;
    }

    try {
      setBusy(true);

      const payload: FeedPostPayload = {
        v: 1,
        url: rawUrl, // always set (meta, extracted, or fallback)
        pulse,
        caption: opt(caption),
        author: opt(author),
        source: "manual",
        // Identity locked to verified sigil if present
        phiKey: hasVerifiedSigil && phiKey ? phiKey : undefined,
        kaiSignature: hasVerifiedSigil && kaiSignature ? kaiSignature : undefined,
        ts: Date.now(),
      };

      const token = encodeFeedPayload(payload);
      const shareUrl = buildFeedUrl(token); // EXACT URL used by /feed/p/:token

      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
      } catch {
        setCopied(false);
      }

      setGeneratedUrl(shareUrl);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Failed to generate payload link.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  const onReset = () => {
    setCaption("");
    setAuthor("");
    setErr(null);
    setWarn(null);
    setCopied(false);
    setGeneratedUrl("");
  };

  const bind =
    (setter: (v: string) => void) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setter(e.target.value);

  /** Identity banner */
  const identityBanner = useMemo(() => {
    if (!hasVerifiedSigil) return null;
    const k = phiKey;
    const sig = kaiSignature;
    return (
      <div className="id-banner" role="status" aria-live="polite">
        <span className="id-dot" />
        <span className="id-text">
          Verified by Sigil — ΦKey <strong>{short(k)}</strong>
          {" • "}
          Last verified pulse <strong>{sigilMeta?.pulse}</strong>
        </span>
        <span className="id-sub mono">KSig {short(sig)}</span>
      </div>
    );
  }, [hasVerifiedSigil, phiKey, kaiSignature, sigilMeta?.pulse]);

  /** Read-only preview of the resolved action URL */
  const urlPreview = useMemo(() => {
    if (!sigilActionUrl) return null;
    return (
      <div className="composer">
        <label className="composer-label">
          Sigil Action URL <span className="muted">(locked)</span>
        </label>
        <div className="composer-input-row">
          <input className="composer-input locked" type="url" value={sigilActionUrl} readOnly />
          <button
            type="button"
            className="composer-aux"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(sigilActionUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              } catch {
                /* ignore */
              }
            }}
            title="Copy sigil action URL"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        {!isLikelySigilUrl(sigilActionUrl) && (
          <div className="composer-hint warn">
            No canonical sigil link found in the SVG. Using a fallback URL; generation still works.
          </div>
        )}
      </div>
    );
  }, [sigilActionUrl, copied]);

  return (
    <div className="social-connector-container">
      <h2 className="social-connector-title">Compose Kai Feed Link</h2>
      <p className="social-connector-sub">
        Generate a shareable <code>/feed/p/&lt;token&gt;</code> bound to your verified sigil. The pulse is sealed
        at the moment of posting — no edits, no drift.
      </p>

      {identityBanner}
      {urlPreview}

      {/* Optional text */}
      <div className="composer two">
        <div className="field">
          <label htmlFor="caption" className="composer-label">
            Caption <span className="muted">(optional)</span>
          </label>
          <textarea
            id="caption"
            className="composer-textarea"
            rows={3}
            placeholder="Say something about this post…"
            value={caption}
            onChange={bind(setCaption)}
          />
        </div>
        <div className="field">
          <label htmlFor="author" className="composer-label">
            Author Handle <span className="muted">(optional, e.g., @KaiRexKlok)</span>
          </label>
          <input
            id="author"
            className="composer-input"
            type="text"
            placeholder="@handle"
            value={author}
            onChange={bind(setAuthor)}
            autoCorrect="off"
            autoCapitalize="none"
          />
        </div>
      </div>

      {err && <div className="composer-error">{err}</div>}
      {warn && !err && <div className="composer-warn">{warn}</div>}

      {/* Actions */}
      <div className="composer-actions">
        <button
          type="button"
          onClick={onGenerate}
          className="composer-submit"
          disabled={busy}
          title="Generate feed URL"
        >
          {busy ? "Generating…" : "Generate Feed URL"}
        </button>
        <button type="button" className="composer-reset" onClick={onReset}>
          Reset
        </button>
      </div>

      {/* Result */}
      {generatedUrl && (
        <div className="composer-result">
          <label htmlFor="gen-url" className="composer-label">
            Your shareable link
          </label>
          <input
            id="gen-url"
            className="composer-input"
            type="text"
            readOnly
            value={generatedUrl}
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="composer-actions">
            <button
              type="button"
              className="composer-copy"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(generatedUrl);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
            <a className="composer-open" href={generatedUrl} target="_blank" rel="noopener noreferrer">
              Open in new tab →
            </a>
          </div>
          <p className="composer-hint">Opens the feed with your payload decoded and rendered first.</p>
        </div>
      )}
    </div>
  );
}
