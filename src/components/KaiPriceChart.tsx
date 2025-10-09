// KaiPriceChart.tsx
// ────────────────────────────────────────────────────────────
/*
  LIVE Kai Price Chart — Pulse-native ticker (ticks every 3+√5 s)
  - Aligns to integer pulses using Kai epoch (bridge only)
  - Recomputes price each pulse with the SAME MATH as the inline version:
      • Try real engine (buildExchangeSeries over last 11 pulses → usdPerPhi)
      • Else fallback φ-oscillator (uses previous price as base + golden harmonics + sin noise)
  - Rolling window; cents formatting; VWAP band + bands + crosshair
  - X axis: numbers only; single "pulse" caption once at the bottom

  Integration:
  - If you already have globals like fetchSigilMeta, buildExchangeSeries, DEFAULT_ISSUANCE_POLICY
    on window/globalThis, the component will auto-detect and use them.
  - Or pass them in as props (optional).

  Props (added):
    • live?: boolean (default true)
    • windowPoints?: number (default 240)
    • basePrice?: number (only used if you also provide priceFn)
    • priceFn?: (pulse: number) => number   // hard override for price (skips engine/fallback)
    • volFn?: (pulse: number) => number     // optional volume per pulse (0..1)
    • tickAlignToPulse?: boolean (default true)
    • tickMs?: number (override period; default = 3+√5 s)
    • fetchSigilMeta?: () => Promise<SigilMeta>   // optional; if omitted, tries globalThis.fetchSigilMeta
    • buildExchangeSeries?: BuildExchangeSeries   // optional; if omitted, tries globalThis.buildExchangeSeries
    • issuancePolicy?: IssuancePolicy             // optional; if omitted, tries globalThis.DEFAULT_ISSUANCE_POLICY
*/
// ────────────────────────────────────────────────────────────

import * as React from "react";

// ---------- Price point ----------
export type KPricePoint = { p: number; price: number; vol: number };

// ---------- Engine hook types (strict, no `any`) ----------
export type SigilMeta = Readonly<Record<string, unknown>>;
export type IssuancePolicy = Readonly<Record<string, unknown>>;

export type BuildSeriesPoint = {
  usdPerPhi: number;
  choirActive?: boolean;
  festivalActive?: boolean;
};

export type BuildExchangeSeries = (
  params: { meta: SigilMeta; usdSample: number },
  policy: IssuancePolicy,
  startPulse: number,
  endPulse: number,
  count: number
) => ReadonlyArray<BuildSeriesPoint>;

// ---------- Props ----------
export type KaiPriceChartProps = {
  points: KPricePoint[]; // seed points (optional; used to bootstrap live series)
  width?: number;
  height?: number;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  formatter?: (v: number) => string;
  gridXTicks?: number; // default 6
  gridYTicks?: number; // default 4
  bandLevels?: number[]; // default [0.236, 0.382, 0.5, 0.618]
  showVWAP?: boolean; // default true
  autoWidth?: boolean; // default false — if true, width is container width
  includeStyles?: boolean; // default true — embed minimal CSS
  onHoverPoint?: (pt: { p: number; price: number } | null) => void;

  // Behavioral
  live?: boolean; // default true
  windowPoints?: number; // default 240 (~21 min of history)
  basePrice?: number; // only used if priceFn provided
  priceFn?: (pulse: number) => number; // hard override (skips engine/fallback)
  volFn?: (pulse: number) => number; // optional, 0..1
  tickAlignToPulse?: boolean; // default true (snap to next integer pulse)
  tickMs?: number; // override tick period; default BREATH_MS

  // Optional engine hooks (if not passed, the component will try globalThis)
  fetchSigilMeta?: () => Promise<SigilMeta>;
  buildExchangeSeries?: BuildExchangeSeries;
  issuancePolicy?: IssuancePolicy;
};

// ——— Kai constants (bridge only; rendering stays in pulses) ———
const KAI_EPOCH_MS = 1715323541888; // 2024-05-10 06:45:41.888 UTC (Sun) • canonical bridge
const BREATH_S = 3 + Math.sqrt(5); // φ-exact breath period
const BREATH_MS = BREATH_S * 1000;

const kaiPulseNow = (): number => (Date.now() - KAI_EPOCH_MS) / BREATH_MS;

// ——— helpers ———
const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
const round2 = (n: number) => Math.round(n * 100) / 100;
const fmtUSD = (n: number | undefined | null) =>
  n == null
    ? "—"
    : n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

// Fallback φ-oscillator — EXACTLY like inline (noise via sin, not PRNG)
const phiFallbackPrice = (pulse: number, base: number) => {
  const φ = (1 + Math.sqrt(5)) / 2;
  const slow = Math.sin((2 * Math.PI * pulse) / 44) * 0.85;
  const fast1 = Math.sin(2 * Math.PI * φ * pulse) * 0.42;
  const fast2 = Math.sin(2 * Math.PI * (φ - 1) * pulse) * 0.28;
  const noise = Math.sin(pulse * 0.1618) * 0.35;
  return round2(base + slow + fast1 + fast2 + noise);
};

// Default volume (0..1) varying in Kai rhythm (deterministic)
const phiVol = (pulse: number) => {
  const v = Math.abs(Math.sin((2 * Math.PI * pulse) / 11));
  return clamp(0.35 + 0.65 * v, 0, 1);
};

const KAI_PRICE_CHART_CSS = `
.kai-price-wrap { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Apple Color Emoji","Segoe UI Emoji"; color: #e7fbf7; }
.kai-price-chart { display:block; width:100%; height:auto; }
.kpc-title { fill:#a2bbb6; font-size:12px; font-weight:600; letter-spacing:0.4px; }
.kpc-gridline { stroke:#ffffff22; stroke-width:1; shape-rendering:crispEdges; }
.kpc-band { stroke:#81fff133; stroke-width:1; stroke-dasharray:4 4; }
.kpc-line { fill:none; stroke:#37e6d4; stroke-width:2.25; }
.kpc-area { opacity:1; }
.kpc-axes .kpc-axis-text { fill:#a2bbb6; font-size:11px; dominant-baseline:middle; }
.kpc-dot { fill:#37e6d4; stroke:#0a0f12; stroke-width:2; }
.kpc-badge { fill:#0a0f12cc; stroke:#ffffff22; stroke-width:1; }
.kpc-badge.up { stroke:#28c76f66; }
.kpc-badge.down { stroke:#ff4d4f66; }
.kpc-badge-text { fill:#e7fbf7; font-size:11px; font-weight:600; }
.kpc-xhair-line { stroke:#ffffff33; stroke-width:1; shape-rendering:crispEdges; }
.kpc-tip { fill:#0a0f12f2; stroke:#ffffff22; }
.kpc-tip-text { fill:#e7fbf7; font-size:11px; font-weight:600; }
.kpc-header text { user-select:none; }
.kpc-ticker { display:flex; align-items:center; gap:10px; margin-bottom:6px; font-size:12px; color:#a2bbb6; }
.kpc-live-dot { width:8px; height:8px; border-radius:9999px; background:#28c76f; box-shadow:0 0 0 6px #28c76f22; }
.kpc-live { font-weight:700; letter-spacing:0.08em; color:#a2bbb6; }
.kpc-last { font-weight:700; color:#e7fbf7; }
.kpc-last.up { color:#c1ffe9; }
.kpc-last.down { color:#ffd1d1; }
.kpc-delta.up { color:#28c76f; }
.kpc-delta.down { color:#ff4d4f; }
.kpc-pulse { color:#a2bbb6; }
.kpc-empty { display:flex; align-items:center; justify-content:center; color:#a2bbb6; height:100%; font-size:12px; }
`;

const defaultPadding = { l: 64, r: 20, t: 28, b: 36 };

// Safe global getter (typed)
const getGlobal = <T,>(key: string): T | undefined => {
  const g = globalThis as Record<string, unknown>;
  return g[key] as T | undefined;
};

const KaiPriceChart: React.FC<KaiPriceChartProps> = ({
  points,
  width = 720,
  height = 280,
  title = "Φ Value — Live (Kai pulses)",
  className,
  style,
  formatter = fmtUSD,
  gridXTicks = 6,
  gridYTicks = 4,
  bandLevels = [0.236, 0.382, 0.5, 0.618],
  showVWAP = true,
  autoWidth = false,
  includeStyles = true,
  onHoverPoint,

  // Behavioral
  live = true,
  windowPoints = 240,

  priceFn,
  volFn,
  tickAlignToPulse = true,
  tickMs = BREATH_MS,

  // Engine hooks (optional)
  fetchSigilMeta,
  buildExchangeSeries,
  issuancePolicy,
}) => {
  const padding = defaultPadding;
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const [measuredW, setMeasuredW] = React.useState<number>(width);

  // ----- Engine glue — fall back to globals if props not provided -----
  const fetchMetaRef = React.useRef<(() => Promise<SigilMeta>) | undefined>(
    fetchSigilMeta ?? getGlobal<() => Promise<SigilMeta>>("fetchSigilMeta")
  );
  const buildSeriesRef = React.useRef<BuildExchangeSeries | undefined>(
    buildExchangeSeries ?? getGlobal<BuildExchangeSeries>("buildExchangeSeries")
  );
  const policyRef = React.useRef<IssuancePolicy | undefined>(
    issuancePolicy ?? getGlobal<IssuancePolicy>("DEFAULT_ISSUANCE_POLICY")
  );

  React.useEffect(() => {
    fetchMetaRef.current = fetchSigilMeta ?? getGlobal<() => Promise<SigilMeta>>("fetchSigilMeta");
  }, [fetchSigilMeta]);
  React.useEffect(() => {
    buildSeriesRef.current = buildExchangeSeries ?? getGlobal<BuildExchangeSeries>("buildExchangeSeries");
  }, [buildExchangeSeries]);
  React.useEffect(() => {
    policyRef.current = issuancePolicy ?? getGlobal<IssuancePolicy>("DEFAULT_ISSUANCE_POLICY");
  }, [issuancePolicy]);

  // ----- Live series state -----
  const [livePts, setLivePts] = React.useState<KPricePoint[]>([]);
  const lastPulseRef = React.useRef<number | null>(null);
  const [meta, setMeta] = React.useState<SigilMeta | null>(null);

  // Auto-width using ResizeObserver (optional)
  React.useLayoutEffect(() => {
    if (!autoWidth || !wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.floor(e.contentRect.width || width);
        if (w > 0) setMeasuredW(w);
      }
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [autoWidth, width]);

  const W = autoWidth ? measuredW : width;

  // Fetch issuance meta once (same as inline)
  React.useEffect(() => {
    let alive = true;
    const loader = fetchMetaRef.current;
    if (loader) {
      void loader()
        .then((m) => {
          if (alive) setMeta(m);
        })
        .catch(() => {
          /* graceful fallback */
        });
    }
    return () => {
      alive = false;
    };
  }, []);

  // Helper: compute price+vol for a given integer pulse EXACTLY like inline
  const computeForPulse = React.useCallback(
    (pInt: number, prevPrice: number | null): { price: number; vol: number } => {
      // 1) Hard override wins
      if (priceFn) {
        const pr = round2(Math.max(0.0001, priceFn(pInt)));
        const vv = volFn ? clamp(volFn(pInt), 0, 1) : phiVol(pInt);
        return { price: pr, vol: vv };
      }

      // 2) Try real engine math (last 11 pulses → usdPerPhi)
      const build = buildSeriesRef.current;
      const policy = policyRef.current;
      if (meta && typeof build === "function" && policy) {
        try {
          const start = Math.max(0, pInt - 11);
          const series = build({ meta, usdSample: 100 }, policy, start, pInt, 11);
          const lastPoint = series?.[series.length - 1];
          if (lastPoint && typeof lastPoint.usdPerPhi === "number") {
            const vol = lastPoint.choirActive || lastPoint.festivalActive ? 0.5 : 0.25;
            return { price: round2(Math.max(0.0001, lastPoint.usdPerPhi)), vol };
          }
        } catch {
          // fall through to fallback
        }
      }

      // 3) Fallback oscillator — base = last known price (or 1.618), exactly like inline
      const base = prevPrice ?? 1.618;
      const price = Math.max(0.0001, phiFallbackPrice(pInt, base));
      const vol = phiVol(pInt);
      return { price: round2(price), vol };
    },
    [meta, priceFn, volFn]
  );

  // Seed (or re-seed when meta arrives) to ensure matching price immediately
  React.useEffect(() => {
    if (!live) return;

    const pNow = kaiPulseNow();
    const pEnd = Math.floor(pNow);
    const N = Math.max(2, windowPoints);
    const pStart = pEnd - (N - 1);

    const seeded: KPricePoint[] = [];
    let prevPrice: number | null = points?.length ? points[points.length - 1]?.price ?? null : null;

    for (let p = pStart; p <= pEnd; p++) {
      const { price, vol } = computeForPulse(p, prevPrice);
      seeded.push({ p, price, vol });
      prevPrice = price;
    }

    setLivePts(seeded);
    lastPulseRef.current = pEnd;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, windowPoints, computeForPulse, meta]);

  // Pulse-aligned scheduler
  React.useEffect(() => {
    if (!live) return;

    let timer: number | undefined;

    const tick = () => {
      const pNow = kaiPulseNow();
      const pInt = Math.floor(pNow);

      if (lastPulseRef.current == null || pInt > lastPulseRef.current) {
        setLivePts((prev) => {
          const prevLast = prev.length ? prev[prev.length - 1].price : points?.[points.length - 1]?.price ?? null;
          const { price, vol } = computeForPulse(pInt, prevLast);
          const next = [...prev, { p: pInt, price, vol }];
          return next.length > windowPoints ? next.slice(next.length - windowPoints) : next;
        });

        lastPulseRef.current = pInt;
      }

      schedule();
    };

    const schedule = () => {
      if (tickAlignToPulse) {
        const p = kaiPulseNow();
        const frac = p - Math.floor(p);
        const msUntilNext = Math.max(1, (1 - frac) * BREATH_MS);
        timer = window.setTimeout(tick, msUntilNext + 2);
      } else {
        timer = window.setTimeout(tick, tickMs);
      }
    };

    schedule();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [live, windowPoints, computeForPulse, tickAlignToPulse, tickMs, points]);

  // Choose which set to render: live series or provided points
  const pts: KPricePoint[] = live ? livePts : points;

  // Dimensions
  const iw = Math.max(10, W - padding.l - padding.r);
  const ih = Math.max(10, height - padding.t - padding.b);

  // Bounds + VWAP-ish
  const { minX, maxX, minY, maxY, vwap } = React.useMemo(() => {
    if (!pts.length) return { minX: 0, maxX: 1, minY: 1, maxY: 2, vwap: 0 };
    const xs = pts.map((p) => p.p);
    const ys = pts.map((p) => p.price);
    const vs = pts.map((p) => p.vol || 0);
    const minXv = Math.min(...xs);
    const maxXv = Math.max(...xs);
    const minYv = Math.min(...ys);
    const maxYv = Math.max(...ys);
    const vSum = vs.reduce((a, b) => a + b, 0) || 1;
    const vwapVal = pts.reduce((a, p) => a + p.price * (p.vol || 0), 0) / vSum;
    const pad = (maxYv - minYv) * 0.12 || 0.5;
    return { minX: minXv, maxX: maxXv, minY: Math.max(0, minYv - pad), maxY: maxYv + pad, vwap: vwapVal };
  }, [pts]);

  // Scales
  const nx = React.useCallback((x: number) => (maxX === minX ? 0 : (x - minX) / (maxX - minX)), [minX, maxX]);
  const ny = React.useCallback((y: number) => (maxY === minY ? 1 : 1 - (y - minY) / (maxY - minY)), [minY, maxY]);
  const sx = React.useCallback((x: number) => nx(x) * iw + padding.l, [nx, iw, padding.l]);
  const sy = React.useCallback((y: number) => ny(y) * ih + padding.t, [ny, ih, padding.t]);

  // Screen points
  const screenPts = React.useMemo(() => pts.map((pt) => ({ x: sx(pt.p), y: sy(pt.price) })), [pts, sx, sy]);

  // Smoothed path (Catmull-Rom to Bezier)
  const path = React.useMemo(() => {
    if (screenPts.length < 2) return "";
    const cr2bezier = (
      p0: { x: number; y: number },
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      p3: { x: number; y: number }
    ) => {
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
    if (!path || screenPts.length === 0) return "";
    const bottomY = padding.t + ih;
    const last = screenPts[screenPts.length - 1];
    const first = screenPts[0];
    return `${path} L${last.x.toFixed(2)} ${bottomY.toFixed(2)} L${first.x.toFixed(2)} ${bottomY.toFixed(2)} Z`;
  }, [path, screenPts, ih, padding.t]);

  // X ticks — numbers only; single "pulse" caption on the axis
  const xTicks = React.useMemo(() => {
    const ticks: Array<{ x: number; label: string }> = [];
    const n = Math.max(1, gridXTicks);
    for (let i = 0; i <= n; i++) {
      const v = minX + (i * (maxX - minX)) / n;
      ticks.push({ x: sx(v), label: Math.floor(v).toString() });
    }
    return ticks;
  }, [minX, maxX, sx, gridXTicks]);

  const yTicks = React.useMemo(() => {
    const ticks: Array<{ y: number; label: string }> = [];
    const n = Math.max(1, gridYTicks);
    for (let i = 0; i <= n; i++) {
      const v = minY + (i * (maxY - minY)) / n;
      ticks.push({ y: sy(v), label: formatter(v) });
    }
    return ticks;
  }, [minY, maxY, sy, formatter, gridYTicks]);

  // Fibonacci bands
  const fibBands = React.useMemo(
    () =>
      bandLevels.map((level) => {
        const v = minY + level * (maxY - minY);
        return { y: sy(v), label: `φ ${level}` };
      }),
    [bandLevels, minY, maxY, sy]
  );

  // Crosshair
  const [hover, setHover] = React.useState<{ x: number; y: number; p: number; price: number } | null>(null);
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, padding.l, padding.l + iw);
    const t = (x - padding.l) / iw;
    const pVal = minX + t * (maxX - minX);
    if (pts.length === 0) {
      setHover(null);
      onHoverPoint?.(null);
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
    const h = { x: sxN, y: syN, p: nearest.p, price: nearest.price };
    setHover(h);
    onHoverPoint?.({ p: nearest.p, price: nearest.price });
  };
  const onLeave = () => {
    setHover(null);
    onHoverPoint?.(null);
  };

  // Ticker values
  const last = pts[pts.length - 1];
  const prev = pts.length > 1 ? pts[pts.length - 2] : undefined;
  const change = last && prev ? round2(last.price - prev.price) : 0;
  const changePct = last && prev && prev.price !== 0 ? (change / prev.price) * 100 : 0;

  return (
    <div ref={wrapRef} className={`kai-price-wrap ${className ?? ""}`} style={style}>
      {includeStyles && <style dangerouslySetInnerHTML={{ __html: KAI_PRICE_CHART_CSS }} />}

      {/* LIVE TICKER */}
      <div className="kpc-ticker" aria-live="polite">
        <div className="kpc-live-dot" aria-hidden />
        <div className="kpc-live">LIVE</div>
        <div className={`kpc-last ${change >= 0 ? "up" : "down"}`}>{last ? formatter(last.price) : "—"}</div>
        <div className={`kpc-delta ${change >= 0 ? "up" : "down"}`}>
          {change >= 0 ? "▲" : "▼"} {formatter(Math.abs(change))} ({changePct >= 0 ? "+" : ""}
          {changePct.toFixed(2)}%)
        </div>
        {last && <div className="kpc-pulse">pulse {Math.floor(last.p)}</div>}
      </div>

      {/* CHART */}
      <svg
        width={W}
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

        {/* Empty state */}
        {pts.length === 0 ? (
          <g className="kpc-empty">
            <text
              x={padding.l + iw / 2}
              y={padding.t + ih + 2}
              textAnchor="middle"
              alignmentBaseline="middle"
              className="kpc-axis-text"
            >
              Waiting for Φ ticks…
            </text>
          </g>
        ) : (
          <>
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
            {showVWAP && pts.length >= 3 && (
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
              {/* Single caption for the X axis */}
              <text x={padding.l} y={padding.t + ih + 36} textAnchor="start" className="kpc-axis-text">
                pulse
              </text>

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
                  {formatter(last.price)} {change >= 0 ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
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
                  pulse {Math.floor(hover.p)} • {formatter(hover.price)}
                </text>
              </g>
            )}
          </>
        )}
      </svg>
    </div>
  );
};

export default KaiPriceChart;
