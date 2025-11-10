"use client";

import { useEffect, useState } from "react";
import type { ReactElement } from "react";

/* UI flow */
import SigilLogin from "./SigilLogin";
import { SessionProvider, useSession } from "./SessionManager";
import SocialConnector from "./SocialConnector";
import PostComposer from "./PostComposer";
import type { ComposedPost } from "./PostComposer";
import BreathSealer from "./BreathSealer";
import type { SealedPost } from "./BreathSealer";
import { embedKaiSignature } from "./SignatureEmbedder";
import MultiShareDispatcher from "./MultiShareDispatcher";
import KaiVerifierLink from "./KaiVerifierLink";
import { buildNextSigilSvg, downloadSigil } from "./SigilMemoryBuilder";

/* Canonical crypto parity (match VerifierStamper): derive Φ-Key FROM SIGNATURE */
import { derivePhiKeyFromSig } from "../VerifierStamper/sigilUtils";

/* Types */
import type { PostEntry, SessionData } from "./SessionManager";

/* -------------------------------------------------------------------------- */
/*                               Helper Types                                 */
/* -------------------------------------------------------------------------- */

type FlowStep =
  | "login"
  | "connect"
  | "compose"
  | "seal"
  | "embed"
  | "share"
  | "verify"
  | "logout";

/** Minimal, trusted shape we accept from SigilLogin → never from data-* attrs */
interface SigilMeta {
  kaiSignature: string;
  pulse: number;
  chakraDay?: string;
  userPhiKey?: string; // optional, but we will compute from signature anyway
  connectedAccounts?: Record<string, string>;
  postLedger?: PostEntry[];
}

/* -------------------------------------------------------------------------- */
/*                           Narrowing / Validation                            */
/* -------------------------------------------------------------------------- */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isPostEntry(v: unknown): v is PostEntry {
  return (
    isRecord(v) &&
    typeof v.pulse === "number" &&
    typeof v.platform === "string" &&
    typeof v.link === "string"
  );
}

function toPostLedger(v: unknown): PostEntry[] {
  if (!Array.isArray(v)) return [];
  const out: PostEntry[] = [];
  for (const item of v) if (isPostEntry(item)) out.push(item);
  return out;
}

function toStringRecord(v: unknown): Record<string, string> | undefined {
  if (!isRecord(v)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "string") out[k] = val;
  }
  return out;
}

function parseSigilMeta(v: unknown): SigilMeta | null {
  if (!isRecord(v)) return null;

  const kaiSignature = v.kaiSignature;
  const pulse = v.pulse;
  if (typeof kaiSignature !== "string" || typeof pulse !== "number") return null;

  const chakraDay = typeof v.chakraDay === "string" ? v.chakraDay : undefined;
  const userPhiKey = typeof v.userPhiKey === "string" ? v.userPhiKey : undefined;
  const connectedAccounts = toStringRecord(v.connectedAccounts);
  const postLedger = toPostLedger(v.postLedger);

  return { kaiSignature, pulse, chakraDay, userPhiKey, connectedAccounts, postLedger };
}

/** Light, sane Base58 (no case-folding, no hard 34-char lock) */
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;
function isValidPhiKeyShape(k: string): boolean {
  return BASE58_RE.test(k) && k.length >= 26 && k.length <= 64;
}

/* -------------------------------------------------------------------------- */
/*                                   Flow                                     */
/* -------------------------------------------------------------------------- */

function KaiVohFlow(): ReactElement {
  const { session, setSession, clearSession } = useSession();

  const [step, setStep] = useState<FlowStep>("login");
  const [post, setPost] = useState<ComposedPost | null>(null);
  const [sealed, setSealed] = useState<SealedPost | null>(null);
  const [finalMedia, setFinalMedia] = useState<Blob | null>(null);
  const [verifierData, setVerifierData] = useState<
    { pulse: number; kaiSignature: string; phiKey: string } | null
  >(null);
  const [flowError, setFlowError] = useState<string | null>(null);

  /** Top-of-funnel: receive verified meta from SigilLogin (already signature-checked there) */
  const handleSigilVerified = async (_svgText: string, rawMeta: unknown): Promise<void> => {
    try {
      setFlowError(null);
      const meta = parseSigilMeta(rawMeta);
      if (!meta) throw new Error("Malformed sigil metadata.");

      // Always compute Φ-Key FROM SIGNATURE for strict parity
      const expectedPhiKey = await derivePhiKeyFromSig(meta.kaiSignature);

      // If a userPhiKey was embedded, ensure it matches (case-sensitive compare is fine for Base58)
      if (meta.userPhiKey && meta.userPhiKey !== expectedPhiKey) {
        console.warn(
          "[KaiVoh] Embedded userPhiKey differs from derived; preferring derived from signature.",
          { embedded: meta.userPhiKey, derived: expectedPhiKey }
        );
      }

      if (!isValidPhiKeyShape(expectedPhiKey)) {
        throw new Error("Invalid Φ-Key shape after derivation.");
      }

      const nextSession: SessionData = {
        phiKey: expectedPhiKey,
        kaiSignature: meta.kaiSignature,
        pulse: meta.pulse,
        chakraDay: meta.chakraDay ?? "Crown",
        connectedAccounts: meta.connectedAccounts ?? {},
        postLedger: meta.postLedger ?? [],
      };

      setSession(nextSession);
      setStep("connect");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid PhiKey signature.";
      setFlowError(msg);
      alert(msg);
    }
  };

  /** Logout mints the next sigil and resets flow */
  const handleLogout = (): void => {
    if (!session) return;
    const nextSvg = buildNextSigilSvg(session);
    downloadSigil(`sigil-${session.pulse + 1}.svg`, nextSvg);
    clearSession();
    setPost(null);
    setSealed(null);
    setFinalMedia(null);
    setVerifierData(null);
    setFlowError(null);
    setStep("login");
  };

  /** Side-effect: perform signature embedding exactly once when we enter "embed" */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (step !== "embed" || !sealed || !session) return;

      try {
        const media = await embedKaiSignature(sealed);
        if (cancelled) return;
        setFinalMedia(media.content);
        setVerifierData({
          pulse: sealed.pulse,
          kaiSignature: sealed.kaiSignature,
          phiKey: session.phiKey,
        });
        setStep("share");
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to embed Kai Signature.";
        setFlowError(msg);
        setStep("compose");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [step, sealed, session]);

  /* ------------------------------- Rendering ------------------------------ */

  if (!session || step === "login") {
    return (
      <div className="flex flex-col items-center">
        <SigilLogin onVerified={handleSigilVerified} />
        {flowError && <p className="mt-3 text-xs text-red-500">{flowError}</p>}
      </div>
    );
  }

  if (step === "connect") {
    return (
      <div className="flex flex-col items-center">
        <SocialConnector />
        <button
          onClick={() => setStep("compose")}
          className="mt-4 px-4 py-2 bg-green-600 text-white rounded"
        >
          Compose Post →
        </button>
      </div>
    );
  }

  if (step === "compose" && !post) {
    return (
      <PostComposer
        onReady={(p) => {
          setPost(p);
          setStep("seal");
        }}
      />
    );
  }

  if (step === "seal" && post) {
    return (
      <BreathSealer
        post={post}
        onSealComplete={(s) => {
          setSealed(s);
          setStep("embed");
        }}
      />
    );
  }

  if (step === "embed") {
    // Work happens in useEffect; show a friendly status
    return <p className="text-center mt-12">Embedding Kai Signature…</p>;
  }

  if (step === "share" && finalMedia) {
    return (
      <MultiShareDispatcher
        media={{
          content: finalMedia,
          filename: "kai-sealed.svg",
          type: "image",
          metadata: { ...sealed, phiKey: session.phiKey },
        }}
        onComplete={() => setStep("verify")}
      />
    );
  }

  if (step === "verify" && verifierData) {
    return (
      <div className="flex flex-col items-center">
        <KaiVerifierLink {...verifierData} />
        <button
          onClick={handleLogout}
          className="mt-4 px-4 py-2 bg-gray-700 text-white rounded"
        >
          Logout & Mint New Sigil
        </button>
      </div>
    );
  }

  return <p className="text-center mt-12">Something went sideways in the breath stream…</p>;
}

/* -------------------------------------------------------------------------- */
/*                                   App                                      */
/* -------------------------------------------------------------------------- */

export default function KaiVohApp(): ReactElement {
  return (
    <SessionProvider>
      <KaiVohFlow />
    </SessionProvider>
  );
}
