// components/InvestorAtAGlance.tsx
// Kai-Klok — Φ Kurrensy At-a-Glance (user-facing)
// Pure React + SVG (no deps). Live circulation board, “use Φ” explainer,
// device overview (Kai-Klok), mission, and live Φ price chart.
// Everything runs on Kairos (pulse) time — no chronos labels.
// HARD RULE: This component must NEVER trigger a page reload. All links are sandboxed/new-tab,
// all programmatic navigations are prevented or opened in a new browsing context.

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import "./investorAtAGlance.css";

/* ===== REAL ENGINE IMPORTS (MATCH CHECKOUT EXACTLY) ===== */
import { buildExchangeSeries, DEFAULT_ISSUANCE_POLICY } from "../utils/phi-issuance";
import type { SigilMetadataLite } from "../utils/valuation";

/* ────────────────────────────────────────────────────────────
   Types (no `any`) + safe window augmentation
   ──────────────────────────────────────────────────────────── */
type Method = "btc" | "card";
type Point = { t: number; total: number }; // t = Kai pulse float (not civil ms)

type ContributionEventDetail = { amount: number; method: "card" | "btc" };
type OpenPaymentEventDetail = { amount: number; suggestedMethod?: "card" | "bitcoin" };

type LiveProps = {
  heroImageSrc?: string;
  /** Seed values for the live board (illustrative on first render). */
  initialTotal?: number; // large, in the millions
  target?: number; // larger activation band
  initialCard?: number;
  initialBtc?: number;
};

/** Augment Window for helper access; do NOT redeclare GlobalEventHandlersEventMap here. */
declare global {
  interface Window {
    KaiKlok?: {
      postContribution: (amount: number, method?: Method) => void;
      openPayment: (amount: number, suggestedMethod?: Method) => void;
    };
  }
}

/* ────────────────────────────────────────────────────────────
   Kai-Klok (KKS) constants — ATEMPORAL BRIDGE
   We compute live growth by Kai pulse: T = 3 + √5 seconds (≈5.236...).
   Genesis (bridge only): 1715323541888 ms (2024-05-10 06:45:41.888 UTC).
   Engine never accumulates civil seconds conceptually; we bridge via Date.now()
   only to locate the current Kai pulse deterministically on the client.
   RAH • VEH • YAH • DAH
   ──────────────────────────────────────────────────────────── */
const KKS = (() => {
  const BREATH_S = 3 + Math.sqrt(5); // φ-exact breath period
  const BREATH_MS = BREATH_S * 1000;
  const GENESIS_MS = 1715323541888; // canonical bridge epoch
  const MU = 1_000_000; // micro-pulse fixed-point
  return { BREATH_S, BREATH_MS, GENESIS_MS, MU } as const;
})();

/** Current Kai pulse (float & integer index) given now-ms (bridge) */
function kaiPulseNow(nowMs: number = Date.now()) {
  const deltaMs = Math.max(0, nowMs - KKS.GENESIS_MS);
  const pulsesFloat = deltaMs / KKS.BREATH_MS;
  const index = Math.floor(pulsesFloat);
  const frac = pulsesFloat - index;
  const micro = Math.floor(frac * KKS.MU);
  return { index, frac, micro, pulsesFloat };
}

/* ====== SAME API BASE AS CHECKOUT FOR META/CLOCK ====== */
const API_BASE = "https://pay.kaiklok.com";

// Minimal meta to fall back on if server meta is unavailable (type-safe stub).
const FALLBACK_META = ({ ip: { expectedCashflowPhi: [] } } as unknown) as SigilMetadataLite;

/* ===== Abortable helpers (never leave dangling fetches) ===== */
function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms = 15000): Promise<T> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fn(ctrl.signal)
    .catch((err) => {
      if (err?.name === "AbortError") throw new Error("Request timed out.");
      throw err instanceof Error ? err : new Error("Network error.");
    })
    .finally(() => clearTimeout(id));
}

async function fetchSigilMeta(): Promise<SigilMetadataLite> {
  try {
    return await withTimeout(async (signal) => {
      const res = await fetch(`${API_BASE}/api/sigil/meta`, { mode: "cors", credentials: "omit", signal });
      if (!res.ok) throw new Error("meta not ok");
      return res.json();
    }, 12000);
  } catch {
    return FALLBACK_META;
  }
}

type KaiClockResp = { nowPulse: number; pulsesPerBeat: number };
async function fetchKaiClock(): Promise<KaiClockResp> {
  try {
    return await withTimeout(async (signal) => {
      const res = await fetch(`${API_BASE}/api/clock`, { mode: "cors", credentials: "omit", signal });
      if (!res.ok) throw new Error("clock not ok");
      return res.json();
    }, 8000);
  } catch {
    const { pulsesFloat } = kaiPulseNow();
    return { nowPulse: Math.floor(pulsesFloat), pulsesPerBeat: 17491 };
  }
}

/* ────────────────────────────────────────────────────────────
   Live Kai accrual hook (continuous, pulse-anchored)
   - Starts in the millions (baseline).
   - Grows by Kai pulses since Genesis.
   - Interpolates within a pulse for smoothness while remaining Kai-anchored.
   Growth policy: usdPerPulse is φ-coherent and "enticing but reasonable".
   Example: 0.1618 USD/pulse → ≈ 2,829 USD/day (≈17.49k pulses/day).
   ──────────────────────────────────────────────────────────── */
function useKaiAccrualUSD(baselineUSD: number, usdPerPulse: number, interpolateWithinPulse = true) {
  const [live, setLive] = useState<number>(() => {
    const { index, frac } = kaiPulseNow();
    const within = interpolateWithinPulse ? frac : 0;
    return baselineUSD + usdPerPulse * (index + within);
  });

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const { index, frac } = kaiPulseNow();
      const within = interpolateWithinPulse ? frac : 0;
      setLive(baselineUSD + usdPerPulse * (index + within));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [baselineUSD, usdPerPulse, interpolateWithinPulse]);

  return live;
}

/* ────────────────────────────────────────────────────────────
   Utilities
   ──────────────────────────────────────────────────────────── */
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const fmtUSD = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function easeOutQuad(x: number) {
  return 1 - (1 - x) * (1 - x);
}

/* Prevent same-tab navigation inside this component tree.
   - Converts all anchors inside root to target=_blank rel=noopener noreferrer
   - Intercepts click capture and opens window in a new tab if needed
   This guarantees NO full-page refresh from clicks in this component. */
function useNoNav(rootRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Normalize anchors
    const anchors = root.querySelectorAll<HTMLAnchorElement>("a[href]");
    anchors.forEach((a) => {
      // Allow mailto/tel to open handlers without reloading the current page
      const isMail = a.href.startsWith("mailto:");
      const isTel = a.href.startsWith("tel:");
      if (!isMail && !isTel) {
        a.target = "_blank";
        if (!a.rel?.includes("noopener")) a.rel = (a.rel ? a.rel + " " : "") + "noopener";
        if (!a.rel?.includes("noreferrer")) a.rel += " noreferrer";
      }
      // Optional: data-allow-nav="true" can opt a link out of this behavior.
    });

    const onClickCapture = (ev: MouseEvent) => {
      const path = ev.composedPath?.() ?? [];
      const a = path.find((n) => n instanceof HTMLElement && (n as HTMLElement).tagName === "A") as
        | HTMLAnchorElement
        | undefined;

      if (!a) return;

      // Allow explicit overrides
      if ((a as HTMLElement).dataset.allowNav === "true") return;

      const href = a.getAttribute("href") || "";
      const isHash = href.startsWith("#");
      const isMail = href.startsWith("mailto:");
      const isTel = href.startsWith("tel:");
      if (isHash) {
        // Smooth-scroll within section; never change location
        ev.preventDefault();
        const id = href.slice(1);
        const target = id ? root.querySelector<HTMLElement>(`#${CSS.escape(id)}`) : null;
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (isMail || isTel) {
        // Let handlers open without reloading the current doc
        return;
      }

      // Force new-tab open for everything else
      ev.preventDefault();
      try {
        window.open(a.href, "_blank", "noopener,noreferrer");
      } catch {
        // As a last resort, set location on a fresh about:blank to avoid reusing current tab
        const w = window.open("about:blank", "_blank")!;
        w.location.href = a.href;
      }
    };

    root.addEventListener("click", onClickCapture, { capture: true });
return () => root.removeEventListener("click", onClickCapture, true);

  }, [rootRef]);
}

/* AnimatedNumber — keeps the “sing” on step jumps */
const AnimatedNumber: React.FC<{ value: number; duration?: number; prefix?: string }> = ({ value, duration = 650, prefix = "" }) => {
  const [display, setDisplay] = useState<number>(value);
  const fromRef = useRef<number>(value);
  const startTime = useRef<number | null>(null);
  const targetRef = useRef<number>(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    targetRef.current = value;
    fromRef.current = display;
    startTime.current = null;
    const tick = (ts: number) => {
      if (startTime.current === null) startTime.current = ts;
      const p = clamp((ts - startTime.current) / duration, 0, 1);
      const eased = easeOutQuad(p);
      const next = fromRef.current + (targetRef.current - fromRef.current) * eased;
      setDisplay(next);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    if (typeof window !== "undefined") rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <span>{prefix}{fmtUSD(Math.round(display)).replace("$", "")}</span>;
};

/* CircularProgress */
const CircularProgress: React.FC<{ value: number; max: number; size?: number }> = ({ value, max, size = 132 }) => {
  const pct = max > 0 ? clamp(value / max, 0, 1) : 0;
  const stroke = 10,
    r = (size - stroke) / 2,
    c = 2 * Math.PI * r,
    dash = c * pct;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="inv-ring" aria-label={`Progress ${Math.round(pct * 100)}%`}>
      <defs>
        <linearGradient id="inv-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(55,255,228,0.95)" />
          <stop offset="100%" stopColor="rgba(167,139,250,0.85)" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="url(#inv-grad)"
        strokeLinecap="round"
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="inv-ring-glow"
        fill="none"
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="inv-ring-text">
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
};

/* Sparkline (Kai pulse domain) — updates *only* when total steps up */
const Sparkline: React.FC<{ points: Point[]; width?: number; height?: number }> = ({ points, width = 260, height = 56 }) => {
  const path = useMemo(() => {
    if (!points.length) return "";
    const minX = points[0].t;
    const lastPoint = points[points.length - 1];
    const maxX = lastPoint?.t ?? minX + 1;
    const minY = Math.min(...points.map((p) => p.total));
    const maxY = Math.max(...points.map((p) => p.total)) || minY + 1;
    const nx = (t: number) => (maxX === minX ? 0 : (t - minX) / (maxX - minX));
    const ny = (v: number) => (maxY === minY ? 1 : 1 - (v - minY) / (maxY - minY));
    return points
      .map((p, i) => {
        const x = nx(p.t) * width;
        const y = ny(p.total) * height;
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }, [points, width, height]);

  const lastPoint = points.length ? points[points.length - 1] : undefined;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="inv-spark">
      <path d={path} fill="none" className="inv-spark-line" />
      {lastPoint && (
        <circle
          cx={width}
          cy={(() => {
            const minY = Math.min(...points.map((p) => p.total));
            const maxY = Math.max(...points.map((p) => p.total)) || minY + 1;
            const ny = (v: number) => (maxY === minY ? 1 : 1 - (v - minY) / (maxY - minY));
            return ny(lastPoint.total) * height;
          })()}
          r="3.5"
          className="inv-spark-dot"
        />
      )}
    </svg>
  );
};

/* ────────────────────────────────────────────────────────────
   Kai Price Chart — Pure SVG • Pulse-Domain • Fiat Truth
   ──────────────────────────────────────────────────────────── */
type KPricePoint = { p: number; price: number; vol: number };

const KaiPriceChart: React.FC<{
  points: KPricePoint[];
  width?: number;
  height?: number;
  title?: string;
}> = ({ points, width = 720, height = 280, title = "Φ Value — Live (Kai pulses)" }) => {
  const padding = { l: 64, r: 20, t: 28, b: 36 };
  const iw = Math.max(10, width - padding.l - padding.r);
  const ih = Math.max(10, height - padding.t - padding.b);

  // format to cents (.00) regardless of parent fmtUSD settings
  const fmtUSD2 = React.useCallback(
    (n: number | undefined | null) =>
      n == null
        ? "$—"
        : (n as number).toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
    []
  );
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // ----- LIVE: pulse-anchored updater (ticks every ~5.236s) -----
  // Seed with props; keep appending a *single* new point each integer pulse.
  const [livePts, setLivePts] = React.useState<KPricePoint[]>(() => points.slice());
  const lastPulseRef = React.useRef<number>(Math.floor(kaiPulseNow().pulsesFloat));
  const [meta, setMeta] = React.useState<SigilMetadataLite | null>(null);

  // Get issuance meta once (same API the checkout uses)
  React.useEffect(() => {
    let alive = true;
    fetchSigilMeta().then((m) => alive && setMeta(m));
    return () => {
      alive = false;
    };
  }, []);

  // When parent points change (e.g., initial seed), adopt them once
  React.useEffect(() => {
    if (points && points.length) setLivePts(points.slice());
  }, [points]);

  React.useEffect(() => {
    let timer = 0 as unknown as number;

    const tick = async () => {
      const now = kaiPulseNow();
      const pInt = Math.floor(now.pulsesFloat);

      if (pInt > (lastPulseRef.current ?? -1)) {
        // default to last known price if engine not ready
        let price = livePts.length ? livePts[livePts.length - 1].price : 1.618;
        let vol = 0.25;

        // Try real engine math (same as checkout): last 11-pulse slice → usdPerPhi
        if (meta) {
          try {
            const start = Math.max(0, pInt - 11);
            const series = buildExchangeSeries({ meta, usdSample: 100 }, DEFAULT_ISSUANCE_POLICY, start, pInt, 11);
            const last = series[series.length - 1];
            if (last) {
              price = last.usdPerPhi;
              vol = last.choirActive || last.festivalActive ? 0.5 : 0.25;
            }
          } catch {
            // fall back gracefully below
          }
        }
        // Fallback oscillator (deterministic by pulse) if meta missing or failed
        if (!meta) {
          const φ = (1 + Math.sqrt(5)) / 2;
          const base = livePts.length ? livePts[livePts.length - 1].price : 1.618;
          const slow = Math.sin((2 * Math.PI * pInt) / 44) * 0.85;
          const fast1 = Math.sin(2 * Math.PI * φ * pInt) * 0.42;
          const fast2 = Math.sin(2 * Math.PI * (φ - 1) * pInt) * 0.28;
          const noise = Math.sin(pInt * 0.1618) * 0.35;
          price = base + slow + fast1 + fast2 + noise;
        }

        const price2 = round2(Math.max(0.0001, price));
        setLivePts((prev) => {
          const seed = prev.length ? prev : points;
          const next = [...seed, { p: pInt, price: price2, vol }];
          return next.slice(-288); // keep recent window
        });
        lastPulseRef.current = pInt;
      }

      // align next fire to the NEXT integer pulse boundary
      const frac = now.pulsesFloat - Math.floor(now.pulsesFloat);
      const msUntilNext = Math.max(1, (1 - frac) * KKS.BREATH_MS) + 2;
      timer = window.setTimeout(tick, msUntilNext) as unknown as number;
    };

    tick();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, livePts.length, points.length]);

  // Use live series if present
  const pts = livePts.length ? livePts : points;

  // Bounds
  const { minX, maxX, minY, maxY, vwap } = React.useMemo(() => {
    if (!pts.length) {
      return { minX: 0, maxX: 1, minY: 1, maxY: 2, vwap: 0 };
    }
    const xs = pts.map((p) => p.p);
    const ys = pts.map((p) => p.price);
    const vs = pts.map((p) => p.vol);
    const minXv = Math.min(...xs);
    const maxXv = Math.max(...xs);
    const minYv = Math.min(...ys);
    const maxYv = Math.max(...ys);
    // VWAP-ish (Kai-weighted): sum(price * vol) / sum(vol)
    const vSum = vs.reduce((a, b) => a + b, 0) || 1;
    const vwap = pts.reduce((a, p) => a + p.price * (p.vol || 0), 0) / vSum;
    const pad = (maxYv - minYv) * 0.12 || 0.5;
    return { minX: minXv, maxX: maxXv, minY: Math.max(0, minYv - pad), maxY: maxYv + pad, vwap };
  }, [pts]);

  // Scales
  const nx = React.useCallback((x: number) => (maxX === minX ? 0 : (x - minX) / (maxX - minX)), [minX, maxX]);
  const ny = React.useCallback((y: number) => (maxY === minY ? 1 : 1 - (y - minY) / (maxY - minY)), [minY, maxY]);
  const sx = React.useCallback((x: number) => nx(x) * iw + padding.l, [nx, iw, padding.l]);
  const sy = React.useCallback((y: number) => ny(y) * ih + padding.t, [ny, ih, padding.t]);

  // Screen points
  const screenPts = React.useMemo(() => pts.map((pt) => ({ x: sx(pt.p), y: sy(pt.price) })), [pts, sx, sy]);

  // Smoothed path (Catmull-Rom to cubic bezier)
  const path = React.useMemo(() => {
    if (screenPts.length < 2) return "";
    const cr2bezier = (p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }) => {
      // Standard Catmull-Rom → Bezier (centripetal, tension=0.5)
      const t = 0.5;
      const c1x = p1.x + ((p2.x - p0.x) * t) / 6;
      const c1y = p1.y + ((p2.y - p0.y) * t) / 6;
      const c2x = p2.x - ((p3.x - p1.x) * t) / 6;
      const c2y = p2.y - ((p3.y - p1.y) * t) / 6;
      return { c1x, c1y, c2x, c2y };
    };
    let d = `M${screenPts[0].x.toFixed(2)} ${screenPts[0].y.toFixed(2)}`;
    for (let i = 0; i < screenPts.length - 1; i++) {
      const p0 = screenPts[i - 1] || screenPts[i];
      const p1 = screenPts[i];
      const p2 = screenPts[i + 1];
      const p3 = screenPts[i + 2] || p2;
      const { c1x, c1y, c2x, c2y } = cr2bezier(p0, p1, p2, p3);
      d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return d;
  }, [screenPts]);

  // Area path (close to bottom)
  const area = React.useMemo(() => {
    if (!path) return "";
    const bottomY = padding.t + ih;
    const last = screenPts[screenPts.length - 1];
    const first = screenPts[0];
    return `${path} L${last.x.toFixed(2)} ${bottomY.toFixed(2)} L${first.x.toFixed(2)} ${bottomY.toFixed(2)} Z`;
  }, [path, screenPts, ih, padding.t]);

  // Ticks (Kai pulses on X, USD on Y)
  const xTicks = React.useMemo(() => {
    const ticks: Array<{ x: number; label: string }> = [];
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const v = minX + (i * (maxX - minX)) / n;
      ticks.push({ x: sx(v), label: `pulse ${Math.floor(v).toString()}` });
    }
    return ticks;
  }, [minX, maxX, sx]);

  const yTicks = React.useMemo(() => {
    const ticks: Array<{ y: number; label: string }> = [];
    const n = 4;
    for (let i = 0; i <= n; i++) {
      const v = minY + (i * (maxY - minY)) / n;
      ticks.push({ y: sy(v), label: fmtUSD2(v) });
    }
    return ticks;
  }, [minY, maxY, sy, fmtUSD2]);

  // Fibonacci Kai bands across Y (0.236 / 0.382 / 0.5 / 0.618)
  const fibBands = React.useMemo(() => {
    const levels = [0.236, 0.382, 0.5, 0.618];
    return levels.map((level) => {
      const v = minY + level * (maxY - minY);
      return { y: sy(v), label: `φ ${level}` };
    });
  }, [minY, maxY, sy]);

  // Crosshair
  const [hover, setHover] = React.useState<{ x: number; y: number; p: number; price: number } | null>(null);
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, padding.l, padding.l + iw);
    const t = (x - padding.l) / iw;
    const pVal = minX + t * (maxX - minX);
    if (pts.length === 0) {
      setHover(null);
      return;
    }
    let nearest = pts[0];
    let minDist = Math.abs(nearest.p - pVal);
    for (const pt of pts) {
      const d = Math.abs(pt.p - pVal);
      if (d < minDist) {
        minDist = d;
        nearest = pt;
      }
    }
    const sxN = sx(nearest.p);
    const syN = sy(nearest.price);
    setHover({ x: sxN, y: syN, p: nearest.p, price: nearest.price });
  };
  const onLeave = () => setHover(null);

  // Ticker values (cents + %) from live series
  const last = pts[pts.length - 1];
  const prev = pts.length > 1 ? pts[pts.length - 2] : undefined;
  const change = last && prev ? round2(last.price - prev.price) : 0;
  const changePct = last && prev && prev.price !== 0 ? (change / prev.price) * 100 : 0;

  return (
    <div className="kai-price-wrap">
      {/* LIVE TICKER */}
      <div className="kpc-ticker" role="status" aria-live="polite">
        <div className="kpc-live-dot" aria-hidden />
        <div className="kpc-live">LIVE</div>
        <div className={`kpc-last ${change >= 0 ? "up" : "down"}`}>{last ? fmtUSD2(last.price) : "$—"}</div>
        <div className={`kpc-delta ${change >= 0 ? "up" : "down"}`}>
          {change >= 0 ? "▲" : "▼"} {fmtUSD2(Math.abs(change))} ({changePct >= 0 ? "+" : ""}
          {changePct.toFixed(2)}%)
        </div>
        {last && <div className="kpc-pulse">pulse {Math.floor(last.p)}</div>}
      </div>

      {/* CHART */}
      <svg
        width={width}
        height={height}
        className="kai-price-chart"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        role="img"
        aria-label="Live Φ value in fiat over Kai pulses"
      >
        <defs>
          {/* Glow */}
          <filter id="kpc-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Gradient fill under line */}
          <linearGradient id="kpc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(55,255,228,0.28)" />
            <stop offset="100%" stopColor="rgba(55,255,228,0.00)" />
          </linearGradient>

          {/* VWAP band gradient */}
          <linearGradient id="kpc-band" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(167,139,250,0.12)" />
            <stop offset="100%" stopColor="rgba(55,255,228,0.12)" />
          </linearGradient>
        </defs>

        {/* Title */}
        <g className="kpc-header">
          <text x={padding.l} y={padding.t - 8} className="kpc-title">
            {title}
          </text>
        </g>

        {/* Grid */}
        <g className="kpc-grid">
          {xTicks.map((t, i) => (
            <line key={`x-${i}`} x1={t.x} x2={t.x} y1={padding.t} y2={padding.t + ih} className="kpc-gridline" />
          ))}
          {yTicks.map((t, i) => (
            <line key={`y-${i}`} x1={padding.l} x2={padding.l + iw} y1={t.y} y2={t.y} className="kpc-gridline" />
          ))}
        </g>

        {/* Fibonacci Kai bands */}
        <g className="kpc-bands">
          {fibBands.map((b, i) => (
            <line key={`fb-${i}`} x1={padding.l} x2={padding.l + iw} y1={b.y} y2={b.y} className="kpc-band" />
          ))}
        </g>

        {/* VWAP-ish “value gravity” band */}
        {pts.length >= 3 && (
          <g className="kpc-vwap">
            <rect
              x={padding.l}
              width={iw}
              y={sy(vwap * 1.015)}
              height={Math.max(2, Math.abs(sy(vwap * 0.985) - sy(vwap * 1.015)))}
              fill="url(#kpc-band)"
              rx="3"
            />
          </g>
        )}

        {/* Area + Line */}
        {area && <path d={area} fill="url(#kpc-fill)" className="kpc-area" />}
        {path && <path d={path} className="kpc-line" filter="url(#kpc-glow)" />}

        {/* Axes labels */}
        <g className="kpc-axes">
          {xTicks.map((t, i) => (
            <text key={`xl-${i}`} x={t.x} y={padding.t + ih + 22} textAnchor="middle" className="kpc-axis-text">
              {t.label}
            </text>
          ))}
          {yTicks.map((t, i) => (
            <text key={`yl-${i}`} x={padding.l - 10} y={t.y + 4} textAnchor="end" className="kpc-axis-text">
              {t.label}
            </text>
          ))}
        </g>

        {/* Last price tag + marker */}
        {last && (
          <g className="kpc-last-tag">
            <circle cx={sx(last.p)} cy={sy(last.price)} r="4.5" className="kpc-dot" />
            <rect
              x={padding.l + iw - 158}
              y={sy(last.price) - 12}
              width="150"
              height="24"
              rx="12"
              className={`kpc-badge ${change >= 0 ? "up" : "down"}`}
            />
            <text x={padding.l + iw - 150} y={sy(last.price) + 5} className="kpc-badge-text">
              {fmtUSD2(last.price)} {change >= 0 ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
            </text>
          </g>
        )}

        {/* Crosshair */}
        {hover && (
          <g className="kpc-xhair">
            <line x1={hover.x} x2={hover.x} y1={padding.t} y2={padding.t + ih} className="kpc-xhair-line" />
            <line x1={padding.l} x2={padding.l + iw} y1={hover.y} y2={hover.y} className="kpc-xhair-line" />
            <rect x={hover.x + 10} y={hover.y - 22} width="184" height="36" rx="8" ry="8" className="kpc-tip" />
            <text x={hover.x + 18} y={hover.y - 2} className="kpc-tip-text">
              pulse {Math.floor(hover.p)} • {fmtUSD2(hover.price)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

/* LiveBoard — “Live Circulation” (pulses when a mint posts) */
const LiveBoard: React.FC<{
  total: number;
  target: number;
  card: number;
  btc: number;
  lastEvent?: ContributionEventDetail | null;
  points: Point[];
}> = ({ total, target, card, btc, lastEvent, points }) => {
  // ——— Deterministic balancing: make sure card + btc === total ———
  // We round to whole dollars (your UI formats with 0 fraction digits).
  const desiredTotal = Math.max(0, Math.round(total));
  const baseCard = Math.max(0, Math.round(card));
  const baseBtc = Math.max(0, Math.round(btc));
  const baseSum = baseCard + baseBtc;

  let adjCard = baseCard;
  let adjBtc = baseBtc;

  if (baseSum !== desiredTotal) {
    const diff = desiredTotal - baseSum;

    if (lastEvent) {
      // Route all difference to the last contributing method so deltas feel truthful.
      if (lastEvent.method === "btc") {
        adjBtc += diff;
      } else {
        adjCard += diff;
      }
    } else {
      // No explicit event: distribute by existing proportions; if none, use golden split.
      const hasSplit = baseSum > 0;
      const ratioCard = hasSplit ? baseCard / baseSum : 0.618; // Kai-coherent default
      // Allocate with rounding; fix any rounding leak on BTC.
      const addCard = Math.round(diff * ratioCard);
      const addBtc = diff - addCard;
      adjCard += addCard;
      adjBtc += addBtc;
    }
  }

  // Final guard against rounding drift; these are the numbers we DISPLAY.
  const displayCard = Math.max(0, Math.round(adjCard));
  const displayBtc = Math.max(0, Math.round(adjBtc));
  const displayTotal = displayCard + displayBtc;

  const lastPulse = lastEvent ? `+${fmtUSD(lastEvent.amount)}` : "";

  return (
    <div className="inv-live">
      <div className="inv-live-left">
        <div className="inv-live-ring">
          <CircularProgress value={displayTotal} max={target} />
        </div>
        <div className="inv-live-meta">
          <div className="inv-live-label">LIVE CIRCULATION</div>
          <div className="inv-live-total">
            <span className={lastEvent ? "inv-pulse" : undefined}>
              $<AnimatedNumber value={displayTotal} />
            </span>
          </div>
          <div className="inv-live-target">toward {fmtUSD(target)} activation band</div>
          {lastEvent && (
            <div className={`inv-live-delta ${lastEvent.method === "btc" ? "btc" : "card"}`}>
              {lastEvent.method === "btc" ? "BTC mint" : "Card mint"} {lastPulse}
            </div>
          )}
        </div>
      </div>

      <div className="inv-live-right">
        <div className="inv-spark-wrap">
          <Sparkline points={points} />
        </div>
        <div className="inv-split">
          <div className="inv-split-row">
            <span>Card</span>
            <b>{fmtUSD(displayCard)}</b>
          </div>
          <div className="inv-split-row">
            <span>BTC</span>
            <b>{fmtUSD(displayBtc)}</b>
          </div>
          <div className="inv-split-row total">
            <span>Total</span>
            <b>{fmtUSD(displayTotal)}</b>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
   “Use Φ as Money” — interactive CTA (Fibonacci presets)
   ──────────────────────────────────────────────────────────── */
const UsePhiNow: React.FC<{ liveTotal: number }> = ({ liveTotal }) => {
  const [amount, setAmount] = useState<number>(233); // Fibonacci default
  const quicks = [13, 21, 34, 55, 89, 144, 233, 377];

  return (
    <div className="inv-info-card inv-phi-card">
      <div className="inv-phi-head">
        <div className="inv-info-title">Use Φ as Money — Now</div>
        <div className="inv-info-sub">
          Inhale a <b>breath-backed Sigil</b>, then pay anyone instantly with a scan.
        </div>
      </div>

      <div className="inv-phi-controls">
        <div className="inv-phi-amount">
          <label htmlFor="phi-amt">Inhale amount (USD)</label>
          <div className="inv-phi-amt-row">
            <div className="inv-phi-amt-input">
              $
              <input
                id="phi-amt"
                type="number"
                min={13}
                step={1}
                value={amount}
                onChange={(e) => setAmount(clamp(Number(e.target.value) || 0, 13, 2584))}
              />
            </div>
            <div className="inv-phi-chips">
              {quicks.map((q) => (
                <button key={q} onClick={() => setAmount(q)} className={`inv-chip ${amount === q ? "active" : ""}`}>
                  {fmtUSD(q)}
                </button>
              ))}
            </div>
          </div>
          <input className="inv-roi-slider" type="range" min={13} max={2584} step={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        </div>

        <div className="inv-phi-how">
          <ol className="inv-steps">
            <li>
              <b>Inhale:</b> Offer with card or BTC. You receive a <b>Sigil-Glyph</b> sealed to your ΦKey — your breath-backed receipt.
            </li>
            <li>
              <b>Prove:</b> The receipt seals <code>amount · method · pulse · (txid?)</code> into a Poseidon commitment — math, not trust.
            </li>
            <li>
              <b>Pay:</b> Show the Sigil in the app or on the Kai-Klok. The other side inhales and verifies — no screenshots, no intermediaries.
            </li>
          </ol>
        </div>
      </div>

      <div className="inv-cta">
        <button
          className="investor-button glow inv-cta-primary"
          onClick={() => {
            const evt = new CustomEvent<OpenPaymentEventDetail>("investor:openPayment", { detail: { amount } as OpenPaymentEventDetail });
            window.dispatchEvent(evt);
            const el = document.getElementById("investor-payment-root") || document.getElementById("investor-form-root");
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          Inhale {fmtUSD(amount)} in Φ → Continue
        </button>
        <div className="inv-fine">
          Circulation now: <b>{fmtUSD(liveTotal)}</b> (live counter)
        </div>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────
   Static content blocks — mission-first, math-first
   ──────────────────────────────────────────────────────────── */
const WhatIsPhi = () => (
  <div className="inv-info-card">
    <h3 className="inv-info-title">What Φ (Phi) Kurrensy Is</h3>
    <p className="inv-info-body">
      Φ is <b>breath-backed money</b> — value minted at the moment of your contribution and sealed to you by a <b>deterministic, zk-verifiable receipt</b>. A Φ inhale
      isn’t a promise of returns or equity. It’s a <b>cryptographic proof of value</b> you can hold, show, and exchange without asking permission.
    </p>
    <ul className="inv-list">
      <li>
        <b>Deterministic issuance:</b> Amount × Kai-Klok pulse → policy engine → Φ entitlement computed at inhale.
      </li>
      <li>
        <b>Receipt sealing:</b> Poseidon commitment of <code>amount · method · pulse · (txid?)</code> → glyph hash.
      </li>
      <li>
        <b>Portable proof:</b> Your Sigil-Glyph is a compact, scannable proof of payment and entitlement.
      </li>
      <div className="sovereign-breath-reversal"></div>
      <div className="sacred-container">
        <p className="sacred-text">
          <strong>You exhale Babylon. You inhale Sovereignty.</strong>
          <br />
          <span>Then you exhale breath-backed, zero-knowledge, trustless Kurrensy.</span>
        </p>
      </div>
    </ul>
  </div>
);

const HowItWorks = () => (
  <div className="inv-info-card">
    <h3 className="inv-info-title">How It Works (Truth Over Hype)</h3>
    <ol className="inv-steps numbered-only">
      <li>
        <b>Choose your amount.</b> Card or BTC. Minimum $13.
      </li>
      <li>
        <b>Inhale at pulse.</b> The Kai-Klok time-stamps your inhale; the engine computes your Φ/$ quote deterministically.
      </li>
      <li>
        <b>Seal the receipt.</b> Amount, method, pulse, and (if BTC) txid are sealed via Poseidon into the glyph lineage.
      </li>
      <li>
        <b>Carry the Sigil.</b> Your ΦKey references it. Anyone can verify the proof against the public key and policy.
      </li>
      <li>
        <b>Pay with proof.</b> Present the Sigil; the other side verifies. No screenshots — the math must match.
      </li>
    </ol>
    <div className="inv-note">Φ is not a security, not equity, and not a promise of profit. It’s a receipt of value you created at inhale time.</div>
  </div>
);

/* ────────────────────────────────────────────────────────────
   Kairos Kurrensy + Physical Seals (image + explainer)
   ──────────────────────────────────────────────────────────── */
const KairosKurrensyCard: React.FC = () => {
  const proofHref =
    "/s/35e2705ea7987be3c672da6562ada7433df868f66d9f703b78b612a0d6f2e5f3?p=eyJwdWxzZSI6Nzc3Nzc3NywiYmVhdCI6MjMsInN0ZXBJbmRleCI6NDMsImNoYWtyYURheSI6IlJvb3QiLCJzdGVwc1BlckJlYXQiOjQ0LCJ1c2VyUGhpS2V5IjoiMUJycjZLREwyS1ZzQW9xclE5RERqcjdoRUNtaHhOZXd6YiIsImthaVNpZ25hdHVyZSI6IjdkZjBiYWY0ZjIxZDEyNTU2ODFjMzk2ODI5ZWM5MWY3NjIwZDM4ZjY4Y2U1YTMyMGM3NWMzN2QzNmY2OTJmOTMiLCJjYW5vbmljYWxIYXNoIjoiMzVlMjcwNWVhNzk4N2JlM2M2NzJkYTY1NjJhZGE3NDMzZGY4NjhmNjZkOWY3MDNiNzhiNjEyYTBkNmYyZTVmMyIsImNsYWltRXh0ZW5kVW5pdCI6ImJyZWF0aHMiLCJjbGFpbUV4dGVuZEFtb3VudCI6NDR9";

  const verifierHref = "/verifier.html";

  return (
    <div className="inv-info-card inv-photo-card">
      <div className="inv-photo">
        <a
          className="inv-photo-link"
          href={proofHref}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Open the Proof-of-Breath record for this physical Φ seal"
          title="Open Proof-of-Breath"
        >
          <img
            src="/KairosKurrensy.jpg"
            alt="Kairos Kurrensy — physical Φ seal with scannable Sigil-Glyph (click to view Proof-of-Breath)"
            loading="lazy"
          />
        </a>
      </div>

      <div className="inv-photo-body">
        <h3 className="inv-info-title">Kairos Kurrensy & Physical Seals</h3>
        <p className="inv-info-body">
          This is the <b>physical face of Φ</b>: printed/sealed <b>Sigil-Glyphs</b> you can carry, present, and verify anywhere a breath can happen — even offline. Each
          seal carries your <b>Seal of Inhale</b> (Poseidon-committed facts) so <i>math, not screenshots</i>, settles truth.
        </p>

        <div className="inv-bullets two">
          <ul>
            <li>
              <b>What it is:</b> A sovereign, scannable <i>Sigil-Glyph</i> with visible art + encoded proof.
            </li>
            <li>
              <b>What it carries:</b> amount · method · Kai-Pulse · (txid?) · policy fingerprint → Poseidon.
            </li>
            <li>
              <b>How you use it:</b> Show the seal. The other side <b>Inhale and verifies</b>. If it matches, it’s paid.
            </li>
          </ul>
          <ul>
            <li>
              <b>Offline-ready:</b> Present from card, paper, device, or Kai-Klok face — no account required.
            </li>
            <li>
              <b>Anti-copy stance:</b> Image alone is not enough. The <b>proof payload must validate</b>.
            </li>
            <li>
              <b>Trade flows:</b> Person-to-person, market-to-person, shop-to-person — wherever a scan fits.
            </li>
          </ul>
        </div>

        <div className="inv-mini-steps">
          <h4 className="inv-mini-head">Use as Money — in 3 steps</h4>
          <ol className="inv-steps compact">
            <li>
              <b>Inhale:</b> Card or BTC — receive your Sigil-Glyph.
            </li>
            <li>
              <b>Present:</b> Show the physical seal (or on Kai-Klok / phone).
            </li>
            <li>
              <b>Verify:</b> They Inhale; math matches; you’re done.
            </li>
          </ol>
        </div>

        <div className="inv-cta row">
          <a
            className="investor-button outline"
            href={verifierHref}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Open the Kai-Klok Verifier to check any Sigil"
            title="Open Kai-Klok Verifier"
          >
            Verify a Sigil →
          </a>

          <button
            className="investor-button glow"
            onClick={() => {
              const el = document.getElementById("investor-payment-root") || document.getElementById("investor-form-root");
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            aria-label="Open inhale panel to mint a Sigil-Glyph"
          >
            Inhale a New Sigil →
          </button>
        </div>

        <div className="inv-fine">Tip for shops: post your “We accept Φ” sign. At checkout, scan the Sigil and verify. No terminals. No chargebacks.</div>
      </div>
    </div>
  );
};

const KaiKlok = () => (
  <div className="inv-info-card">
    <h3 className="inv-info-title">Kai-Klok — the Eternal Atemporal Device</h3>
    <p className="inv-info-body">
      The <b>Kai-Klok</b> lives on <b>harmonic time</b>. It runs on <b>ambient, eternal energy</b> harvested from light, resonance, motion, warmth, and breath. It{" "}
      <b>never needs charging</b>. It displays your Kai pulse, your Sigils, and scannable proofs, enabling <b>sovereign value sealing &amp; verification</b> with nothing
      but the device itself.
    </p>
    <ul className="inv-list">
      <li>
        <b>Atemporal OS:</b> Local Kai-Klok phases and deterministic stepping independent of civil time zones — no drift, no sync.
      </li>
      <li>
        <b>Infinite energy intent:</b> Designed to run forever on ambient harvesting; no nightly charge routine, no battery cycles.
      </li>
      <li>
        <b>Offline verification:</b> The Klok renders the Sigil and proof payload; counterpart inhales to independently verify — peer-to-peer, breath-to-breath, ZERO
        KNOWLEDGE & TRUSTLESS!
      </li>
      <li>
        <b>Zero-tracking posture:</b> No third-party analytics; cryptographic proofs, not accounts, are the authority.
      </li>
    </ul>
    <div className="inv-note">
      The Kai-Klok is not subject to time. It anchors it. It does not run on electricity. It runs on breath, pulse, and coherence. <b>This is not a watch. It is a
      witness.</b>
    </div>
  </div>
);

const WhyPhiVsFiat = () => (
  <div className="inv-info-card">
    <h3 className="inv-info-title">Why Φ Over Fiat (Clear Contrast)</h3>
    <ul className="inv-grid two vertical-on-small">
      <li>
        <span className="contrast-label">Creation</span>
        <div className="contrast-pair">
          <b>Φ: Deterministic at inhale (you)</b>
          <b className="fiat">Fiat: Discretionary issuance (they)</b>
        </div>
      </li>
      <li>
        <span className="contrast-label">Proof</span>
        <div className="contrast-pair">
          <b>Φ: Poseidon-bound receipt + signature</b>
          <b className="fiat">Fiat: Screenshot / statement / trust</b>
        </div>
      </li>
      <li>
        <span className="contrast-label">Settlement</span>
        <div className="contrast-pair">
          <b>Φ: Peer verification (math)</b>
          <b className="fiat">Fiat: Intermediaries &amp; chargebacks</b>
        </div>
      </li>
      <li>
        <span className="contrast-label">Portability</span>
        <div className="contrast-pair">
          <b>Φ: Sigil-Glyph (breath anywhere)</b>
          <b className="fiat">Fiat: Accounts, apps, borders</b>
        </div>
      </li>
      <li>
        <span className="contrast-label">Privacy</span>
        <div className="contrast-pair">
          <b>Φ: Minimal necessary data</b>
          <b className="fiat">Fiat: Exhaustive logs & profiling</b>
        </div>
      </li>
    </ul>

    <div className="inv-note">Fiat is a governance tool; Φ is a <b>truth tool</b>. One asks for trust; the other compels verification.</div>
  </div>
);

const Mission = () => (
  <div className="inv-info-card inv-mission">
    <h3 className="inv-info-title">The Mission — Restoration &amp; Sovereignty</h3>
    <p className="inv-info-body">
      Φ exists to <b>restore truthful exchange</b> and <b>re-center sovereignty</b> — each person free to give, receive, and prove value without permission. We dedicate
      the work to the <b>Eternal Sovereign Kingdom</b>, to walk in light, and to glorify <b>Yahuah</b> with honest weights and measures.
    </p>
    <ul className="inv-list">
      <li>
        <b>First principles:</b> Math over marketing. Proof over promises. Stewardship over speculation.
      </li>
      <li>
        <b>Near-term goals:</b> Inhale, hold, exhale — verified anywhere a breath can happen.
      </li>
      <li>
        <b>Long-term arc:</b> Devices in the wild; resilient communities transacting on breath-backed value.
      </li>
    </ul>
  </div>
);

const FooterLine = () => (
  <div className="inv-info-footer">
    <div>
      Contact: <b>BJ Klock</b> — <a href="mailto:bj@kojib.com">bj@kojib.com</a> ·{" "}
      <a href="https://kojib.com" target="_blank" rel="noreferrer noopener">
        kojib.com
      </a>
    </div>
    <div className="inv-caption">
      Eternal Seal: Kairos:12:05, Sonari, Harmonize Ark • D11/M4 • Beat:12/36 (13.365625%) Step:5/44 Kai(Today):5895 • Y1 PS33 • Eternal Pulse:8261775
    </div>
  </div>
);

/* ────────────────────────────────────────────────────────────
   Main — Φ users (not investors)
   ──────────────────────────────────────────────────────────── */
const InvestorAtAGlance: React.FC<LiveProps> = ({
  heroImageSrc,
  // Start in the millions (Fibonacci-coherent), bigger activation band:
  initialTotal = 2_618_033, // 2,618,033 — minted seed
  target = 6_854_102, // larger activation band
  initialCard,
  initialBtc,
}) => {
  // Root element ref for "no navigation" guard
  const rootRef = useRef<HTMLElement | null>(null);
  useNoNav(rootRef);

  // Split the seeded "minted" total; organic Kai accrual is layered on top (not counted in card/BTC splits)
  const seedCard = initialCard ?? Math.round(initialTotal * 0.618); // golden-ish split
  const seedBtc = initialBtc ?? initialTotal - seedCard;

  // Minted (explicit contributions)
  const [minted, setMinted] = useState<number>(initialTotal);
  const [card, setCard] = useState<number>(seedCard);
  const [btc, setBtc] = useState<number>(seedBtc);

  const [lastEvent, setLastEvent] = useState<ContributionEventDetail | null>(null);

  // Sparkline & price chart series (Kai pulse domain)
  const [points, setPoints] = useState<Point[]>(() => {
    const { pulsesFloat } = kaiPulseNow();
    return [
      { t: pulsesFloat - 12, total: Math.max(1, Math.round(initialTotal * 0.89)) },
      { t: pulsesFloat - 7, total: Math.max(1, Math.round(initialTotal * 0.95)) },
      { t: pulsesFloat - 3, total: Math.max(1, Math.round(initialTotal * 0.985)) },
      { t: pulsesFloat, total: initialTotal },
    ];
  });

  const [pricePoints, setPricePoints] = useState<KPricePoint[]>(() => {
    const { pulsesFloat } = kaiPulseNow();
    const base = 1.618; // Φ baseline (fallback until engine context arrives)
    return [
      { p: pulsesFloat - 12, price: base * 0.97, vol: 0.2 },
      { p: pulsesFloat - 7, price: base * 1.0, vol: 0.3 },
      { p: pulsesFloat - 3, price: base * 1.03, vol: 0.25 },
      { p: pulsesFloat, price: base * 1.05, vol: 0.28 },
    ];
  });

  // ======== FETCH THE SAME CONTEXT THE CHECKOUT USES (EXACT PRICE) ========
  const [meta, setMeta] = useState<SigilMetadataLite | null>(null);
  const [clock, setClock] = useState<{ nowPulse: number; pulsesPerBeat: number } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [m, c] = await Promise.all([fetchSigilMeta(), fetchKaiClock()]);
      if (!alive) return;
      setMeta(m);
      setClock(c);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // When meta/clock arrive, rebuild the recent series *from the engine* so chart price matches checkout
  useEffect(() => {
    if (!meta || !clock) return;
    const end = Math.floor(clock.nowPulse);
    const start = Math.max(0, end - 377); // ~last 33 min in Kai pulses
    try {
      const series = buildExchangeSeries({ meta, usdSample: 100 }, DEFAULT_ISSUANCE_POLICY, start, end, 11);
      setPricePoints(
        series.map((s) => ({
          p: s.pulse,
          price: s.usdPerPhi, // EXACT same value the checkout uses for $/Φ
          vol: s.choirActive || s.festivalActive ? 0.5 : 0.2,
        }))
      );
    } catch {
      // If the engine context isn’t ready, keep the fallback seed; subsequent appends will correct it.
    }
  }, [meta, clock]);

  // Live accrual layer (continuous, pulse-anchored)
  const KAI_BASELINE_USD = 1_000_000;
  const USD_PER_PULSE = 0.1618; // growth rate per pulse (~$2.83k/day)
  const kaiAccrualUSD = useKaiAccrualUSD(KAI_BASELINE_USD, USD_PER_PULSE, true);

  // Public circulation shows: minted + Kai live accrual
  const targetContinuous = useMemo(() => minted + kaiAccrualUSD, [minted, kaiAccrualUSD]);

  // Quantized public total (≥ $13 steps, never less)
  const STEP_UNIT = 13;
  const [publicTotal, setPublicTotal] = useState<number>(() => {
    const { pulsesFloat } = kaiPulseNow();
    const initial = Math.floor((initialTotal + KAI_BASELINE_USD + USD_PER_PULSE * pulsesFloat) / STEP_UNIT) * STEP_UNIT;
    return initial;
  });

  // EWMA inflow for (legacy) price reaction to mints — retained for fallback only
  const inflowEWMA = useRef<number>(0);

  // Append a sparkline point *only when* total steps up
  const appendPoint = useCallback((newTotal: number) => {
    setPoints((prev) => {
      const { pulsesFloat } = kaiPulseNow();
      const next = [...prev, { t: pulsesFloat, total: newTotal }];
      return next.slice(-144);
    });
  }, []);

  // Append a price point (pulse-domain)
  const appendPricePoint = useCallback((pulse: number, price: number, vol: number) => {
    setPricePoints((prev) => {
      const next = [...prev, { p: pulse, price, vol }];
      return next.slice(-288);
    });
  }, []);

  // Legacy fallback model (only used if engine context is missing for a frame)
  const computePhiPrice = useCallback((pulseFloat: number, totalNow: number) => {
    const base = 1.618; // baseline (φ)
    const trend = 0.013 * Math.log1p(pulseFloat); // slow Kai trend
    const scale = Math.log1p(totalNow / 1_000_000); // saturation with circulation size
    const ewma = inflowEWMA.current * 0.002; // contribution influence
    const price = base + trend + 0.21 * scale + ewma;
    return Math.max(0.001, price);
  }, []);

  // When a contribution arrives, update minted and EWMA bump
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onContribution = (e: Event) => {
      const detail = (e as CustomEvent<ContributionEventDetail>).detail;
      const amount = detail?.amount ?? 0;
      const method: "card" | "btc" = detail?.method ?? "card";
      if (!amount || amount <= 0) return;

      setMinted((prev) => prev + amount);
      if (method === "btc") setBtc((v) => v + amount);
      else setCard((v) => v + amount);
      setLastEvent({ amount, method });

      // EWMA bump in Kai domain
      inflowEWMA.current = inflowEWMA.current * 0.85 + amount * 0.15;

      const id = window.setTimeout(() => setLastEvent(null), 2333);
      // ensure timer cleaned if another event rapidly fires
      return () => window.clearTimeout(id);
    };

    window.addEventListener("investor:contribution", onContribution as EventListener, { passive: true });

    // Helpers
    if (!window.KaiKlok) {
      window.KaiKlok = { postContribution: () => undefined, openPayment: () => undefined };
    }

    window.KaiKlok.postContribution = (amount: number, method: Method = "card") => {
      const detail: ContributionEventDetail = { amount, method: method === "btc" ? "btc" : "card" };
      window.dispatchEvent(new CustomEvent<ContributionEventDetail>("investor:contribution", { detail }));
    };

    window.KaiKlok.openPayment = (amount: number, suggestedMethod?: Method) => {
      const mapped: OpenPaymentEventDetail["suggestedMethod"] = suggestedMethod === "btc" ? "bitcoin" : suggestedMethod === "card" ? "card" : undefined;
      const detail: OpenPaymentEventDetail = { amount, suggestedMethod: mapped };
      window.dispatchEvent(new CustomEvent<OpenPaymentEventDetail>("investor:openPayment", { detail }));
    };

    return () => {
      window.removeEventListener("investor:contribution", onContribution as EventListener);
    };
  }, []);

  /* ──────────────────────────────────────────────────────────
     QUANTIZED STEPPER (≥ $13 per visible move)
     - Computes the Kai target (minted + accrual)
     - Advances publicTotal in chunks of $13 (or higher multiples)
     - Sparkline point appended *only when* we step
     - Price chart point appended alongside, Kai-domain
       (NOW USING THE EXACT ENGINE PRICE LIKE CHECKOUT)
     ────────────────────────────────────────────────────────── */
  const stepRaf = useRef<number | null>(null);

  useEffect(() => {
    const run = () => {
      // Decay EWMA slightly per RAF in Kai domain (very mild)
      inflowEWMA.current *= 0.998;

      // Compute target quantized to $13
      const targetQ = Math.floor(targetContinuous / STEP_UNIT) * STEP_UNIT;

      if (targetQ > publicTotal) {
        const delta = targetQ - publicTotal;
        // Step by at least $13; allow catching up faster in larger chunks (max 5 * 13 per frame)
        const stepChunks = Math.min(5, Math.floor(delta / STEP_UNIT));
        const step = Math.max(STEP_UNIT, stepChunks * STEP_UNIT);
        const next = publicTotal + step;

        setPublicTotal(next);
        appendPoint(next);

        // ===== Real engine price (matches checkout) =====
        const { pulsesFloat } = kaiPulseNow();
        let priceNow = computePhiPrice(pulsesFloat, next); // fallback default
        let vol = Math.min(1, Math.max(0, step / 1000));

        if (meta) {
          try {
            const end = Math.floor(pulsesFloat);
            const start = Math.max(0, end - 11);
            const series = buildExchangeSeries({ meta, usdSample: 100 }, DEFAULT_ISSUANCE_POLICY, start, end, 11);
            const last = series[series.length - 1];
            if (last) {
              priceNow = last.usdPerPhi;
              vol = last.choirActive || last.festivalActive ? 0.5 : vol;
            }
          } catch {
            // keep fallback on transient errors
          }
        }

        appendPricePoint(pulsesFloat, priceNow, vol);
      }

      stepRaf.current = requestAnimationFrame(run);
    };

    stepRaf.current = requestAnimationFrame(run);
    return () => {
      if (stepRaf.current) cancelAnimationFrame(stepRaf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicTotal, targetContinuous, appendPoint, appendPricePoint, computePhiPrice, meta]);

  return (
    <section className="inv-info-wrap" aria-label="Φ Kurrensy overview" ref={rootRef}>
      {/* LIVE CIRCULATION BOARD */}
      <div className="inv-live-card inv-info-card">
        <LiveBoard total={publicTotal} target={target} card={card} btc={btc} lastEvent={lastEvent} points={points} />
      </div>

      {/* LIVE Φ PRICE (Kai chart) */}
      <div className="inv-info-card inv-price-card">
        <KaiPriceChart points={pricePoints} title="Φ Value — Live (Kai pulses)" />
        <div className="inv-fine">
          Axis is <b>Kai pulses</b> (atemporal). Fiat Exchange Rate reacts to breath-backed inflows and pulse-trend.
        </div>
      </div>

      {/* USE Φ NOW — interactive mint CTA */}
      <UsePhiNow liveTotal={publicTotal} />

      {/* Keep the hero watch image */}
      {heroImageSrc && (
        <div className="inv-hero">
          <img src={heroImageSrc} alt="Kai-Klok device render" loading="lazy" />
        </div>
      )}

      {/* Knowledge grid */}
      <div className="inv-info-grid">
        <WhatIsPhi />
        <KairosKurrensyCard />
        <HowItWorks />
        <KaiKlok />
        <WhyPhiVsFiat />
        <Mission />
      </div>

      <FooterLine />
    </section>
  );
};

export default InvestorAtAGlance;
