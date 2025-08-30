/* ────────────────────────────────────────────────────────────────
   HarmonicLoginModal.tsx · Atlantean Lumitech
   v1.5 — Live-breath countdown + flawless resonance login
   • Real-time pulse display with seconds-to-next-breath timer
   • No user input — single-tap “Login with Resonance”
   • Exactly mirrors SigilModal live-tick logic, minus glyph output
────────────────────────────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  PULSE_MS,
  computeKaiSignature,
  getCurrentKaiPulse,
} from "../utils/kai";
import "./HarmonicLoginModal.css";

/* ╔═ PROPS ══════════════════════════════════════════════════════ */
export interface HarmonicLoginModalProps {
  onAuthenticated: (phiKey: string) => void;
  onClose?: () => void;
}

/* ╔═ PULSE BUBBLE KEYFRAME (injected once) ══════════════════════ */
const style = `
@keyframes kaiPulse {
  0%   { transform: scale(1);   opacity: .90; }
  50%  { transform: scale(1.08); opacity: .55; }
  100% { transform: scale(1);   opacity: .90; }
}`;
const addStyleTag = (): void => {
  if (document.getElementById("harmonic-login-style")) return;
  const tag = document.createElement("style");
  tag.id = "harmonic-login-style";
  tag.textContent = style;
  document.head.appendChild(tag);
};

/* ╔═ CONSTANT — system-known intention ══════════════════════════ */
const SYSTEM_INTENTION = "Enter my portal"; // embedded, not user-editable

/* ╔═ COMPONENT ══════════════════════════════════════════════════ */
const HarmonicLoginModal = ({
  onAuthenticated,
  onClose,
}: HarmonicLoginModalProps) => {
  /* ── state ─────────────────────────────────────────────────── */
  const [pulse, setPulse]     = useState(getCurrentKaiPulse());
  const [loading, setLoading] = useState(false);
  const [lastSig, setLastSig] = useState<string | null>(null);
  const [secsLeft, setSecsLeft] = useState<number | null>(null);

  /* refs */
  const timerRef   = useRef<number | null>(null);      // pulse updater
  const anchorRef  = useRef<number>(Date.now());       // time of last pulse

  /* ── mount ─────────────────────────────────────────────────── */
  useEffect(() => {
    addStyleTag();

    /* live pulse ticker */
    const tick = () => {
      setPulse(() => {
        const p = getCurrentKaiPulse();
        anchorRef.current = Date.now();
        return p;
      });
    };
    tick(); // immediate sync

    timerRef.current = window.setInterval(tick, PULSE_MS);

    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, []);

  /* ── seconds-left countdown ───────────────────────────────── */
  useEffect(() => {
    /* independent fast timer for smooth countdown */
    const id = window.setInterval(() => {
      setSecsLeft(
        Math.ceil(
          (PULSE_MS - ((Date.now() - anchorRef.current) % PULSE_MS)) / 1000,
        ),
      );
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  /* ── actions ───────────────────────────────────────────────── */
  const handleLogin = async (): Promise<void> => {
    setLoading(true);
    try {
      /* snapshot latest pulse RIGHT NOW for true-resonance */
      const currentPulse = getCurrentKaiPulse();
      const kaiSignature = await computeKaiSignature(
        currentPulse,
        SYSTEM_INTENTION,
      );
      setLastSig(kaiSignature);

      const res = await fetch("/login/resonance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kai_signature: kaiSignature }),
      });

      if (!res.ok) throw new Error("Auth failed");
      const { phi_key } = (await res.json()) as { phi_key: string };
      onAuthenticated(phi_key);
    } catch (err) {
      console.error(err);
      alert("Authentication failed – please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copySig = (): void => {
    if (lastSig) void navigator.clipboard.writeText(lastSig);
  };

  /* ── render ────────────────────────────────────────────────── */
  return createPortal(
    <div
      className="harmonic-login-overlay fixed inset-0 z-50 flex items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="harmonic-login-card relative w-[min(90vw,26rem)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {onClose && (
          <button
            aria-label="Close"
            onClick={onClose}
            className="close-btn absolute right-3 top-3 text-xl"
          >
            &times;
          </button>
        )}

        <h2 className="mb-6 text-center text-2xl font-semibold">
          Harmonic&nbsp;Login
        </h2>

        {/* Pulse readout */}
        <div className="mb-4 flex items-center justify-center gap-3">
          <div
            style={{ animationDuration: `${PULSE_MS}ms` }}
            className="pulse-bubble relative flex h-4 w-4 items-center justify-center"
          >
            <span
              style={{ animation: `kaiPulse ${PULSE_MS}ms infinite` }}
              className="absolute inline-flex h-full w-full rounded-full opacity-75"
            />
            <span className="relative inline-flex h-4 w-4 rounded-full" />
          </div>
          <span className="font-mono text-lg tabular-nums">
            Pulse&nbsp;{pulse.toLocaleString()}
          </span>
        </div>

        {/* next-breath countdown */}
        {secsLeft !== null && (
          <p className="mb-6 text-center text-sm">
            next breath in <strong>{secsLeft}</strong>s
          </p>
        )}

        {/* Login button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="login-btn mb-4 w-full"
        >
          {loading ? "Breathing…" : "Login with Resonance"}
        </button>

        {/* Debug helpers */}
        {lastSig && (
          <p className="break-all text-center text-xs">
            <strong>kai_signature:</strong>&nbsp;
            {lastSig}
            <button onClick={copySig} className="copy-btn ml-2">
              Copy
            </button>
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default HarmonicLoginModal;
