"use client";

import { useState } from "react";
import type { ReactElement } from "react";

import SigilLogin from "./SigilLogin";
import { resolvePhiKeyFromSigil } from "./PhiKeyResolver";
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
import type { PostEntry, SessionData } from "./SessionManager";

type FlowStep = "login" | "connect" | "compose" | "seal" | "embed" | "share" | "verify" | "logout";

interface SigilMeta {
  kaiSignature: string;
  pulse: number;
  chakraDay?: string;
  connectedAccounts?: Record<string, string>;
  postLedger?: PostEntry[];
}

/* -------- helpers: strict, no any -------- */
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
  const connectedAccounts = toStringRecord(v.connectedAccounts);
  const postLedger = toPostLedger(v.postLedger);

  return { kaiSignature, pulse, chakraDay, connectedAccounts, postLedger };
}
/* ----------------------------------------- */

function KaiVohFlow(): ReactElement {
  const { session, setSession, clearSession } = useSession();

  const [step, setStep] = useState<FlowStep>("login");
  const [post, setPost] = useState<ComposedPost | null>(null);
  const [sealed, setSealed] = useState<SealedPost | null>(null);
  const [finalMedia, setFinalMedia] = useState<Blob | null>(null);
  const [verifierData, setVerifierData] = useState<
    { pulse: number; kaiSignature: string; phiKey: string } | null
  >(null);

  const handleSigilVerified = (_svgText: string, rawMeta: unknown): void => {
    const meta = parseSigilMeta(rawMeta);
    const resolved = resolvePhiKeyFromSigil(rawMeta);
    if (!meta || !resolved.isValid) {
      alert("Invalid PhiKey signature.");
      return;
    }

    const nextSession: SessionData = {
      phiKey: resolved.phiKey,
      kaiSignature: meta.kaiSignature,
      pulse: meta.pulse,
      chakraDay: meta.chakraDay ?? "Crown",
      connectedAccounts: meta.connectedAccounts ?? ({} as Record<string, string>),
      postLedger: meta.postLedger ?? [],
    };

    setSession(nextSession);
    setStep("connect");
  };

  const handleLogout = (): void => {
    if (!session) return;
    const nextSvg = buildNextSigilSvg(session);
    downloadSigil(`sigil-${session.pulse + 1}.svg`, nextSvg);
    clearSession();
    setStep("login");
  };

  if (!session || step === "login") {
    return <SigilLogin onVerified={handleSigilVerified} />;
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

  if (step === "embed" && sealed) {
    void embedKaiSignature(sealed).then((media) => {
      setFinalMedia(media.content);
      setVerifierData({
        pulse: sealed.pulse,
        kaiSignature: sealed.kaiSignature,
        phiKey: session.phiKey,
      });
      setStep("share");
    });
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

export default function KaiVohApp(): ReactElement {
  return (
    <SessionProvider>
      <KaiVohFlow />
    </SessionProvider>
  );
}
