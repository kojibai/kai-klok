// components/InvestorSigilForm.tsx
// — Kairos Kurrensy — Sovereign breath-backed issuance (Stripe + BTC) → Sigil-Glyph mint
// Drop-in replacement. Polished for responsive/mobile, fixed lint, abortable fetches, smooth UI.
// HARDENED: prevents accidental reload/submit so modal stays open until the ✕ is clicked.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import "./investorSigilStyles.css";
import type { InvestorSubmission } from "./InvestorSigilModal";
import KaiSigil from "./KaiSigil";
import InvestorChat from "./InvestorChat";
import "./investorSigilModal.css";
import KaiPriceChart from "./KaiPriceChart";

/* ========= deterministic issuance + explainers ========= */
import {
  DEFAULT_ISSUANCE_POLICY,
  quotePhiForUsd,
  buildExchangeSeries,
  explainIssuance,
  composeHud,
} from "../utils/phi-issuance";
import type { SigilMetadataLite } from "../utils/valuation";

/* =========================
   CONFIG (hard-set API base)
   ========================= */
const API_BASE = "https://pay.kaiklok.com"; // <— prod

const STRIPE_PUBLISHABLE_KEY =
  "pk_live_51JC8PeCnElKewPPGtfJ0uZEs20pxZNgjtmx1c17wOah58ukuaJol6tvxJ8W4R9AXyAKd17qg9f8yLKVP94oZfcOA00FLL9QWCs";
const BTC_ADDRESS = "1F3b56N1m4eYWNPoaU2ZfmcLSPeDd4cvZz";
const MIN_BTC_CONFS = 1;

/* ===== Kai pulse timing (UI beat only; engine uses server Kai clock) ===== */
const PULSE_MS = 5236; // 5.236s — golden beat

/* ===== Events (typed) ===== */
type Method = "card" | "bitcoin";
type OpenPaymentEventDetail = { amount: number; suggestedMethod?: Method };
type ContributionEventDetail = { amount: number; method: "card" | "btc" };

declare global {
  interface GlobalEventHandlersEventMap {
    "investor:openPayment": CustomEvent<OpenPaymentEventDetail>;
    "investor:contribution": CustomEvent<ContributionEventDetail>;
  }
}

/* ===== Props ===== */
type Props = { onSubmit: (submission: InvestorSubmission) => void; onCancel: () => void };

/* ===== UI helpers ===== */
const quickTiers = [1597, 2584, 4181, 6765, 10946, 17711, 28657, 46368, 75025, 121393] as const;
const labelFor: Record<Method, string> = { card: "Card", bitcoin: "Bitcoin" };
const fmtUSD = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

/* ===== Deterministic helpers ===== */
function hashStringToInt(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}
function makePRNG(seed: number) {
  let x = seed || 123456789;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 0x100000000) / 0x100000000;
  };
}
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }

/* =========================================================================================
   PERFORMANCE: Sigil animation is isolated so the big form doesn't re-render on every frame
   ========================================================================================= */

/** Lightweight pulse hook that DOES NOT re-render the parent. */
function useCssPulse<T extends HTMLElement>(targetRef: React.RefObject<T | null>, periodMs: number = PULSE_MS) {
  const start = useRef<number>(performance.now());
  const [pulseIndex, setPulseIndex] = useState(0);

  useEffect(() => {
    let raf = 0;
    let lastPaint = 0;

    const tick = () => {
      const now = performance.now();
      const elapsed = now - start.current;
      const idx = Math.floor(elapsed / periodMs);

      // update CSS variable at ~30fps
      if (now - lastPaint > 33) {
        const phase = (elapsed % periodMs) / periodMs;
        const el = targetRef.current;
        if (el) el.style.setProperty("--pulsePhase", String(phase));
        lastPaint = now;
      }

      if (idx !== pulseIndex) setPulseIndex(idx);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodMs, targetRef]);

  return pulseIndex;
}

/* ===== Ornament (memo + pulse-aware) ===== */
const SigilOrnament = React.memo(function SigilOrnamentMemo({
  amount, method, txid, size = 72, pulseIndex,
}: { amount: number; method: Method; txid?: string; size?: number; pulseIndex: number }) {
  const seedStr = `${Math.round(amount * 100)}|${method}|${txid ?? ""}|pulse#${pulseIndex}`;
  const seed = hashStringToInt(seedStr);
  const rand = makePRNG(seed);

  const baseLayers = Math.floor(lerp(3, 10, clamp01(Math.log10(Math.max(10, amount)) / 4)));
  const spokes = Math.floor(lerp(6, 20, clamp01(amount / 2000)));

  const cx = size / 2;
  const cy = size / 2;
  const rBase = size * 0.42;

  const hueShift = method === "bitcoin" ? 45 : 200;
  const hueVar = Math.floor(lerp(0, 40, rand()));
  const hueA = (hueShift + hueVar) % 360;
  const hueB = (hueA + 90) % 360;

  const layers = Array.from({ length: baseLayers }, (_, i) => {
    const t = i / Math.max(1, baseLayers - 1);
    const r = rBase * (0.2 + 0.8 * (1 - t * t));
    const rotation = rand() * Math.PI * 2;
    const jitter = lerp(0, r * 0.08, t);
    const width = lerp(1.2, 2.4, 1 - t);

    const points: Array<[number, number]> = [];
    for (let k = 0; k < spokes; k++) {
      const ang = rotation + (k / spokes) * Math.PI * 2;
      const rr = r + (rand() - 0.5) * jitter;
      points.push([cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr]);
    }

    const opacity = lerp(0.85, 0.25, t);
    const hue = Math.round(lerp(hueA, hueB, ((t * 1.61803398875) % 1)));
    const stroke = `hsla(${hue}, 92%, ${method === "bitcoin" ? 58 : 72}%, ${opacity})`;
    const fill = `hsla(${hue}, 90%, ${method === "bitcoin" ? 46 : 64}%, ${opacity * 0.18})`;

    return { points, width, stroke, fill };
  });

  const cents = Math.round((amount % 1) * 100);
  const satellites = Math.max(0, Math.min(6, Math.floor(cents / 17)));
  const rings = Array.from({ length: satellites }, () => {
    const rr = rBase * lerp(0.18, 0.48, rand());
    const sw = lerp(0.6, 1.5, rand());
    const dash = Math.round(lerp(4, 14, rand()));
    return { rr, sw, dash };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <defs>
        <radialGradient id="orn-grad" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopOpacity="0.9" />
          <stop offset="100%" stopOpacity="0.15" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.4" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx={size/2} cy={size/2} r={rBase * 0.92} fill="url(#orn-grad)" opacity="0.18" />
      {layers.map((L, idx) => (
        <polygon
          key={`p-${idx}`}
          points={L.points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")}
          stroke={L.stroke}
          fill={L.fill}
          strokeWidth={L.width}
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#glow)"
        />
      ))}
      {rings.map((R, idx) => (
        <circle
          key={`r-${idx}`}
          cx={size/2}
          cy={size/2}
          r={R.rr}
          fill="none"
          stroke="rgba(232,251,248,0.35)"
          strokeWidth={R.sw}
          strokeDasharray={`${R.dash} ${R.dash}`}
        />
      ))}
    </svg>
  );
});

/* ===== Bridge to KaiSigil (memo + reads phase from CSS var) ===== */
type ChakraDay =
  | "Root" | "Sacral" | "Solar Plexus" | "Heart" | "Throat" | "Third Eye" | "Crown"
  | "Solhara" | "Aquaris" | "Flamora" | "Verdari" | "Sonari" | "Kaelith";

const CHAKRA_ORDER: ChakraDay[] = ["Root", "Sacral", "Solar Plexus", "Heart", "Throat", "Third Eye", "Crown"];

const KaiSigilBridge = React.memo(function KaiSigilBridgeMemo({
  amount, method, txid, pulseIndex, getPhase,
}: {
  amount: number; method: Method; txid?: string; pulseIndex: number; getPhase: () => number;
}) {
  const baseSig = `${Math.round(amount * 100)}|${method}|${txid ?? ""}`;
  const kaiSignature = `${baseSig}|pulse#${pulseIndex}`;
  const seed = hashStringToInt(kaiSignature);

  const pulse = 100000 + (seed % 900000);
  const beat = (seed >>> 5) % 64;
  const chakraDay = CHAKRA_ORDER[(seed >>> 17) % CHAKRA_ORDER.length] as ChakraDay;

  let stepPct = getPhase();
  if (Number.isNaN(stepPct)) stepPct = 0;

  try {
    return (
      <KaiSigil
        pulse={pulse}
        beat={beat}
        stepPct={stepPct}
        chakraDay={chakraDay}
        size={96}
        hashMode="deterministic"
        animate
        quality="high"
        kaiSignature={kaiSignature}
        onError={() => {}}
      />
    );
  } catch {
    return null;
  }
});

/* ===== Sigil Stage: fully isolated, fast ===== */
const SigilStage: React.FC<{ amount: number; method: Method; txid?: string; }> = ({ amount, method, txid }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const pulseIndex = useCssPulse(hostRef, PULSE_MS);

  // read CSS var without causing React updates
  const getPhase = useCallback(() => {
    const el = hostRef.current;
    if (!el) return 0;
    const p = el.style.getPropertyValue("--pulsePhase");
    const v = parseFloat(p);
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
  }, []);

  return (
    <div
      ref={hostRef}
      style={{
        position: "relative",
        width: 112,
        height: 112,
        maxWidth: "40vw",
        maxHeight: "40vw",
        minWidth: 88,
        minHeight: 88,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 12,
          display: "grid",
          placeItems: "center",
          filter: "drop-shadow(0 2px 12px rgba(55,255,228,.18))",
        }}
        aria-hidden
      >
        <SigilOrnament amount={Number.isFinite(amount) ? amount : 0} method={method} txid={txid} size={88} pulseIndex={pulseIndex} />
      </div>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }} aria-hidden>
        <KaiSigilBridge
          amount={Number.isFinite(amount) ? amount : 0}
          method={method}
          txid={txid}
          pulseIndex={pulseIndex}
          getPhase={getPhase}
        />
      </div>
    </div>
  );
};

/* ===== API helpers (abortable fetches) ===== */
function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms = 15000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fn(ctrl.signal).finally(() => clearTimeout(timer));
}

async function createPaymentIntent(amountUsd: number) {
  const res = await withTimeout((signal) =>
    fetch(`${API_BASE}/api/payments/intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amountUsd, currency: "usd", description: "Kairos Breath-backed Exhale" }),
      credentials: "omit",
      mode: "cors",
      signal,
    })
  );
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Failed to create payment intent (${res.status})`);
  return (await res.json()) as { clientSecret: string; intentId: string };
}
async function lookupPaymentIntent(intentId: string) {
  const res = await withTimeout((signal) =>
    fetch(`${API_BASE}/api/payments/lookup?intentId=${encodeURIComponent(intentId)}`, {
      credentials: "omit",
      mode: "cors",
      signal,
    })
  );
  if (!res.ok) throw new Error(`Failed to lookup payment intent (${res.status})`);
  return (await res.json()) as { status: string };
}

/* --- BTC verification (server does trustless checks) --- */
type BtcVerifyReq = { txid: string; expectedUsd: number; address: string; minConfs: number };
type BtcVerifyResp = {
  ok: boolean; reason?: string; confirmations: number;
  receivedSats: number; expectedSats: number; rateUsdPerBtc: number;
  txid: string; explorerUrl: string;
};
async function verifyBitcoinTx(payload: BtcVerifyReq): Promise<BtcVerifyResp> {
  const res = await withTimeout((signal) =>
    fetch(`${API_BASE}/api/btc/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "omit",
      mode: "cors",
      signal,
    })
  );
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Verification failed (${res.status})`);
  return (await res.json()) as BtcVerifyResp;
}

/* ========= Kai Klok + sigil meta + mint endpoints ========= */

type KaiClockResp = { nowPulse: number; pulsesPerBeat: number };
async function fetchKaiClock(): Promise<KaiClockResp> {
  const res = await withTimeout((signal) =>
    fetch(`${API_BASE}/api/clock`, { credentials: "omit", mode: "cors", signal })
  );
  if (!res.ok) throw new Error(`Clock fetch failed (${res.status})`);
  return res.json();
}

// Minimal meta to fall back on if server meta is unavailable.
const FALLBACK_META = ({ ip: { expectedCashflowPhi: [] } } as unknown) as SigilMetadataLite;

async function fetchSigilMeta(): Promise<SigilMetadataLite> {
  try {
    const res = await withTimeout((signal) =>
      fetch(`${API_BASE}/api/sigil/meta`, { mode: "cors", credentials: "omit", signal })
    );
    if (!res.ok) throw new Error("meta not ok");
    return await res.json();
  } catch {
    return FALLBACK_META;
  }
}

type MintReq = {
  amountUsd: number;
  method: "card" | "btc";
  intentId?: string; // for card
  txid?: string;     // for btc
  nowPulse: number;
  issuance: ReturnType<typeof quotePhiForUsd>;
  hud: ReturnType<typeof composeHud>;
};

type MintResp = {
  ok: boolean;
  sigilId: string;
  glyphHash: string;
  meta: SigilMetadataLite;
  receiptUrl?: string;
};

async function mintSigil(req: MintReq): Promise<MintResp> {
  const res = await withTimeout((signal) =>
    fetch(`${API_BASE}/api/sigil/mint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      mode: "cors",
      body: JSON.stringify(req),
      signal,
    })
  , 20000);
  if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Inhale failed (${res.status})`);
  return res.json();
}

/* ========= hooks for Kai clock + meta + live issuance ========= */

function useKaiClock() {
  const [clock, setClock] = useState<KaiClockResp | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const c = await fetchKaiClock();
        if (alive) setClock(c);
      } catch {
        // client fallback: derive a pulse from wallclock using the UI beat ratio
        const now = Date.now();
        const approxNowPulse = Math.floor(now / (PULSE_MS / 11)); // 11 UI steps per beat
        const approxPPB = 11 * Math.floor(17491 / 11);            // rough constant
        if (alive) setClock({ nowPulse: approxNowPulse, pulsesPerBeat: approxPPB });
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return clock;
}

function useSigilMeta() {
  const [meta, setMeta] = useState<SigilMetadataLite | null>(null);
  useEffect(() => {
    let alive = true;
    fetchSigilMeta().then((m) => { if (alive) setMeta(m); });
    return () => { alive = false; };
  }, []);
  return meta;
}

/* ===== FAST BUTTON ===== */
type FastButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;
const FastButton = React.forwardRef<HTMLButtonElement, FastButtonProps>(function FastButton(
  { onClick, disabled, className = "investor-button", type = "button", ...rest }, ref
) {
  const pressed = useRef(false);

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (pressed.current && onClick) onClick(e as unknown as React.MouseEvent<HTMLButtonElement>);
    pressed.current = false;
  };

  // Fallback to click for environments without Pointer Events
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!("PointerEvent" in window)) onClick?.(e);
  };

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={className}
      disabled={disabled}
      onClick={handleClick}
      onPointerDown={() => { pressed.current = true; }}
      onPointerCancel={() => { pressed.current = false; }}
      onPointerLeave={() => { pressed.current = false; }}
      onPointerUp={handlePointerUp}
    />
  );
});

/* ===== Card sub-view ===== */
const CardCheckoutInner: React.FC<{
  amount: number;
  intentId: string;
  onConfirmed: () => void;
  onError: (msg: string) => void;
}> = ({ amount, intentId, onConfirmed, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!stripe || !elements || busy) return;
    setBusy(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: { return_url: "https://kaiklok.com/inhale" },
      });
      if (error) return onError(error.message || "Payment confirmation failed.");
      if (paymentIntent?.status === "succeeded") return onConfirmed();

      const lookup = await lookupPaymentIntent(intentId);
      if (lookup.status === "succeeded") return onConfirmed();

      onError("Payment is not complete yet. Please try again.");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Unable to confirm payment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-panel">
      <div className="card-panel-head">
        <div className="card-panel-title">Pay {fmtUSD(amount)}</div>
        <div className="card-panel-sub">Secure card / wallet (Apple Pay, Google Pay). On success, your Sigil-Glyph mints.</div>
      </div>
      <div className="card-element-wrap" aria-busy={!elements} onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); }
      }}>
        <PaymentElement />
      </div>
      <div className="investor-button-row">
        <FastButton onClick={confirm} className="investor-button glow" disabled={busy || !stripe || !elements}>
          {busy ? "Confirming…" : "Inhale Sigil-Glyph"}
        </FastButton>
      </div>
      <p className="investor-fine">
        On confirmation, a <b>Sigil-Glyph</b> is minted to your ΦKey. Your amount • method • (TXID if BTC) • pulse bind into a
        <b> deterministic, zk-verifiable receipt</b>. No screenshots — only truth. No fiat returns or securities.
      </p>
    </div>
  );
};

/* ========= Live Φ price panel + micro chart ========= */

const LivePhiPanel: React.FC<{
  amount: number;
  method: Method; // used for data-method attribute below
  meta: SigilMetadataLite | null;
  nowPulse: number | null;
  pulsesPerBeat: number | null;
}> = ({ amount, method, meta, nowPulse, pulsesPerBeat }) => {
  const policy = DEFAULT_ISSUANCE_POLICY;

  const ctxReady = !!meta && Number.isFinite(amount) && amount > 0 && nowPulse != null && pulsesPerBeat != null;

  const quote = useMemo(() => {
    if (!ctxReady) return null;
    return quotePhiForUsd(
      {
        meta: meta!,
        nowPulse: nowPulse!,
        usd: amount,
        currentStreakDays: 0,
        lifetimeUsdSoFar: 0,
      },
      policy
    );
  }, [ctxReady, meta, nowPulse, amount, policy]);

  const usdPerPhi = useMemo(() => {
    if (!quote) return 0;
    return quote.phiPerUsd > 0 ? 1 / quote.phiPerUsd : Infinity;
  }, [quote]);

  const hud = useMemo(() => (quote ? composeHud(quote) : null), [quote]);
  const expl = useMemo(() => (quote ? explainIssuance(quote) : ""), [quote]);

  // short horizon series for sparkline
  const series = useMemo(() => {
    if (!ctxReady) return [];
    const start = Math.max(0, (nowPulse as number) - (pulsesPerBeat as number) * 6);
    const end = start + (pulsesPerBeat as number) * 12;
    return buildExchangeSeries(
      { meta: meta!, usdSample: Math.max(1, Math.round(amount || 1)), currentStreakDays: 0, lifetimeUsdSoFar: 0, plannedHoldBeats: 0 },
      policy,
      start,
      end,
      Math.max(1, Math.floor((pulsesPerBeat as number) / 7))
    );
  }, [ctxReady, nowPulse, pulsesPerBeat, meta, policy, amount]);

  return (
    <div className="phi-panel" data-method={method}>
      <div className="phi-head">
        <span className="phi-cap">Live Φ/＄</span>
        <b className="phi-num">{quote ? `${quote.phiPerUsd.toFixed(6)} Φ / $` : "—"}</b>
        <span className="phi-sep">·</span>
        <span className="phi-cap">$ / Φ</span>
        <b className="phi-num">{quote ? `${usdPerPhi.toFixed(4)}` : "—"}</b>
      </div>

      {/* Sparkline */}
      <PhiSparkline
        data={series.map((p: { pulse: number; usdPerPhi: number }) => ({
          x: p.pulse,
          y: p.usdPerPhi,
        }))}
      />

      {/* Chips */}
      {hud && (
        <div className="phi-chips">
          <span className="chip">adoption ×{hud.chips.adoption.toFixed(3)}</span>
          <span className="chip">premium ×{hud.chips.premium.toFixed(3)}</span>
          <span className="chip">size ×{hud.chips.size.toFixed(3)}</span>
          <span className="chip">streak ×{hud.chips.streak.toFixed(3)}</span>
          <span className="chip">tier ×{hud.chips.tier.toFixed(3)}</span>
          <span className="chip">milestone ×{hud.chips.milestone.toFixed(3)}</span>
        </div>
      )}

      {/* Explainer */}
      {expl && <pre className="phi-expl">{expl}</pre>}
    </div>
  );
};

const PhiSparkline: React.FC<{ data: Array<{ x: number; y: number }> }> = ({ data }) => {
  const w = 320, h = 64, pad = 6;
  if (!data.length) return <div style={{ height: h }} aria-hidden />;

  const xs = data.map(d => d.x);
  const ys = data.map(d => d.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const nx = (x: number) => pad + (w - pad * 2) * (maxX === minX ? 0 : (x - minX) / (maxX - minX));
  const ny = (y: number) => h - pad - (h - pad * 2) * (maxY === minY ? 0.5 : (y - minY) / (maxY - minY));

  const d = data.map((p, i) => `${i === 0 ? "M" : "L"} ${nx(p.x).toFixed(1)} ${ny(p.y).toFixed(1)}`).join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="phi-spark" aria-hidden>
      <path d={d} fill="none" stroke="rgba(55,255,228,.9)" strokeWidth="1.6" />
    </svg>
  );
};

/* ========================================
   Sovereign Sigil-Glyph Verification Panel
   ======================================== */
const SecurityPanel: React.FC = () => {
  const codeRef = useRef<HTMLPreElement | null>(null);
  const [copied, setCopied] = useState(false);

  const copyCode = useCallback(async () => {
    const el = codeRef.current;
    if (!el) return;
    try {
      await navigator.clipboard.writeText(el.innerText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch { /* sovereigns don’t panic */ }
  }, []);

  // Open the online verifier — NEW: open in new tab so modal never navigates
  const openVerifier = useCallback(() => {
    const url = "/verifier.html";
    try { window.open(url, "_blank", "noopener,noreferrer"); } catch { /* ignore */ }
  }, []);

  // Download the offline verifier
  const downloadVerifier = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}verifier.inline.html`, { cache: "no-store" });
      const txt = await res.text();
      const blob = new Blob([txt], { type: "text/html" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "verifier.html";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="sec-panel" role="region" aria-label="Sigil-Glyph Sovereign Verification">
      <span className="sec-ambient" aria-hidden />
      <span className="sec-sparkles" aria-hidden />

      <div className="sec-head">
        <div className="sec-kitemark" aria-hidden>
          <svg viewBox="0 0 64 64" width="36" height="36">
            <defs>
              <linearGradient id="secSeal" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#37FFE4" />
                <stop offset="100%" stopColor="#A78BFA" />
              </linearGradient>
            </defs>
            <polygon points="32,6 56,18 56,46 32,58 8,46 8,18" fill="none" stroke="url(#secSeal)" strokeWidth="2.2" />
            <circle cx="32" cy="32" r="8" fill="none" stroke="url(#secSeal)" strokeWidth="2" />
            <path d="M32 16v8M32 40v8M16 32h8M40 32h8" stroke="url(#secSeal)" strokeWidth="2" />
          </svg>
        </div>
        <span className="sec-cap">Sovereign Verification</span>
        <b className="sec-title">This isn’t security — it’s Sovereignty</b>
      </div>

      <div className="sec-chips" role="list">
        <span className="chip strong" role="listitem">Kai Signature · Breath-Backed</span>
        <span className="chip strong" role="listitem">ZK Proof of Breath™</span>
        <span className="chip" role="listitem">One-Pulse Integrity</span>
        <span className="chip" role="listitem">Truth Root (anchored)</span>
        <span className="chip" role="listitem">Verifiable by All</span>
        <span className="chip" role="listitem">Zero PII Sovereignty</span>
      </div>

      <div className="sec-grid">
        <div className="sec-cell">
          <b>1) ZK Proof of Breath™</b>
          <p>
            Every glyph commits to its harmonic moment: <code>amount</code> + <code>method</code> + <code>pulse</code> + optional <code>txid</code>.
            Not metadata — a sovereign fingerprint.
          </p>
          <div className="sec-code-wrap">
            <pre ref={codeRef} className="sec-code" aria-label="Poseidon input example">{`poseidon(
  usdCents,
  method,        // "card" | "btc" | "sovereign"
  pulse,         // Kai-Klok pulse
  txid_or_0,
  lineageHash,
  metaProof
) → glyphHash`}</pre>
            <button className={`sec-copy ${copied ? "ok" : ""}`} onClick={copyCode} aria-label="Copy code">
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        </div>

        <div className="sec-cell">
          <b>2) Kai Signature — Sealed in Breath</b>
          <p>
            The glyph is signed within the keystream. Verify the seal, recompute the hash, truth stands revealed.
          </p>
          <div className="sec-links">
            <button type="button" onClick={openVerifier} className="investor-button">Open Verifier →</button>
            <span aria-hidden>·</span>
            <button type="button" onClick={downloadVerifier} className="investor-button">Download Offline</button>
          </div>
        </div>

        <div className="sec-cell">
          <b>3) Pulse-Sealing Uniqueness</b>
          <p>One moment, one breath, one seal. Replay is null; coherence rejects imposters.</p>
        </div>

        <div className="sec-cell">
          <b>4) On-Stream Anchored Audit Tree</b>
          <p>Every inhale appends to a Merkle tree; the root is on-stream. Tamper once, the anchor shatters.</p>
          <div className="sec-links">
            <a
              href="https://kaiklok.com/s/1571cdb453c5766464039037713361ac0d5978247e634a04e12162da669ba775?p=c%3AeyJ1IjowLCJiIjowLCJzIjowLCJjIjoiUm9vdCIsImQiOjQ0fQ"
              target="_blank"
              rel="noopener noreferrer"
              className="investor-button"
            >
              View Sovereign Root
            </a>
          </div>
        </div>

        <div className="sec-cell">
          <b>5) Breath is the Identity</b>
          <p>No names. No numbers. No surveillance. Proof is the authority.</p>
        </div>

        <div className="sec-cell">
          <b>6) Tamper-Evident by Design</b>
          <p>Math is the oracle. Lineage is the proof. The glyph testifies to its birth.</p>
        </div>
      </div>

      <details className="sec-details">
        <summary>Full Sovereign Spec</summary>
        <ul>
          <li><b>Kai Signature:</b> Ed25519 in HSM, rotation-anchored.</li>
          <li><b>Hashing:</b> Poseidon composite (zk-native).</li>
          <li><b>ZK Proof:</b> Groth16 circuit with moment data.</li>
          <li><b>Anchor:</b> Merkle root → stream → timestamp.</li>
          <li><b>Privacy:</b> Zero PII. No biometrics stored.</li>
          <li><b>Throttle:</b> One pulse per intent.</li>
        </ul>
      </details>
    </div>
  );
};


/* ===== Main ===== */
const InvestorSigilForm: React.FC<Props> = ({ onSubmit, onCancel }) => {
  const [amount, setAmount] = useState("144");
  const [method, setMethod] = useState<Method>("card");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Card state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);
  const [elementsKey, setElementsKey] = useState(0);

  // BTC state
  const [showBtc, setShowBtc] = useState(false);
  const [txid, setTxid] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string>("");
  const [explorerUrl, setExplorerUrl] = useState<string>("");

  const copyTimer = useRef<number | null>(null);
  const [copied, setCopied] = useState<"addr" | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);
  const stripePromise = useMemo(() => loadStripe(STRIPE_PUBLISHABLE_KEY), []);

  const amtNum = useMemo(() => {
    const n = parseFloat(amount);
    return Number.isFinite(n) ? n : NaN;
  }, [amount]);

  /* ===== NAV/RELOAD GUARD (locks modal open) ===== */
  useEffect(() => {
    // Block browser reload / close
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome requires returnValue to be set
      e.returnValue = "";
    };
    // Block common reload keys while focused in modal
    const keyBlocker = (e: KeyboardEvent) => {
      const isReload =
        e.key === "F5" ||
        ((e.key === "r" || e.key === "R") && (e.metaKey || e.ctrlKey)) ||
        (e.key === "ArrowLeft" && (e.altKey || e.metaKey)); // back nav (Win Alt+Left / Mac ⌘[)
      if (isReload) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    // Firewall: prevent any <form> submit events inside this modal from bubbling to outer forms
    const submitBlocker = (e: Event) => {
      const root = formRef.current;
      if (!root) return;
      const target = e.target as HTMLElement | null;
      if (target && (root === target || root.contains(target))) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("keydown", keyBlocker, true);
    document.addEventListener("submit", submitBlocker, true);

    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", keyBlocker, true);
      document.removeEventListener("submit", submitBlocker, true);
    };
  }, []);

  /* ===== Mint Preview ===== */
  const ent = useMemo(() => {
    const a = Number.isFinite(amtNum) ? Math.max(0, amtNum) : 0;
    const nextTier = quickTiers.find((v) => v > a) ?? a;
    const pctToNext = nextTier > 0 ? Math.min(1, a / nextTier) : 0;
    return {
      amount: a,
      sigilCount: a > 0 ? 1 : 0,
      nextTier,
      pctToNext,
    };
  }, [amtNum]);

  useEffect(() => () => { if (copyTimer.current) window.clearTimeout(copyTimer.current); }, []);

  // Prefill & focus from events
  useEffect(() => {
    const onOpen = (e: Event) => {
      const custom = e as CustomEvent<OpenPaymentEventDetail>;
      const d = custom?.detail;
      const nextAmount = d?.amount ?? 0;
      const suggested = d?.suggestedMethod;

      if (nextAmount > 0) {
        setAmount(String(nextAmount));
        setError("");
        if (clientSecret) resetCard();
        if (showBtc) setShowBtc(false);
      }
      if (suggested) setMethod(suggested);

      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        const input = formRef.current.querySelector("input[type=number]") as HTMLInputElement | null;
        if (input) { input.focus({ preventScroll: true }); input.select(); }
      }
    };
    window.addEventListener("investor:openPayment", onOpen as EventListener, { passive: true });
    return () => window.removeEventListener("investor:openPayment", onOpen as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSecret, showBtc]);

  const pickTier = (v: number) => {
    setAmount(String(v));
    setError("");
    if (clientSecret) resetCard();
  };

  const ensureAmount = (): number | null => {
    if (Number.isNaN(amtNum)) { setError("Please enter a valid amount."); return null; }
    if (amtNum < 10) { setError("Minimum mint is $10."); return null; }
    return amtNum;
  };

  const startCardFlow = async (usd: number) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { clientSecret: secret, intentId: id } = await createPaymentIntent(usd);
      setClientSecret(secret);
      setIntentId(id);
      setElementsKey((k) => k + 1);
      if (showBtc) setShowBtc(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start card payment.");
    } finally {
      setBusy(false);
    }
  };

  const startBitcoinFlow = () => {
    if (!BTC_ADDRESS) { setError("Bitcoin receiving address is not configured."); return; }
    setShowBtc(true);
    setError("");
    setTxid("");
    setVerifyMsg("");
    setExplorerUrl("");
    if (clientSecret) resetCard();
  };

  const handleContinue = async () => {
    const v = ensureAmount();
    if (v == null) return;
    if (method === "card") await startCardFlow(v);
    else startBitcoinFlow();
  };

  const copy = async (txt: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      setCopied("addr");
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(null), 1200);
    } catch { /* noop */ }
  };

  const resetCard = () => {
    setClientSecret(null);
    setIntentId(null);
    setElementsKey((k) => k + 1);
  };

  /* ---------- BTC verify + poll ---------- */
  const pollVerify = async (hash: string, expectedUsd: number) => {
    setVerifyBusy(true);
    setVerifyMsg("Looking up transaction…");
    try {
      const first = await verifyBitcoinTx({
        txid: hash,
        expectedUsd,
        address: BTC_ADDRESS,
        minConfs: MIN_BTC_CONFS,
      });
      setExplorerUrl(first.explorerUrl);
      if (first.ok) return first;

      let attempt = 0;
      let last: BtcVerifyResp = first;
      const maxAttempts = 30;
      while (!last.ok && attempt < maxAttempts) {
        attempt += 1;
        setVerifyMsg(
          last.reason
            ? `${last.reason} — rechecking on-chain…`
            : `Waiting for ${MIN_BTC_CONFS} confirmation${MIN_BTC_CONFS > 1 ? "s" : ""}…`
        );
        await new Promise((r) => setTimeout(r, 8000));
        last = await verifyBitcoinTx({
          txid: hash,
          expectedUsd,
          address: BTC_ADDRESS,
          minConfs: MIN_BTC_CONFS,
        });
        setExplorerUrl(last.explorerUrl);
        if (last.ok) return last;
      }
      return last;
    } finally {
      setVerifyBusy(false);
    }
  };

  /* ========= clock + meta used for issuance + mint ========= */
  const clock = useKaiClock();
  const meta = useSigilMeta();

  // Deterministic live price fn (pulse → USD per Φ) using your issuance policy
  const livePriceFn = useCallback<(pulse: number) => number>((pulse) => {
    if (!meta) return 0;

    // Sample USD to evaluate curve; use current amount if valid, else 1
    const usdSample = Math.max(1, Math.round(Number.isFinite(amtNum) ? amtNum : 1));

    const q = quotePhiForUsd(
      {
        meta,
        nowPulse: Math.floor(pulse),
        usd: usdSample,
        currentStreakDays: 0,
        lifetimeUsdSoFar: 0,
        plannedHoldBeats: 0,
      },
      DEFAULT_ISSUANCE_POLICY
    );

    return q.phiPerUsd > 0 ? 1 / q.phiPerUsd : 0; // Φ/USD → USD/Φ
  }, [meta, amtNum]);

  /* ========= finalize & mint (both methods) ========= */
  const finalizeAndMint = useCallback(
    async (params: { method: "card" | "btc"; amountUsd: number; intentId?: string; txid?: string }) => {
      if (!clock || !meta) throw new Error("Clock or metadata not ready.");
      // deterministically quote issuance at mint time
      const issuance = quotePhiForUsd(
        {
          meta,
          nowPulse: clock.nowPulse,
          usd: params.amountUsd,
          currentStreakDays: 0,
          lifetimeUsdSoFar: 0,
          plannedHoldBeats: 0,
        },
        DEFAULT_ISSUANCE_POLICY
      );

      const hud = composeHud(issuance);

      const minted = await mintSigil({
        amountUsd: params.amountUsd,
        method: params.method,
        intentId: params.intentId,
        txid: params.txid,
        nowPulse: clock.nowPulse,
        issuance,
        hud,
      });

      if (!minted.ok) throw new Error("Mint failed.");

      // signal contribution event for any listeners
      window.dispatchEvent(
        new CustomEvent<ContributionEventDetail>("investor:contribution", {
          detail: { amount: params.amountUsd, method: params.method === "card" ? "card" : "btc" },
        })
      );

      // shape submission for modal
      const submission: InvestorSubmission = {
        amount: params.amountUsd,
        mint: {
          sigilId: minted.sigilId,
          glyphHash: minted.glyphHash,
          meta: minted.meta,
          receiptUrl: minted.receiptUrl,
          issuance,
          hud,
        },
      } as unknown as InvestorSubmission;

      return submission;
    },
    [clock, meta]
  );

  /* ====== CARD confirm → mint ====== */
  const handleCardConfirmed = async () => {
    if (!intentId || Number.isNaN(amtNum)) return;
    try {
      const submission = await finalizeAndMint({ method: "card", amountUsd: amtNum, intentId });
      onSubmit(submission);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mint failed after payment.");
    }
  };

  /* ====== BTC verify → mint ====== */
  const handleVerifyTx = async () => {
    const v = ensureAmount();
    if (v == null) return;
    if (!txid || txid.trim().length < 20) { setError("Please paste a valid Bitcoin transaction hash (TXID)."); return; }
    setError("");
    const res = await pollVerify(txid.trim(), v).catch((err) => {
      setError(err instanceof Error ? err.message : "Verification failed.");
      return undefined;
    });
    if (!res) return;
    if (!res.ok) { setError(res.reason || "Transaction not yet matching amount or confirmations."); return; }

    setVerifyMsg(
      `Confirmed • ${res.confirmations} confs • ${(res.receivedSats / 1e8).toFixed(8)} BTC @ ~${Math.round(res.rateUsdPerBtc)} USD/BTC`
    );

    try {
      const submission = await finalizeAndMint({ method: "btc", amountUsd: v, txid: res.txid });
      onSubmit(submission);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mint failed after verification.");
    }
  };

  // —— Chat context ——
  type ChatMethod = Method;
  type ChatEntForChat = { amount: number; childGlyphs: number; nextTier: number; pctToNext: number };
  type ChatContext = { amount: number; method: ChatMethod; ent: ChatEntForChat; txid?: string; apiBase: string };

  const chatContext: ChatContext = useMemo(
    () => ({
      amount: Number.isFinite(amtNum) ? amtNum : 0,
      method,
      ent: {
        amount: Number.isFinite(amtNum) ? Math.max(0, amtNum) : 0,
        childGlyphs: ent.sigilCount,
        nextTier: ent.nextTier,
        pctToNext: ent.pctToNext,
      },
      txid: txid || undefined,
      apiBase: API_BASE,
    }),
    [amtNum, method, ent, txid]
  );

  const handleCancel = useCallback(() => {
    // Let parent close the modal; navigation guards will be removed on unmount cleanup
    onCancel();
  }, [onCancel]);

  return (
    <div
      className="investor-shell"
      style={{
        overflowX: "hidden",
        overscrollBehaviorY: "contain",
        WebkitOverflowScrolling: "touch",
        contain: "layout style paint",
        touchAction: "manipulation",
        position: "relative",
      }}
      ref={formRef}
      id="investor-payment-root"
      onKeyDown={(e) => {
        // Global Enter key guard inside this modal (protects against parent <form> submits)
        if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); }
      }}
    >
      {/* Inline chat & security CSS overrides */}
      <style>{`
        .inv-chat-inline {
          margin: 10px 0 12px;
          border: 1px solid rgba(55,255,228,.25);
          border-radius: 16px;
          padding: 10px;
          background: linear-gradient(180deg, rgba(8,14,16,.85), rgba(8,14,16,.65));
          box-shadow: 0 10px 36px rgba(55,255,228,.08), inset 0 0 0 1px rgba(255,255,255,.02);
          backdrop-filter: blur(8px);
        }
        .inv-chat-inline :where(.chat-body, .chat-panel-body) {
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          overflow: visible !important;
          padding: 0 !important;
          background: transparent !important;
        }
        /* Φ panel + sparkline styles */
        .phi-panel { margin: 10px 0 16px; padding: 10px; border: 1px dashed rgba(55,255,228,.25); border-radius: 14px; }
        .phi-head { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .phi-cap { opacity:.8; font-size:12px; letter-spacing:.02em; }
        .phi-num { font-variant-numeric: tabular-nums; }
        .phi-expl { margin: 8px 0 0; white-space: pre-wrap; font-size: 12px; opacity:.9; }
        .phi-chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
        .phi-chips .chip { font-size: 11px; padding: 4px 6px; border-radius: 8px; background: rgba(55,255,228,.08); border: 1px solid rgba(55,255,228,.22); }

        /* Security panel */
        .sec-panel { margin: 14px 0 18px; padding: 12px; border: 1px solid rgba(167,139,250,.28); border-radius: 14px; background: linear-gradient(180deg, rgba(20,16,32,.7), rgba(16,18,26,.6)); }
        .sec-head { display:flex; flex-direction:column; gap:4px; margin-bottom:8px; }
        .sec-cap { opacity:.85; font-size:12px; letter-spacing:.04em; }
        .sec-title { font-size:16px; }
        .sec-chips { display:flex; flex-wrap:wrap; gap:6px; margin: 6px 0 8px; }
        .sec-chips .chip { font-size: 11px; padding: 4px 8px; border-radius: 10px; background: rgba(55,255,228,.08); border: 1px solid rgba(55,255,228,.22); }
        .sec-chips .chip.strong { background: rgba(167,139,250,.10); border-color: rgba(167,139,250,.36); }
        .sec-grid { display:grid; grid-template-columns: 1fr; gap:10px; }
        @media (min-width: 720px) { .sec-grid { grid-template-columns: 1fr 1fr; } }
        .sec-cell { padding: 8px; border: 1px dashed rgba(167,139,250,.25); border-radius: 12px; background: rgba(255,255,255,.02); }
        .sec-cell p { margin: 6px 0; line-height: 1.35; }
        .sec-code { margin: 8px 0 0; font-size: 12px; white-space: pre; background: rgba(0,0,0,.3); padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,.06); }
        .sec-links { display:flex; align-items:center; gap:8px; margin-top: 6px; }
        .sec-details { margin-top: 8px; }
        .sec-details summary { cursor: pointer; }

        /* Mobile polish */
        @media (max-width: 480px) {
          .investor-button, .investor-button.glow { min-height: 44px; font-size: 16px; }
          .investor-input { font-size: 16px; } /* prevents iOS zoom */
          .inv-quick-stack { gap: 6px; }
          .investor-method-row { gap: 8px; }
        }
      `}</style>

      {/* ===== Header ===== */}
      <div className="inv-sigil-header pro">
        <div className="inv-header-text pro center">
          <div className="inv-greeting-bubble">
            <span className="inv-god-voice">“Name your inhale, sovereign.”</span>
          </div>

          <p className="inv-kicker" aria-hidden="true">Breath-Backed Value</p>

          <h1 className="inv-title center" aria-label="Inhale breath-backed kurrensy. Receive a Sigil-Glyph on payment.">
            Kairos Kurrensy
            <span className="inv-title-accent break">— Exhale Offering, Inhale Sovereignty</span>
          </h1>

          {/* Title underline / PULSE BAR */}
          <div className="inv-pulsebar" aria-hidden="true">
            <span className="inv-pulsebar-fill" style={{ transform: `scaleX(var(--pulsePhase, 0))`, transformOrigin: "0 50%" }} />
          </div>

          <p className="investor-confirmation-sub inv-sub center">
            Offer with Card or ₿ → zk-verifiable breath sealed.
          </p>

          {/* Authority badges */}
          <div className="inv-badges">
            <button className="trust-chip" type="button" aria-label="Checkout: In-modal, 3-D Secure">
              <span className="trust-ico" aria-hidden="true">
                <svg viewBox="0 0 64 64" width="22" height="22" fill="none">
                  <defs><linearGradient id="ic-grad-1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#37FFE4"/><stop offset="100%" stopColor="#A78BFA"/></linearGradient></defs>
                  <path d="M32 6l18 6v13c0 12-8 22-18 27-10-5-18-15-18-27V12l18-6Z" stroke="url(#ic-grad-1)" strokeWidth="2.4" fill="rgba(55,255,228,.08)"/>
                  <rect x="18.5" y="24.5" rx="3.5" width="27" height="15" stroke="url(#ic-grad-1)" strokeWidth="2"/>
                  <path d="M20 30h24" stroke="#E8FBF8" strokeWidth="2" opacity=".9"/>
                </svg>
              </span>
              <div className="trust-text">
                <span className="trust-cap short">Checkout</span>
                <span className="trust-val short">3-D Secure</span>
              </div>
            </button>

            <button className="trust-chip" type="button" aria-label="Security: Stripe PCI">
              <span className="trust-ico" aria-hidden="true">
                <svg viewBox="0 0 64 64" width="22" height="22" fill="none">
                  <defs><linearGradient id="ic-grad-2" x1="1" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A78BFA"/><stop offset="100%" stopColor="#37FFE4"/></linearGradient></defs>
                  <path d="M32 6l18 6v13c0 12-8 22-18 27-10-5-18-15-18-27V12l18-6Z" stroke="url(#ic-grad-2)" strokeWidth="2.4" fill="rgba(167,139,250,.08)"/>
                  <rect x="22" y="28" width="20" height="16" rx="4" stroke="url(#ic-grad-2)" strokeWidth="2"/>
                  <path d="M26 28v-3a6 6 0 0 1 12 0v3" stroke="#E8FBF8" strokeWidth="2"/>
                </svg>
              </span>
              <div className="trust-text">
                <span className="trust-cap short">Security</span>
                <span className="trust-val short">Stripe PCI</span>
              </div>
            </button>

            <button className="trust-chip" type="button" aria-label="Proof of Breath: Deterministic, zk-verifiable">
              <span className="trust-ico" aria-hidden="true">
                <svg viewBox="0 0 64 64" width="22" height="22" fill="none">
                  <defs><linearGradient id="ic-grad-3" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#37FFE4"/><stop offset="100%" stopColor="#5CE1FF"/></linearGradient></defs>
                  <polygon points="32,8 51,20 51,44 32,56 13,44 13,20" stroke="url(#ic-grad-3)" strokeWidth="2.2" fill="rgba(92,225,255,.08)"/>
                  <path d="M22 32h20M32 22v20M24 26l16 16M40 26L24 42" stroke="#E8FBF8" strokeWidth="1.8" opacity=".9"/>
                </svg>
              </span>
              <div className="trust-text">
                <span className="trust-cap full">Proof of Breath™</span>
                <span className="trust-val full">Breath-Backed · zk-verifiable</span>
              </div>
            </button>

            <button className="trust-chip" type="button" aria-label="Receipt Sealing: Amount, method, TX hash & pulse bind to glyph">
              <span className="trust-ico" aria-hidden="true">
                <svg viewBox="0 0 64 64" width="22" height="22" fill="none">
                  <defs><linearGradient id="ic-grad-4" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#A78BFA"/><stop offset="100%" stopColor="#37FFE4"/></linearGradient></defs>
                  <path d="M18 40a8 8 0 0 0 8 8h6" stroke="url(#ic-grad-4)" strokeWidth="2.2"/>
                  <path d="M28 24h-6a8 8 0 0 0 0 16h6" stroke="url(#ic-grad-4)" strokeWidth="2.2"/>
                  <rect x="34.5" y="18.5" width="16" height="24" rx="2.5" stroke="url(#ic-grad-4)" strokeWidth="2" fill="rgba(55,255,228,.07)"/>
                  <path d="M38 24h9M38 29h9M38 34h7" stroke="#E8FBF8" strokeWidth="1.8" opacity=".9"/>
                </svg>
              </span>
              <div className="trust-text">
                <span className="trust-cap full">Receipt Sealing</span>
                <span className="trust-val full">amount • method • TX • pulse → glyph</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ===== Centered Sigil ===== */}
      <div className="sigil-stack" style={{ display: "grid", placeItems: "center", margin: "16px 0 8px" }}>
        <SigilStage amount={Number.isFinite(amtNum) ? amtNum : 0} method={method} txid={txid || undefined} />
      </div>

      {/* ===== LIVE Φ CHART ===== */}
      {meta && clock && (
        <div className="inv-chart-block" style={{ margin: "8px 0 16px" }}>
          <KaiPriceChart
            points={[]}
            autoWidth
            height={240}
            title="Φ Value — Live (Kai pulses)"
            priceFn={livePriceFn}
            // windowPoints={240}
            // includeStyles
          />
        </div>
      )}

      {/* ===== Amount ===== */}
      <label className="inv-label" htmlFor="investor-amount">Amount (USD)</label>
      <div className="inv-input-bubble" style={{ marginBottom: 8 }}>
        <input
          id="investor-amount"
          className="investor-input"
          type="number"
          min={10}
          step="any"
          inputMode="decimal"
          placeholder="Type an amount… (e.g., 250)"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setError("");
            if (clientSecret) resetCard();
          }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); } }}
        />
      </div>
      <div className="inv-quick-stack" aria-label="Quick amounts" style={{ overflowX: "auto", paddingBottom: 2 }}>
        {quickTiers.map((v) => (
          <FastButton
            key={v}
            type="button"
            className={`investor-chip ${amount === String(v) ? "active" : ""}`}
            onClick={() => pickTier(v)}
            aria-pressed={amount === String(v)}
            title={`Set ${fmtUSD(v)}`}
          >
            ${v.toLocaleString()}
          </FastButton>
        ))}
      </div>

      {/* ===== Method ===== */}
      <label className="inv-label">Payment Method</label>
      <div className="investor-method-row" role="radiogroup" aria-label="Payment method">
        <FastButton
          type="button"
          className={`investor-method ${method === "card" ? "selected" : ""}`}
          onClick={() => setMethod("card")}
          role="radio"
          aria-checked={method === "card"}
          title="Card / Wallet (Stripe)"
        >
          <img src="/assets/pay-card.svg" alt="" className="investor-method-icon" />
          <span>Card</span>
        </FastButton>
        <FastButton
          type="button"
          className={`investor-method ${method === "bitcoin" ? "selected" : ""}`}
          onClick={() => setMethod("bitcoin")}
          role="radio"
          aria-checked={method === "bitcoin"}
          title="Bitcoin (peer to peer)"
        >
          <img src="/assets/pay-crypto.svg" alt="" className="investor-method-icon" />
          <span>₿TC</span>
        </FastButton>
      </div>

      {error && <div className="investor-error-banner">{error}</div>}

      {/* ===== Primary actions ===== */}
      {!clientSecret && !showBtc && (
        <div className="investor-button-row">
          <FastButton onClick={handleCancel} className="investor-button cancel" disabled={busy}>Cancel</FastButton>
          <FastButton onClick={handleContinue} className="investor-button glow" disabled={busy}>
            {busy ? "Preparing…" : `Continue with ${labelFor[method]} →`}
          </FastButton>
        </div>
      )}

      {/* ===== CARD ===== */}
      {clientSecret && intentId && (
        <div className="card-shell">
          <div className="card-shell-head">
            <div className="card-shell-title">Secure Payment</div>
            <FastButton className="investor-button cancel" onClick={resetCard}>Change Amount/Method</FastButton>
          </div>
          <div className="inv-note" role="note">
            <b>DEKREE · ☤ K℞K:</b> This is a sovereign akt. You do not beg, you do not ask — <b>you deklare</b>.
            By inhaling Φ you step out of Babylon’s discretionary issuance and into <b>truthful weights & measures</b>.
            You receive a <b>Sigil-Glyph</b> bound to your ΦKey (Poseidon commitment + Kai Signature); <b>proof is the authority</b>.
            <b> No ROI. No equity. Not a security.</b> Zero Knowledge Breath-backed sovereignty.
          </div>
          <Elements
            key={elementsKey}
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: "night",
                variables: {
                  colorPrimary: "#37FFE4",
                  colorBackground: "rgba(8,14,16,.6)",
                  colorText: "#E8FBF8",
                  colorTextSecondary: "#AEE8DF",
                  colorIcon: "#E8FBF8",
                },
                rules: {
                  ".Tab": { borderRadius: "10px" },
                  ".Input": { borderRadius: "10px", backgroundColor: "rgba(255,255,255,0.04)" },
                },
              },
              loader: "auto",
            }}
          >
            <CardCheckoutInner
              amount={amtNum}
              intentId={intentId}
              onConfirmed={handleCardConfirmed}
              onError={(msg) => setError(msg)}
            />
          </Elements>

          <p className="investor-fine">
            All payments are 3-D Secure and handled by Stripe (PCI compliant). We never see your card or wallet details.
          </p>
        </div>
      )}

      {/* ===== BITCOIN ===== */}
      {showBtc && (
        <div className="btc-panel">
          <div className="btc-title">Send Bitcoin</div>
          <div className="btc-sub">
            Please send <strong>{Number.isNaN(amtNum) ? "$—" : fmtUSD(amtNum)}</strong> worth of BTC to:
          </div>

          <div className="btc-box">
            <code className="btc-address">{BTC_ADDRESS}</code>
            <div className="btc-actions">
              <FastButton type="button" className="investor-button" onClick={() => copy(BTC_ADDRESS)}>
                {copied === "addr" ? "Copied ✓" : "Copy Address"}
              </FastButton>
              <a
                className="investor-button glow"
                href={BTC_ADDRESS ? `bitcoin:${BTC_ADDRESS}` : "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { if (!BTC_ADDRESS) e.preventDefault(); }}
              >
                Open in Wallet →
              </a>
            </div>
          </div>

          <div className="btc-note">
            Paste your <b>TXID</b>. We verify on-chain that the exact USD amount reached this address (req. {MIN_BTC_CONFS} conf
            {MIN_BTC_CONFS > 1 ? "s" : ""}). Your TXID + amount + method + pulse bind into a <b>deterministic Sigil</b>;
            the glyph hash is <b>zk-verifiable</b>. No screenshots — pure proof.
          </div>

          <label htmlFor="txid" className="inv-label">Transaction Hash (TXID)</label>
          <input
            id="txid"
            type="text"
            inputMode="text"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={txid}
            onChange={(e) => setTxid(e.target.value.trim())}
            placeholder="e.g. 4d3f…ab91"
            className="investor-input"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); } }}
          />

          {verifyMsg && <div className="inv-note" style={{ marginTop: 8 }}>{verifyMsg}</div>}

          <div className="btc-confirm-row">
            <FastButton
              type="button"
              className="investor-button glow"
              onClick={handleVerifyTx}
              disabled={verifyBusy || Number.isNaN(amtNum) || !txid}
            >
              {verifyBusy ? "Verifying on-chain…" : "Verify & Mint →"}
            </FastButton>
            <FastButton type="button" className="investor-button cancel" onClick={() => setShowBtc(false)}>
              Back
            </FastButton>
            {explorerUrl && (
              <a
                className="investor-button"
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="View on block explorer"
              >
                View TX →
              </a>
            )}
          </div>
        </div>
      )}

      {!clientSecret && !showBtc && (
        <p className="investor-fine">
          You are receiving <b>breath-backed kurrensy</b>, not a fiat return. On payment, a <b>Sigil-Glyph</b>
          inhales to your ΦKey with zk-verifiable receipt sealing. <b>Not a security. No fiat ROI.</b>
        </p>
      )}
      {/* ===== Live Φ panel ===== */}
      <LivePhiPanel
        amount={Number.isFinite(amtNum) ? amtNum : 0}
        method={method}
        meta={meta}
        nowPulse={clock?.nowPulse ?? null}
        pulsesPerBeat={clock?.pulsesPerBeat ?? null}
      />

      {/* ===== MINT PREVIEW ===== */}
      {Number.isFinite(amtNum) && amtNum > 0 && (
        <div className="roi-panel">
          <div className="roi-top">
            <span className="roi-cap">Mint Preview</span>
            <b className="roi-num roi-glow">{fmtUSD(ent.amount)}</b>
          </div>
          <div className="roi-bar" aria-label={`Progress to next ceremonial tier: ${Math.round(ent.pctToNext * 100)}%`}>
            <div className="roi-fill" style={{ width: `${ent.pctToNext * 100}%` }} />
            <div className="roi-dot" style={{ left: `${ent.pctToNext * 100}%` }} />
          </div>
          <div className="roi-grid">
            <div className="roi-cell"><span>Sigils (minted now)</span><b>{ent.sigilCount}</b></div>
            <div className="roi-cell"><span>Pulse binding</span><b>Deterministic, zk-verifiable</b></div>
            <div className="roi-cell"><span>Next tier at</span><b>{ent.nextTier > ent.amount ? fmtUSD(ent.nextTier) : "Max tier reached"}</b></div>
          </div>
          <div className="roi-note">
            You receive a <b>Sigil-Glyph</b> bound to your ΦKey with <b>Proof Of Breath™</b> (amount • method • pulse • TX if BTC).
            <b> Not a security. No fiat ROI.</b>
          </div>
        </div>
      )}

      {/* ===== INLINE CHAT ===== */}
      <div className="inv-chat-inline" role="region" aria-label="Inhale Assistant">
        <InvestorChat
          context={chatContext}
          onSetAmount={(next: number) => setAmount(String(next))}
          onChooseMethod={(m: Method) => setMethod(m)}
          onOpenPayment={() => {
            window.dispatchEvent(
              new CustomEvent<OpenPaymentEventDetail>("investor:openPayment", {
                detail: { amount: Number.isFinite(amtNum) ? amtNum : 0, suggestedMethod: method },
              })
            );
          }}
          apiEndpoint={`${API_BASE}/api/chat`}
          initiallyMinimized={false}
          initialDensity="comfy"
        />
      </div>

      {/* ===== Sovereign Verification Panel ===== */}
      <SecurityPanel />
    </div>
  );
};

export default InvestorSigilForm;
