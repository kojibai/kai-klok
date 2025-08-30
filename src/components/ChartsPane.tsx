// app/components/ChartsPane.tsx
"use client";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine
} from "recharts";

export type ChartsPaneProps = {
  sparkData: Array<{ i: number; value: number }>;
  lineData: Array<{ i: number; value: number; premium: number }>;
  current: number;
  colors: string[];
  currency: (n: number) => string;
  pieData: Array<{ name: string; value: number }>;
};

export default function ChartsPane({ sparkData, lineData, current, colors, currency, pieData }: ChartsPaneProps) {
  return (
    <>
      {/* sparkline */}
      <div style={{ width: 260, height: 54 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors[0]} stopOpacity={0.9}/>
                <stop offset="100%" stopColor={colors[0]} stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke={colors[0]} fill="url(#valGrad)" strokeWidth={2} />
            <ReferenceLine y={current} stroke="#ffffff55" strokeDasharray="3 3" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* composition pie */}
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
              {pieData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number, n: string) => [currency(v), n]} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* trends */}
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={lineData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#ffffff14" vertical={false} />
            <XAxis dataKey="i" tick={{ fill: "#aee8df" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: "#aee8df" }} tickLine={false} axisLine={false} width={70} />
            <Tooltip
              formatter={(v: number) => currency(v)}
              labelFormatter={(l: number) => `t=${l}`}
            />
            <Line type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="premium" stroke={colors[1]} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
