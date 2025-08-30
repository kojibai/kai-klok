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
import { currency } from "../display";
import type { ChartPoint } from "../series";

/** ─────────────────────────────────────────────────────────────
 * Props
 * ───────────────────────────────────────────────────────────── */
export type LiveChartProps = {
  data: ChartPoint[];         // { i: number; value: number; ... }
  live: number;               // latest price
  pv: number;                 // intrinsic
  premiumX: number;           // premium multiplier
  momentX: number;            // moment multiplier
  colors: string[];           // [primary, ...]
  height?: number;
  reflowKey?: number;

  /** Initial window size in points (from the right). Default: 256 */
  initialWindow?: number;

  /** Percent padding added to Y scale. Default: 7% */
  yPaddingPct?: number;
};

/** ─────────────────────────────────────────────────────────────
 * Recharts helper types
 * ───────────────────────────────────────────────────────────── */
type MouseMoveFunc = NonNullable<React.ComponentProps<typeof LineChart>["onMouseMove"]>;
type MouseLeaveFunc = NonNullable<React.ComponentProps<typeof LineChart>["onMouseLeave"]>;
type ClickFunc = NonNullable<React.ComponentProps<typeof LineChart>["onClick"]>;
type RechartsValue = number | string | Array<number | string>;
type RechartsName = number | string;

type StateWithPayload = {
  activePayload?: Array<{ payload: ChartPoint }>;
  activeTooltipIndex?: number | null;
};

/** Safe Math */
const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

/** Pixel → index: needs container width */
/* NOTE: Some @types/react versions infer `RefObject<HTMLDivElement | null>` here.
   We explicitly cast on return to satisfy `ref` prop’s `Ref<HTMLDivElement>` shape. */
function useContainerWidth(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
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

  return [ref as unknown as React.RefObject<HTMLDivElement>, w];
}

/** ─────────────────────────────────────────────────────────────
 * Component
 * ───────────────────────────────────────────────────────────── */
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
}: LiveChartProps) {
  // Container & width (for pan/zoom calculations)
  const [wrapRef, wrapWidth] = useContainerWidth();

  // Basic guards
  const safeData = useMemo<ChartPoint[]>(() => (Array.isArray(data) ? data : []), [data]);
  const hasData = safeData.length > 1;
  const dataMin = hasData ? safeData[0].i : 0;
  const dataMax = hasData ? safeData[safeData.length - 1].i : 1;
  const lastIndex = hasData ? safeData[safeData.length - 1].i : 0;

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
    for (let i = 0; i < safeData.length; i += 1) {
      const p = safeData[i];
      if (p.i < xMin || p.i > xMax) continue;
      const v = p.value;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    if (minV === hi || maxV === lo) return [0, 1];
    const pad = Math.max(1e-9, (maxV - minV) * (yPaddingPct / 100));
    return [minV - pad, maxV + pad];
  }, [safeData, xMin, xMax, yPaddingPct, hasData]);

  // Hover & pin (cursor / selection)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [pinnedIdx, setPinnedIdx] = useState<number | null>(null);

  /** Gradient id (stable for chart instance) */
  const areaId = useMemo(() => `grad-${Math.random().toString(36).slice(2)}`, []);

  /** Tiny H/L tag */
  const tinyTag =
    (text: string) =>
    (props: LabelProps): React.ReactElement<SVGElement> => {
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
    };

  /** Last price tag */
  const renderPriceTag = useCallback(
    (props: LabelProps): React.ReactElement<SVGElement> => {
      const vb = props.viewBox as { x?: number; y?: number } | undefined;
      const x = typeof vb?.x === "number" ? vb.x : 0;
      const y = typeof vb?.y === "number" ? vb.y : 0;
      const tag = currency(live);
      const w = Math.max(64, tag.length * 8.2) + 12;
      return (
        <g transform={`translate(${x + 10},${y - 10})`} aria-hidden="true">
          <rect
            x={0}
            y={-24}
            rx={8}
            ry={8}
            width={w}
            height={22}
            fill="rgba(0,0,0,.55)"
            stroke="rgba(255,255,255,.25)"
            strokeWidth={1}
          />
          <text x={8} y={-9} fontSize={12} fontWeight={800} fill={colors[0]}>
            {tag}
          </text>
        </g>
      );
    },
    [colors, live]
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

  /** Tooltip (Robinhood/TV style) */
  type ChartTooltipProps = RTooltipProps<RechartsValue, RechartsName> & {
    payload?: Array<{ payload: ChartPoint }>;
  };
  const ChartTooltip = useCallback(
    (props: ChartTooltipProps) => {
      const { active, payload } = props;
      if (!active || !payload?.length) return null;
      const p = payload[0].payload;
      const price = p.value;
      const premOnly = Math.max(0, price - pv);
      const startVisible = safeData.find((pt) => pt.i >= xMin)?.value ?? price;
      const chg = ((price - startVisible) / (startVisible || 1)) * 100;

      return (
        <div className="tt-card">
          <div className="tt-row"><span>Price</span><strong>{currency(price)}</strong></div>
          <div className="tt-row"><span>Intrinsic (PV)</span><strong>{currency(pv)}</strong></div>
          <div className="tt-row"><span>Premium</span><strong>{currency(premOnly)}</strong></div>
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
    [pv, premiumX, momentX, safeData, xMin]
  );

  /** Active point under cursor/pin */
  const activePoint = useMemo(() => {
    const activeIdx = pinnedIdx ?? hoverIdx ?? lastIndex;
    if (activeIdx == null) return null;
    return safeData.find((d) => d.i === activeIdx) ?? null;
  }, [safeData, hoverIdx, pinnedIdx, lastIndex]);

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

  /** Local window high/low around the active index */
  const localHL = useMemo<{ low: number; high: number; start: number; end: number } | null>(() => {
    if (!hasData) return null;
    const activeIdx = pinnedIdx ?? hoverIdx ?? safeData[safeData.length - 1]?.i ?? xMax;
    const start = Math.max(xMin, activeIdx - Math.floor((xMax - xMin) * 0.1));
    const end = Math.min(xMax, activeIdx + Math.floor((xMax - xMin) * 0.1));
    let low = Number.POSITIVE_INFINITY;
    let high = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < safeData.length; i += 1) {
      const p = safeData[i];
      if (p.i < start || p.i > end) continue;
      const v = p.value;
      if (v < low) low = v;
      if (v > high) high = v;
    }
    if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
    return { low, high, start, end };
  }, [safeData, hoverIdx, pinnedIdx, xMin, xMax, hasData]);

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
          data={safeData}
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
          <XAxis
            dataKey="i"
            type="number"
            domain={[xMin, xMax]}
            axisLine={false}
            tickLine={false}
            hide
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            hide
            domain={[yMin, yMax]}
            width={0}
          />

          {/* PV line + label */}
          <ReferenceLine
            y={pv}
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

          {/* Area fill + price line */}
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

          {/* Local H/L band around active index */}
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
                      <Label content={tinyTag("H") as unknown as LabelProps["content"]} />
                    </ReferenceDot>
                    <ReferenceDot x={activeIdx} y={localHL.low} r={0} ifOverflow="extendDomain">
                      <Label content={tinyTag("L") as unknown as LabelProps["content"]} />
                    </ReferenceDot>
                  </>
                )}
              </>
            );
          })()}

          {/* Last price marker + tag */}
          <ReferenceDot x={lastIndex} y={live} r={5.5} fill={colors[0]} stroke="rgba(0,0,0,.55)" strokeWidth={1} ifOverflow="extendDomain" />
          <ReferenceDot x={lastIndex} y={live} r={0} ifOverflow="extendDomain">
            <Label content={renderPriceTag} />
          </ReferenceDot>

          <Tooltip content={ChartTooltip} wrapperStyle={{ background: "transparent", border: "0" }} cursor={false} />
        </LineChart>
      </ResponsiveContainer>

      {pinnedIdx == null && hoverIdx == null ? (
        <div className="chart-hint small subtle">Drag to pan • wheel/pinch to zoom • double-click to reset</div>
      ) : null}
    </div>
  );
}
