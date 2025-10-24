// src/components/FeedCard.tsx
import React, { useCallback, useMemo, useState } from "react";
import KaiSigil from "../components/KaiSigil";
import { decodeSigilUrl } from "../utils/sigilDecode";
import { STEPS_BEAT } from "../utils/kai_pulse";
import type {
  Capsule,
  PostPayload,
  MessagePayload,
  SharePayload,
  ReactionPayload,
} from "../utils/sigilDecode";

type Props = { url: string };

type Metaish = { pulse?: number; beat?: number; stepIndex?: number };

// Chakra union expected by KaiSigil props
type ChakraName =
  | "Root"
  | "Sacral"
  | "Solar Plexus"
  | "Heart"
  | "Throat"
  | "Third Eye"
  | "Crown";

const CHAKRAS: readonly ChakraName[] = [
  "Root",
  "Sacral",
  "Solar Plexus",
  "Heart",
  "Throat",
  "Third Eye",
  "Crown",
] as const;

// Optional numeric mapping if some capsules encode chakraDay as an index.
const CHAKRA_BY_INDEX: readonly ChakraName[] = CHAKRAS;

/** Map an unknown value to a valid ChakraName with a coherent fallback. */
function toChakraName(value: unknown, fallback: ChakraName = "Crown"): ChakraName {
  if (typeof value === "string" && (CHAKRAS as readonly string[]).includes(value)) {
    return value as ChakraName;
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    const idx = value as number;
    if (idx >= 0 && idx < CHAKRA_BY_INDEX.length) return CHAKRA_BY_INDEX[idx];
  }
  return fallback;
}

const fmtMeta = (m: Metaish): string => {
  const bits: string[] = [];
  if (typeof m.pulse === "number") bits.push(`Pulse ${m.pulse}`);
  if (typeof m.beat === "number") bits.push(`Beat ${m.beat}`);
  if (typeof m.stepIndex === "number") bits.push(`Step ${m.stepIndex}`);
  return bits.join(" • ");
};

const short = (s: string, head = 8, tail = 0): string =>
  s.length <= head + tail || tail === 0 ? s.slice(0, head) : `${s.slice(0, head)}…${s.slice(-tail)}`;

const asDateTime = (iso?: string): string | undefined => {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? undefined
    : new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
};

const hostOf = (href?: string): string | undefined => {
  if (!href) return undefined;
  try {
    return new URL(href).host;
  } catch {
    return undefined;
  }
};

const isNonEmpty = (val: unknown): val is string => typeof val === "string" && val.trim().length > 0;

export const FeedCard: React.FC<Props> = ({ url }) => {
  // Hooks must be declared before any conditional returns
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Kopy failed";
      // eslint-disable-next-line no-console
      console.warn("Klipboard kopy failed:", msg);
    }
  }, [url]);

  const decoded = useMemo(() => decodeSigilUrl(url), [url]);

  if (!decoded.ok) {
    return (
      <article className="fc err" role="group" aria-label="Invalid Sigil URL">
        <div className="fc-url mono" title={url}>
          {url}
        </div>
        <div className="fc-err" role="alert">
          {decoded.error}
        </div>
      </article>
    );
  }

  const { data } = decoded;
  const capsule: Capsule = data.capsule;

  const post: PostPayload | undefined = capsule.post;
  const message: MessagePayload | undefined = capsule.message;
  const share: SharePayload | undefined = capsule.share;
  const reaction: ReactionPayload | undefined = capsule.reaction;

  const timeLabel = asDateTime(capsule.timestamp);
  const kind =
    data.kind ?? (post ? "post" : message ? "message" : share ? "share" : reaction ? "reaction" : "sigil");
  const appBadge = data.appId ? `app ${short(data.appId, 10, 4)}` : undefined;
  const userBadge = data.userId ? `user ${short(String(data.userId), 10, 4)}` : undefined;
  const metaLine = fmtMeta({ pulse: data.pulse, beat: data.beat, stepIndex: data.stepIndex });
  const chakraName: ChakraName = toChakraName(data.chakraDay);

  const signaturePresent = isNonEmpty(capsule.kaiSignature);
  const verifiedTitle = signaturePresent ? "Signature present (kaiSignature)" : "Unsigned capsule";

  // Compute stepPct from stepIndex with safe bounds.
  // KaiSigil maps stepPct -> stepIndex via floor(stepPct * STEPS_BEAT) (clamped),
  // so we invert approximately. Using denom = STEPS_BEAT - 1 spreads across full range.
  const stepIndexNum = typeof data.stepIndex === "number" ? data.stepIndex : 0;
  const denom = Math.max(1, STEPS_BEAT - 1);
  const stepPct = Math.min(1, Math.max(0, stepIndexNum / denom));

  return (
    <article className="fc" role="article" aria-label={`${kind} glyph`}>
      <div className="fc-left" aria-hidden="true">
        <div className="fc-sigil">
          <KaiSigil
            pulse={data.pulse ?? 0}
            beat={data.beat ?? 0}
            stepPct={stepPct}
            chakraDay={chakraName}
          />
        </div>
      </div>

      <div className="fc-right">
        {/* Top meta row */}
        <div className="fc-meta" aria-label="Glyph metadata">
          <span className="pill kind" title={`Kind: ${kind}`}>
            {kind.toUpperCase()}
          </span>
          {appBadge && <span className="pill">{appBadge}</span>}
          {userBadge && <span className="pill">{userBadge}</span>}
          <span className="pill" title="Chakra day">
            {chakraName}
          </span>
          {metaLine && <span className="muted">• {metaLine}</span>}
          {timeLabel && <span className="muted">• {timeLabel}</span>}
          <span className={`sig ${signaturePresent ? "ok" : "warn"}`} title={verifiedTitle} aria-label={verifiedTitle}>
            {signaturePresent ? "SIGNED" : "UNSIGNED"}
          </span>
        </div>

        {/* Body by kind */}
        {post && (
          <section className="fc-bodywrap">
            {isNonEmpty(post.title) && <h3 className="fc-title">{post.title}</h3>}
            {isNonEmpty(post.text) && <p className="fc-body">{post.text}</p>}
            {Array.isArray(post.tags) && post.tags.length > 0 && (
              <div className="fc-tags" aria-label="Tags">
                {post.tags.map((t) => (
                  <span key={t} className="tag">
                    #{t}
                  </span>
                ))}
              </div>
            )}
            {Array.isArray(post.media) && post.media.length > 0 && (
              <div className="fc-media" aria-label="Attached media">
                {post.media.map((m) => {
                  const key = `${m.kind}:${m.url}`;
                  const label = hostOf(m.url) ?? m.kind;
                  return (
                    <a
                      key={key}
                      className="btn ghost"
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      title={m.url}
                    >
                      {label}
                    </a>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {message && (
          <section className="fc-bodywrap">
            <h3 className="fc-title">Message → {short(message.toUserId, 10, 4)}</h3>
            <p className="fc-body">{message.text}</p>
          </section>
        )}

        {share && (
          <section className="fc-bodywrap">
            <h3 className="fc-title">Share</h3>
            <a className="fc-link" href={share.refUrl} target="_blank" rel="noreferrer" title={share.refUrl}>
              {hostOf(share.refUrl) ?? share.refUrl}
            </a>
            {isNonEmpty(share.note) && <p className="fc-body">{share.note}</p>}
          </section>
        )}

        {reaction && (
          <section className="fc-bodywrap">
            <h3 className="fc-title">Reaction</h3>
            <div className="fc-body">
              {isNonEmpty(reaction.emoji) ? reaction.emoji : "❤️"}
              {typeof reaction.value === "number" ? ` × ${reaction.value}` : null}
            </div>
            <a className="fc-link" href={reaction.refUrl} target="_blank" rel="noreferrer" title={reaction.refUrl}>
              {hostOf(reaction.refUrl) ?? reaction.refUrl}
            </a>
          </section>
        )}

        {/* Actions */}
        <div className="fc-actions" role="group" aria-label="Actions">
          <a className="btn" href={url} target="_blank" rel="noreferrer" title="Open original sigil URL">
            Open Sigil
          </a>
          <button className="btn" type="button" onClick={onCopy} aria-pressed={copied}>
            {copied ? "Kopied" : "Kopy URL"}
          </button>
        </div>
      </div>
    </article>
  );
};

export default FeedCard;
