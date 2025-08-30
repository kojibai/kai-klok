"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { currency } from "../display";

export type DonutDatum = { name: string; value: number };

export type ValueDonutProps = {
  /** Prefer passing price & pv; `data` remains supported for legacy usage (two-slice array). */
  data?: DonutDatum[];
  price?: number;          // current price (e.g., `live`)
  pv?: number;             // intrinsic value
  premiumX?: number;       // optional multiplier to show in tooltip
  momentX?: number;        // optional multiplier to show in tooltip
  colors: string[];        // [primary], used for the delta (premium/discount) slice
  size?: number;           // overall glyph size (px)
  ariaLabel?: string;      // override screenreader label
};

export default function ValueDonut({
  data,
  price,
  pv,
  premiumX,
  momentX,
  colors,
  size = 120,
  ariaLabel,
}: ValueDonutProps) {
  const primary = colors[0] ?? "#6cf";
  const neutral = "rgba(255,255,255,.12)";

  // —— derive composition from price/pv (preferred), else use provided `data`
  const { composed, label, pct, absPct, priceSafe, pvSafe } = useMemo(() => {
    const p = Number.isFinite(price as number) ? (price as number) : NaN;
    const v = Number.isFinite(pv as number) ? (pv as number) : NaN;

    if (Number.isFinite(p) && Number.isFinite(v) && (p > 0 || v > 0)) {
      const over = p - v;
      const base = Math.max(p, v); // normalize total so ring is full regardless of over/under
      const positive = over >= 0;

      const composedData: DonutDatum[] = positive
        ? [
            { name: "Intrinsic", value: Math.max(0, Math.min(v, base)) },
            { name: "Premium", value: Math.max(0, over) },
          ]
        : [
            { name: "Price", value: Math.max(0, Math.min(p, base)) },
            { name: "Discount", value: Math.max(0, -over) },
          ];

      const denom = v > 0 ? v : Math.max(1, p); // % vs PV if possible
      const pctVal = (over / denom) * 100;

      return {
        composed: composedData,
        label: positive ? "Premium to PV" : "Discount to PV",
        pct: pctVal,
        absPct: Math.abs(pctVal),
        priceSafe: p,
        pvSafe: v,
      };
    }

    // Fallback: use provided `data` (legacy path)
    const legacy = Array.isArray(data) ? data : [{ name: "Base", value: 1 }, { name: "Delta", value: 0 }];
    return {
      composed: legacy,
      label: "Value composition",
      pct: NaN,
      absPct: NaN,
      priceSafe: p,
      pvSafe: v,
    };
  }, [price, pv, data]);

  const cx = size / 2;
  const cy = size / 2;
  const innerR = Math.round(size * 0.27);
  const outerR = Math.round(size * 0.45);

  // Accessibility label
  const a11y =
    ariaLabel ??
    (Number.isFinite(pct)
      ? `${currency(priceSafe)} • ${label}: ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% • PV ${currency(pvSafe)}`
      : "Value composition donut");

  // Center label strings
  const centerTop = Number.isFinite(pct) ? (pct >= 0 ? "Premium" : "Discount") : "Value";
  const centerMid = Number.isFinite(pct) ? `${pct >= 0 ? "+" : "−"}${absPct.toFixed(1)}%` : "—";
  const centerBot =
    Number.isFinite(priceSafe) && Number.isFinite(pvSafe)
      ? `${currency(priceSafe)} vs PV ${currency(pvSafe)}`
      : "";

  // Colors per slice (first is base, second is delta)
  const cellColors = [neutral, primary];

  return (
    <div className="kpi-donut" role="img" aria-label={a11y}>
      <PieChart width={size} height={size}>
        <Pie
          data={composed}
          dataKey="value"
          nameKey="name"
          cx={cx}
          cy={cy}
          innerRadius={innerR}
          outerRadius={outerR}
          startAngle={90}
          endAngle={-270}              // clockwise
          cornerRadius={outerR * 0.18} // smooth, modern pill edges
          paddingAngle={2}
          isAnimationActive={false}
          stroke="rgba(255,255,255,.25)"
          strokeWidth={1}
        >
          {composed.map((_, i) => (
            <Cell key={i} fill={cellColors[i] ?? neutral} />
          ))}
        </Pie>

        {/* Center label */}
        <g aria-hidden="true">
          <text
            x={cx}
            y={cy - outerR * 0.20}
            textAnchor="middle"
            style={{ fontSize: Math.max(9, Math.round(size * 0.10)), opacity: 0.8 }}
          >
            {centerTop}
          </text>
          <text
            x={cx}
            y={cy + 2}
            textAnchor="middle"
            style={{ fontWeight: 800, fontSize: Math.max(12, Math.round(size * 0.22)) }}
            className={Number.isFinite(pct) ? (pct >= 0 ? "gain" : "loss") : undefined}
          >
            {centerMid}
          </text>
          {centerBot ? (
            <text
              x={cx}
              y={cy + outerR * 0.28}
              textAnchor="middle"
              style={{ fontSize: Math.max(8, Math.round(size * 0.085)), opacity: 0.8 }}
            >
              {centerBot}
            </text>
          ) : null}
        </g>

        {/* Rich tooltip */}
        <Tooltip
          cursor={false}
          wrapperStyle={{ border: 0 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const rows: Array<[string, string]> = [];
            if (Number.isFinite(priceSafe)) rows.push(["Price", currency(priceSafe)]);
            if (Number.isFinite(pvSafe)) rows.push(["Intrinsic (PV)", currency(pvSafe)]);
            if (Number.isFinite(pct)) rows.push([centerTop, `${pct >= 0 ? "+" : "−"}${absPct.toFixed(2)}%`]);
            if (Number.isFinite(premiumX as number)) rows.push(["Premium ×", (premiumX as number).toFixed(6)]);
            if (Number.isFinite(momentX as number)) rows.push(["Moment ×", (momentX as number).toFixed(6)]);

            return (
              <div className="tt-card">
                {rows.map(([k, v]) => (
                  <div key={k} className="tt-row">
                    <span>{k}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
            );
          }}
        />
      </PieChart>
    </div>
  );
}
