import React from "react";
import "./WeekView.css";
import type { KlockData } from "../types/klockTypes";


// ─────────────────────────────────────────────────────────────
// Spiral + Week Color Maps
// ─────────────────────────────────────────────────────────────
const Spiral_DAY_COLORS: Record<string, string> = {
  Solhara: "#ff1559",   // Root – Fire
  Aquaris: "#ff6d00",   // Sakral – Water
  Flamora: "#ffd900",   // Solar – Fire
  Verdari: "#00ff66",   // Heart – Earth
  Sonari:  "#05e6ff",   // Throat – Air
  Kaelith: "#c300ff"    // Krown – Ether
};

const WEEK_COLORS = [
  "#a220f0", "#7e2cf4", "#5837f8", "#3d43fc", "#375cfb", "#3283f9", "#2dc2f6"
];

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────
type Props = {
  klock: KlockData;
  onClose: () => void;
};

// ─────────────────────────────────────────────────────────────
// Component: WeekView
// ─────────────────────────────────────────────────────────────
const WeekView: React.FC<Props> = ({ klock, onClose }) => {
  const center = 200;
  const ringStep = 25;
  const segmentAngle = (2 * Math.PI) / 6;

  const getPolar = (r: number, angle: number) => ({
    x: center + r * Math.cos(angle),
    y: center + r * Math.sin(angle),
  });

  return (
    <div className="week-view-overlay" onClick={onClose}>
      <div className="week-view-container" onClick={(e) => e.stopPropagation()}>
        <svg className="week-view-spiral" width="400" height="400" viewBox="0 0 400 400">
          {/* Radial Lines for Days */}
          {[...Array(6)].map((_, i) => {
            const { x, y } = getPolar(160, i * segmentAngle);
            return (
              <line
                key={`line-${i}`}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="white"
                strokeWidth={1.5}
                opacity={0.3}
              />
            );
          })}

          {/* Weekly Spiral Rings */}
          {[...Array(7)].map((_, weekIndex) => (
            <path
              key={`week-${weekIndex}`}
              d={
                [
                  "M",
                  ...[...Array(6)].map((_, i) => {
                    const r = ringStep * (weekIndex + 1);
                    const { x, y } = getPolar(r, i * segmentAngle);
                    return `${x},${y}`;
                  }),
                  "Z"
                ].join(" ")
              }
              fill="none"
              stroke={WEEK_COLORS[weekIndex]}
              strokeWidth={2.5}
              opacity={klock.weekIndex === weekIndex ? 1 : 0.3}
              className={klock.weekIndex === weekIndex ? "glow-ring" : ""}
            />
          ))}

          {/* Spiral Day Labels */}
          {Object.entries(Spiral_DAY_COLORS).map(([name, color], i) => {
            const pos = getPolar(185, i * segmentAngle);
            return (
              <text
                key={name}
                x={pos.x}
                y={pos.y}
                fill={color}
                fontSize="11"
                textAnchor="middle"
                alignmentBaseline="middle"
                fontFamily="Orbitron, sans-serif"
              >
                {name}
              </text>
            );
          })}

          {/* Center Dot */}
          <circle
            cx={center}
            cy={center}
            r={6}
            fill="#ffffff"
            stroke="#00f0ff"
            strokeWidth={1.5}
          />
        </svg>

        {/* ────── Textual Summary ────── */}
        <div className="week-view-details">
          <h2>Week {klock.weekIndex + 1} · {klock.weekName}</h2>

          <p>
            Currently in: <strong>{klock.harmonicDay}</strong> – <em>{klock.harmonicDayDescription}</em>
          </p>

          <p>
            Kai Pulse Today: <strong>{klock.kaiPulseToday}</strong> / <strong>17,491.27</strong>
          </p>

          <p>
            Week Completion: <strong>{klock.harmonicWeekProgress?.percent.toFixed(2)}%</strong>
          </p>

          <p>
            Pulses Into Week: <strong>{klock.harmonicWeekProgress?.pulsesIntoWeek.toFixed(2)}</strong>
          </p>

          <button className="week-close-btn" onClick={onClose}>✦ Close</button>
        </div>
      </div>
    </div>
  );
};

export default WeekView;