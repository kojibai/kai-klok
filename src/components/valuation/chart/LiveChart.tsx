// src/components/valuation/chart/LiveChart.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  ReferenceDot,
  ReferenceLine,
  ReferenceArea,
  CartesianGrid,
  Label,
  Tooltip,
} from "recharts";
import type { LabelProps, TooltipProps as RTooltipProps } from "recharts";
import { currency, usd } from "../display";
import type { ChartPoint } from "../series";

/* ─────────────────────────────────────────────────────────────
 * Extended point fields we may carry alongside core series.
 * (No `any`; all optional and strictly typed.)
 * ───────────────────────────────────────────────────────────── */
type WithFXUSD = {
  fx?: number;         // per-point FX (USD per Φ)
  usdPerPhi?: number;  // alias of fx
  usd?: number;        // per-point price in USD
  usdPrice?: number;   // alias
};

type FXPoint = ChartPoint & WithFXUSD;

/* ─────────────────────────────────────────────────────────────
 * Props
 * ───────────────────────────────────────────────────────────── */
export type LiveChartProps = {
  data: ChartPoint[];   // parent model series
  live: number;         // latest display price in Φ (child Φ if child)
  pv: number;           // intrinsic PV (in Φ; will scale as needed)
  premiumX: number;
  momentX: number;
  colors: string[];
  height?: number;
  reflowKey?: number;

  /** Initial window size in points (from the right). Default: 256 */
  initialWindow?: number;

  /** Percent padding added to Y scale. Default: 7% */
  yPaddingPct?: number;

  /** If provided, treat the *last* point as this exact child Φ (6dp). */
  childPhiExact?: number | null;

  /** Scale PV line proportionally to child (default: true). */
  scalePvToChild?: boolean;

  /** Live FX (USD per Φ) used when a point lacks its own fx. */
  usdPerPhi: number;

  /** If you know it's a child glyph, pass true to force USD mode. */
  isChildGlyph?: boolean;
};

/* Recharts helper types */
type MouseMoveFunc = NonNullable<React.ComponentProps<typeof LineChart>["onMouseMove"]>;
type MouseLeaveFunc = NonNullable<React.ComponentProps<typeof LineChart>["onMouseLeave"]>;
type ClickFunc = NonNullable<React.ComponentProps<typeof LineChart>["onClick"]>;
type RechartsValue = number | string | Array<number | string>;
type RechartsName = number | string;

type StateWithPayload = {
  activePayload?: Array<{ payload: ChartPoint }>;
  activeTooltipIndex?: number | null;
};

/* Safe Math */
const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

/** Pixel → index: needs container width */
function useContainerWidth(): [React.MutableRefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState<number>(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") {
      setW(el?.clientWidth ?? 0);
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setW(Math.max(0, Math.floor(entry.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, w];
}

export default function LiveChart({
  data,
  live,
  pv,
  premiumX,
  momentX,
  colors,
  height = 196,
  reflowKey = 0,
  initialWindow = 256,
  yPaddingPct = 7,
  childPhiExact = null,
  scalePvToChild = true,
  usdPerPhi,
  isChildGlyph = false,
}: LiveChartProps) {
  // Container & width (for pan/zoom calculations)
  const [wrapRef, wrapWidth] = useContainerWidth();

  // Basic guards
  const safeData = useMemo<ChartPoint[]>(() => (Array.isArray(data) ? data : []), [data]);
  const hasData = safeData.length > 1;
  const dataMin = hasData ? safeData[0].i : 0;
  const dataMax = hasData ? safeData[safeData.length - 1].i : 1;
  const lastIndex = hasData ? safeData[safeData.length - 1].i : 0;
  const lastParentValue = hasData ? safeData[safeData.length - 1].value : live;

  // Detect child glyph (explicit or live differs from parent last tick)
  const childΦ = useMemo<number | null>(() => {
    if (childPhiExact != null && Number.isFinite(childPhiExact)) return childPhiExact;
    const diff = Math.abs(live - lastParentValue);
    return diff > 1e-9 ? live : null;
  }, [childPhiExact, live, lastParentValue]);

  // Force child mode from prop if known
  const isChild = isChildGlyph || childΦ != null;
  const isUsdMode = isChild; // requirement: child glyph charts in USD; parent in Φ

  /* Accessors for per-point FX / USD with strict typing */
  const fxOf = useCallback(
    (p?: FXPoint): number => {
      const fx = (p?.fx ?? p?.usdPerPhi);
      if (typeof fx === "number" && Number.isFinite(fx)) return fx;
      return Number.isFinite(usdPerPhi) ? usdPerPhi : 0;
    },
    [usdPerPhi]
  );

  /** USD value for a *point* based on that point’s Φ and FX (or point-provided USD). */
  const usdFromPoint = useCallback(
    (p: FXPoint): number => {
      if (typeof p.usd === "number" && Number.isFinite(p.usd)) return p.usd;
      if (typeof p.usdPrice === "number" && Number.isFinite(p.usdPrice)) return p.usdPrice;
      const phiAtPoint = p.value; // parent series value at that point (Φ)
      return fxOf(p) * phiAtPoint;
    },
    [fxOf]
  );

  // Build plot series in the correct units:
  // - Parent: Φ series as-is (value in Φ)
  // - Child: USD series (value in USD), derived from per-point Φ * per-point FX (or per-point USD override)
  const plotData = useMemo<ChartPoint[]>(() => {
    if (!hasData) return safeData;
    if (!isUsdMode) return safeData; // Φ mode for parent

    return safeData.map((p) => {
      const fp: FXPoint = p; // widen to allow optional fields
      return { ...p, value: usdFromPoint(fp) };
    });
  }, [hasData, safeData, isUsdMode, usdFromPoint]);

  // PV display (in Φ), optionally scaled by child ratio
  const pvPhi = useMemo<number>(() => {
    if (!scalePvToChild || childΦ == null || !Number.isFinite(lastParentValue) || lastParentValue <= 0) {
      return pv;
    }
    const r = childΦ / lastParentValue;
    return pv * r;
  }, [pv, scalePvToChild, childΦ, lastParentValue]);

  // PV line in chart units
  const pvChart = useMemo<number>(() => (isUsdMode ? pvPhi * fxOf() : pvPhi), [isUsdMode, pvPhi, fxOf]);

  // Live values in both units
  const livePhi = live; // Φ (childΦ if child)
  const liveUsd = useMemo(() => livePhi * (Number.isFinite(usdPerPhi) ? usdPerPhi : 0), [livePhi, usdPerPhi]);

  // Viewport (x-domain) state
  const [xMin, setXMin] = useState<number>(() => Math.max(dataMin, lastIndex - (initialWindow - 1)));
  const [xMax, setXMax] = useState<number>(() => lastIndex);

  // Auto-follow live when the viewport right edge is at the last index
  const autoFollowRef = useRef<boolean>(true);
  useEffect(() => {
    if (autoFollowRef.current && hasData) {
      const span = Math.max(8, xMax - xMin);
      const nextMax = lastIndex;
      const nextMin = clamp(nextMax - span, dataMin, nextMax);
      setXMin(nextMin);
      setXMax(nextMax);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastIndex, hasData]);

  // Y-domain padding
  const [yMin, yMax] = useMemo<[number, number]>(() => {
    if (!hasData) return [0, 1];
    const lo = Number.MIN_SAFE_INTEGER;
    const hi = Number.MAX_SAFE_INTEGER;
    let minV = hi;
    let maxV = lo;
    for (let i = 0; i < plotData.length; i += 1) {
      const p = plotData[i];
      if (p.i < xMin || p.i > xMax) continue;
      const v = p.value;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    if (minV === hi || maxV === lo) return [0, 1];
    const span = maxV - minV;
    const pad = Math.max(1e-9, (span || Math.abs(minV) || 1) * (yPaddingPct / 100));
    return [minV - pad, maxV + pad];
  }, [plotData, xMin, xMax, yPaddingPct, hasData]);

  // Hover & pin (cursor / selection)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [pinnedIdx, setPinnedIdx] = useState<number | null>(null);

  /** Gradient id (stable for chart instance) */
  const areaId = useMemo(() => `grad-${Math.random().toString(36).slice(2)}`, []);

  /** Tiny pill tag factory (H/L/child Φ) — typed for Recharts Label content */
  const tinyTag = useCallback(
    (text: string): LabelProps["content"] =>
      (props: LabelProps) => {
        const vb = props.viewBox as { x?: number; y?: number } | undefined;
        const x = typeof vb?.x === "number" ? vb.x : 0;
        const y = typeof vb?.y === "number" ? vb.y : 0;
        const w = Math.max(18, text.length * 8);
        return (
          <g transform={`translate(${x + 6},${y - 10})`} aria-hidden="true">
            <rect
              x={0}
              y={-10}
              rx={6}
              ry={6}
              width={w}
              height={16}
              fill="rgba(0,0,0,.55)"
              stroke="rgba(255,255,255,.25)"
              strokeWidth={1}
            />
            <text x={w / 2} y={2} fontSize={11} fontWeight={800} textAnchor="middle" fill={colors[0]}>
              {text}
            </text>
          </g>
        );
      },
    [colors]
  );

  /** Last price tag — typed as LabelProps["content"] */
  const renderPriceTag: LabelProps["content"] = useCallback(
    (props: LabelProps) => {
      const vb = props.viewBox as { x?: number; y?: number } | undefined;
      const x = typeof vb?.x === "number" ? vb.x : 0;
      const y = typeof vb?.y === "number" ? vb.y : 0;

      const phiTag = currency(livePhi);
      const usdTag = usd(liveUsd);

      const w = Math.max(84, Math.max(phiTag.length, usdTag.length) * 8.2) + 12;
      const h = 38; // two lines

      return (
        <g transform={`translate(${x + 10},${y - 12})`} aria-hidden="true">
          <rect
            x={0}
            y={-h}
            rx={8}
            ry={8}
            width={w}
            height={h}
            fill="rgba(0,0,0,.55)"
            stroke="rgba(255,255,255,.25)"
            strokeWidth={1}
          />
          {/* Φ line */}
          <text x={8} y={-h + 14} fontSize={12} fontWeight={800} fill={colors[0]}>
            {phiTag}
          </text>
          {/* USD line (live) */}
          <text x={8} y={-h + 28} fontSize={11} fontWeight={700} fill="rgba(255,255,255,.85)">
            {usdTag}
          </text>
        </g>
      );
    },
    [colors, livePhi, liveUsd]
  );

  /** Pick payload point from Recharts event */
  const pickPoint = (st: Parameters<MouseMoveFunc>[0]): ChartPoint | undefined => {
    const s = st as StateWithPayload | null;
    return s?.activePayload?.[0]?.payload;
  };

  /** Hover, leave, tap/pin (mouse & touch tap) */
  const onMove: MouseMoveFunc = (st) => {
    const p = pickPoint(st);
    if (p?.i != null) setHoverIdx(p.i);
  };
  const onLeave: MouseLeaveFunc = () => {
    if (pinnedIdx == null) setHoverIdx(null);
  };
  const onTap: ClickFunc = (st) => {
    const p = pickPoint(st as Parameters<MouseMoveFunc>[0]);
    if (p?.i == null) return;
    setPinnedIdx((cur) => (cur === p.i ? null : p.i));
  };

  /** Tooltip (chart-units first; also show the other unit) */
  type ChartTooltipProps = RTooltipProps<RechartsValue, RechartsName> & {
    payload?: Array<{ payload: ChartPoint }>;
  };
  const ChartTooltip = useCallback(
    (props: ChartTooltipProps) => {
      const { active, payload } = props;
      if (!active || !payload?.length) return null;
      const p = payload[0].payload;

      // Chart value (already in chart units via plotData)
      const chartVal = (p.value as number) ?? 0;

      // Derive both units for display
      const fx = fxOf(p as FXPoint);

      // Φ value to show in tooltip:
      // - parent mode -> Φ at point (chartVal)
      // - child mode  -> the child’s Φ (fixed), fall back to liveΦ if needed
      const phiHere = isUsdMode ? (childΦ ?? livePhi) : chartVal;

      // USD value to show in tooltip:
      // - parent mode -> parent's USD at point (chartVal * fx)
      // - child mode  -> **child’s USD** at the hovered point (child Φ × point FX)
      //    (this is the only change requested; ensures tooltip reflects CHILD USD)
      const usdHereNum = isUsdMode ? (phiHere * fx) : (chartVal * fx); // ← FIXED

      // Change vs first visible in *chart units*
      const firstVisible = plotData.find((pt) => pt.i >= xMin)?.value ?? chartVal;
      const fv = typeof firstVisible === "number" ? firstVisible : Number(firstVisible);
      const chg = ((chartVal - fv) / (fv || 1)) * 100;

      // PV & premium in chart units
      const pvHereChart = pvChart;
      const premOnlyChart = Math.max(0, chartVal - pvHereChart);

      return (
        <div className="tt-card">
          <div className="tt-row">
            <span>Price ({isUsdMode ? "USD" : "Φ"})</span>
            <strong>{isUsdMode ? usd(usdHereNum) : currency(phiHere)}</strong>
          </div>
          <div className="tt-row">
            <span>{isUsdMode ? "Φ" : "USD"}</span>
            <strong>{isUsdMode ? currency(phiHere) : usd(usdHereNum)}</strong>
          </div>
          <div className="tt-row">
            <span>Intrinsic (PV)</span>
            <strong>{isUsdMode ? usd(pvHereChart) : currency(pvHereChart)}</strong>
          </div>
          <div className="tt-row">
            <span>Premium</span>
            <strong>{isUsdMode ? usd(premOnlyChart) : currency(premOnlyChart)}</strong>
          </div>
          <div className="tt-row"><span>Premium ×</span><strong>{(premiumX ?? 1).toFixed(6)}</strong></div>
          <div className="tt-row"><span>Moment ×</span><strong>{(momentX ?? 1).toFixed(6)}</strong></div>
          <div className="tt-row">
            <span>Change</span>
            <strong className={chg >= 0 ? "gain" : "loss"}>
              {`${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`}
            </strong>
          </div>
        </div>
      );
    },
    [isUsdMode, childΦ, livePhi, plotData, xMin, pvChart, premiumX, momentX, fxOf]
  );

  /** Active point under cursor/pin */
  const activePoint = useMemo(() => {
    const activeIdx = pinnedIdx ?? hoverIdx ?? lastIndex;
    if (activeIdx == null) return null;
    return plotData.find((d) => d.i === activeIdx) ?? null;
  }, [plotData, hoverIdx, pinnedIdx, lastIndex]);

  /** ── Pan & Zoom (wheel / drag / pinch) */
  const draggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; xMin: number; xMax: number } | null>(null);
  const pointersRef = useRef<Map<number, { x: number }>>(new Map());
  const pinchRef = useRef<{ initialSpan: number; baseMin: number; baseMax: number } | null>(null);

  const setDomain = useCallback(
    (nxMin: number, nxMax: number, follow?: boolean) => {
      const lo = clamp(Math.floor(nxMin), dataMin, dataMax - 1);
      const hi = clamp(Math.floor(nxMax), lo + 1, dataMax);
      setXMin(lo);
      setXMax(hi);
      if (typeof follow === "boolean") autoFollowRef.current = follow;
    },
    [dataMin, dataMax]
  );

  const zoomAround = useCallback(
    (centerIndex: number, factor: number) => {
      const span = xMax - xMin;
      const newSpan = clamp(Math.floor(span * factor), 8, Math.max(16, dataMax - dataMin));
      const t = span <= 0 ? 0.5 : (centerIndex - xMin) / span;
      const nxMin = centerIndex - Math.floor(newSpan * t);
      const nxMax = nxMin + newSpan;
      const nearRightEdge = Math.abs(xMax - dataMax) <= 1;
      setDomain(nxMin, nxMax, nearRightEdge);
    },
    [xMin, xMax, dataMin, dataMax, setDomain]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!hasData || wrapWidth <= 0) return;
      const factor = Math.exp(e.deltaY * 0.0015); // +dy => zoom out
      const center = pinnedIdx ?? hoverIdx ?? xMax;
      zoomAround(center, factor);
    },
    [hasData, wrapWidth, pinnedIdx, hoverIdx, xMax, zoomAround]
  );

  const toIndexDelta = useCallback(
    (pixelDx: number): number => {
      const span = Math.max(1, xMax - xMin);
      if (wrapWidth <= 0) return 0;
      return Math.round((pixelDx / wrapWidth) * span);
    },
    [xMin, xMax, wrapWidth]
  );

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX });
    if (pointersRef.current.size === 1) {
      draggingRef.current = true;
      dragStartRef.current = { x: e.clientX, xMin, xMax };
      autoFollowRef.current = false; // user started to pan
    } else if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const spanPx = Math.abs(pts[0].x - pts[1].x);
      pinchRef.current = { initialSpan: Math.max(1, spanPx), baseMin: xMin, baseMax: xMax };
      draggingRef.current = false;
    }
  }, [xMin, xMax]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    const prev = pointersRef.current.get(e.pointerId);
    if (!prev) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX });

    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const spanPx = Math.max(1, Math.abs(pts[0].x - pts[1].x));
      const pinit = pinchRef.current;
      if (!pinit) return;
      const factor = pinit.initialSpan / spanPx; // spread => zoom out
      const center = Math.floor((xMin + xMax) / 2);
      zoomAround(center, factor);
      return;
    }

    if (draggingRef.current && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const deltaIdx = toIndexDelta(dx);
      const nxMin = dragStartRef.current.xMin - deltaIdx;
      const nxMax = dragStartRef.current.xMax - deltaIdx;
      setDomain(nxMin, nxMax, false);
    }
  }, [setDomain, toIndexDelta, zoomAround, xMin, xMax]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    draggingRef.current = false;
    dragStartRef.current = null;
    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }
  }, []);

  const onDoubleClick = useCallback(() => {
    const span = Math.max(8, initialWindow);
    const nxMax = dataMax;
    const nxMin = clamp(nxMax - span, dataMin, nxMax - 1);
    setDomain(nxMin, nxMax, true);
  }, [dataMin, dataMax, initialWindow, setDomain]);

  /** Quick-range buttons */
  const setRangeRight = useCallback(
    (span: number | "max") => {
      if (!hasData) return;
      if (span === "max") {
        setDomain(dataMin, dataMax, true);
        return;
      }
      const nxMax = dataMax;
      const nxMin = clamp(nxMax - Math.max(8, span), dataMin, nxMax - 1);
      setDomain(nxMin, nxMax, true);
    },
    [hasData, dataMin, dataMax, setDomain]
  );

  /** Local window high/low around the active index (in chart units) */
  const localHL = useMemo<{ low: number; high: number; start: number; end: number } | null>(() => {
    if (!hasData) return null;
    const activeIdx = pinnedIdx ?? hoverIdx ?? plotData[plotData.length - 1]?.i ?? xMax;
    const start = Math.max(xMin, activeIdx - Math.floor((xMax - xMin) * 0.1));
    const end = Math.min(xMax, activeIdx + Math.floor((xMax - xMin) * 0.1));
    let low = Number.POSITIVE_INFINITY;
    let high = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < plotData.length; i += 1) {
      const p = plotData[i];
      if (p.i < start || p.i > end) continue;
      const v = p.value;
      if (v < low) low = v;
      if (v > high) high = v;
    }
    if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
    return { low, high, start, end };
  }, [plotData, hoverIdx, pinnedIdx, xMin, xMax, hasData]);

  /** Render */
  if (!hasData) {
    return (
      <div
        className="live-chart empty"
        style={{ minHeight: height + 40 }}
        role="region"
        aria-label="Live valuation chart"
      >
        <div className="chart-empty">
          <div className="chart-empty-title">No data yet</div>
          <div className="chart-empty-sub">Waiting for the first sovereign tick…</div>
        </div>
      </div>
    );
  }

  const childBaselineY = isUsdMode ? (childΦ! * fxOf()) : childΦ!;

  return (
    <div
      ref={wrapRef}
      className="live-chart"
      role="region"
      aria-label="Live valuation chart"
      aria-roledescription="interactive chart"
      style={{ minHeight: height + 48 }}
      onWheel={handleWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      {/* Range buttons (top-right) */}
      <div className="chart-toolbar">
        <button className="range-btn" onClick={() => setRangeRight(128)} aria-label="Show last 128 points">128</button>
        <button className="range-btn" onClick={() => setRangeRight(512)} aria-label="Show last 512 points">512</button>
        <button className="range-btn" onClick={() => setRangeRight(2048)} aria-label="Show last 2048 points">2k</button>
        <button className="range-btn" onClick={() => setRangeRight("max")} aria-label="Show all data">Max</button>
      </div>

      <ResponsiveContainer key={`rc-${reflowKey}`} width="100%" height={height}>
        <LineChart
          data={plotData}
          margin={{ top: 10, right: 12, bottom: 6, left: 4 }}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          onClick={onTap}
        >
          <defs>
            <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors[0]} stopOpacity={0.35} />
              <stop offset="100%" stopColor={colors[0]} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} strokeDasharray="4 6" />
          <XAxis dataKey="i" type="number" domain={[xMin, xMax]} axisLine={false} tickLine={false} hide />
          <YAxis axisLine={false} tickLine={false} hide domain={[yMin, yMax]} width={0} />

          {/* PV line + label (in chart units) */}
          <ReferenceLine
            y={pvChart}
            stroke="rgba(255,255,255,.55)"
            strokeDasharray="5 7"
            strokeWidth={1}
            ifOverflow="extendDomain"
            label={
              <Label
                position="insideTopLeft"
                content={(props: LabelProps): React.ReactElement<SVGElement> => {
                  const vb = props.viewBox as { x?: number; y?: number } | undefined;
                  const x = (vb?.x ?? 0) + 8;
                  const y = (vb?.y ?? 0) + 12;
                  return (
                    <g transform={`translate(${x},${y})`} aria-hidden="true">
                      <rect x={0} y={-12} rx={6} ry={6} width={56} height={18} fill="rgba(0,0,0,.5)" stroke="rgba(255,255,255,.25)" strokeWidth={1} />
                      <text x={28} y={2} fontSize={11} fontWeight={800} textAnchor="middle" fill="rgba(255,255,255,.85)">PV</text>
                    </g>
                  );
                }}
              />
            }
          />

          {/* CHILD baseline (Φ constant; draw at USD or Φ according to mode) */}
          {isChild && (
            <ReferenceLine
              y={childBaselineY}
              stroke={colors[0]}
              strokeOpacity={0.35}
              strokeDasharray="2 4"
              strokeWidth={1}
              ifOverflow="extendDomain"
              label={
                <Label
                  position="insideTopRight"
                  content={(props: LabelProps): React.ReactElement<SVGElement> => {
                    const vb = props.viewBox as { x?: number; y?: number } | undefined;
                    const x = (vb?.x ?? 0) - 6;
                    const y = (vb?.y ?? 0) + 12;
                    const tag = isUsdMode ? "child Φ × FX (baseline)" : "child Φ (constant)";
                    const w = Math.max(140, tag.length * 6.6);
                    return (
                      <g transform={`translate(${x - w},${y})`} aria-hidden="true">
                        <rect x={0} y={-12} rx={6} ry={6} width={w} height={18} fill="rgba(0,0,0,.45)" stroke="rgba(255,255,255,.2)" strokeWidth={1} />
                        <text x={w / 2} y={2} fontSize={11} fontWeight={700} textAnchor="middle" fill={colors[0]}>
                          {tag}
                        </text>
                      </g>
                    );
                  }}
                />
              }
            />
          )}

          {/* Area fill + price line (value is Φ for parent; USD for child) */}
          <Area type="monotone" dataKey="value" stroke="none" fill={`url(#${areaId})`} isAnimationActive={false} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={colors[0]}
            strokeWidth={2.1}
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 5 }}
          />

          {/* Local H/L band around active index (chart units) */}
          {localHL && (
            <ReferenceArea
              x1={localHL.start}
              x2={localHL.end}
              y1={localHL.low}
              y2={localHL.high}
              fill={colors[0]}
              fillOpacity={0.06}
              stroke="rgba(255,255,255,.08)"
              strokeDasharray="3 6"
            />
          )}

          {/* Crosshair & active point */}
          {(() => {
            const activeIdx = pinnedIdx ?? hoverIdx ?? lastIndex;
            const ap = activePoint;
            if (!Number.isFinite(activeIdx) || !ap) return null;
            return (
              <>
                <ReferenceLine x={activeIdx} stroke="rgba(255,255,255,.35)" strokeDasharray="4 6" strokeWidth={1} ifOverflow="extendDomain" />
                <ReferenceLine y={ap.value} stroke="rgba(255,255,255,.25)" strokeDasharray="4 6" strokeWidth={1} ifOverflow="extendDomain" />
                <ReferenceDot x={activeIdx} y={ap.value} r={5} fill={colors[0]} stroke="rgba(0,0,0,.55)" strokeWidth={1} ifOverflow="extendDomain" />
                {localHL && (
                  <>
                    <ReferenceDot x={activeIdx} y={localHL.high} r={0} ifOverflow="extendDomain">
                      <Label content={tinyTag("H")} />
                    </ReferenceDot>
                    <ReferenceDot x={activeIdx} y={localHL.low} r={0} ifOverflow="extendDomain">
                      <Label content={tinyTag("L")} />
                    </ReferenceDot>
                  </>
                )}
              </>
            );
          })()}

          {/* Last price marker + tag: y in CHART UNITS */}
          <ReferenceDot
            x={lastIndex}
            y={isUsdMode ? liveUsd : livePhi}
            r={5.5}
            fill={colors[0]}
            stroke="rgba(0,0,0,.55)"
            strokeWidth={1}
            ifOverflow="extendDomain"
          />
          <ReferenceDot x={lastIndex} y={isUsdMode ? liveUsd : livePhi} r={0} ifOverflow="extendDomain">
            <Label content={renderPriceTag} />
          </ReferenceDot>

          {/* Tiny "child Φ" badge at tail when applicable */}
          {isChild && (
            <ReferenceDot x={lastIndex} y={isUsdMode ? liveUsd : livePhi} r={0} ifOverflow="extendDomain">
              <Label content={tinyTag("child Φ")} />
            </ReferenceDot>
          )}

          <Tooltip content={ChartTooltip} wrapperStyle={{ background: "transparent", border: "0" }} cursor={false} />
        </LineChart>
      </ResponsiveContainer>

      {pinnedIdx == null && hoverIdx == null ? (
        <div className="chart-hint small subtle">Drag to pan • wheel/pinch to zoom • double-click to reset</div>
      ) : null}
    </div>
  );
}
