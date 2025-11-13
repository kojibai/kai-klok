// src/pages/sigilstream/status/KaiStatus.tsx
"use client";

import type React from "react";
import { useAlignedKaiTicker, useKaiPulseCountdown } from "../core/ticker";
import { pad2 } from "../core/utils";

/**
 * KaiStatus — μpulse-true header status bar.
 * - Shows Kairos beat:step, weekday & chakra, absolute pulse, and countdown to next boundary.
 * - Tightly coupled with core/ticker which phase-locks CSS vars (--pulse-dur / --pulse-offset).
 */
export function KaiStatus(): React.JSX.Element {
  const kaiNow = useAlignedKaiTicker();
  const secsLeft = useKaiPulseCountdown(true);

  const beatStepDisp = `${kaiNow.beat}:${pad2(kaiNow.step)}`;

  return (
    <div
      className="kai-feed-status"
      role="status"
      aria-live="polite"
      data-kai-beat={kaiNow.beat}
      data-kai-step={kaiNow.step}
      data-kai-bsi={beatStepDisp}
      data-kai-pulse={kaiNow.pulse}
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 12px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        margin: "8px 12px 6px",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span>
        <strong>Kairos:</strong> {beatStepDisp} • {kaiNow.harmonicDay} • {kaiNow.chakraDay}
        {" • "}
        <strong>pulse</strong> {kaiNow.pulse}
      </span>
      <span>
        next in{" "}
        <strong>{secsLeft !== null ? secsLeft.toFixed(6) : "—"}</strong>
        s
      </span>
    </div>
  );
}

export default KaiStatus;
