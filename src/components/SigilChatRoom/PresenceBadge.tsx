"use client";

import { useMemo } from "react";
import "./PresenceBadge.css";

import { getSolarArcName, pulsesIntoBeatFromPulse } from "../../SovereignSolar";
import { truncateMiddle } from "./utils/format";
import { getKaiPulseEternalInt } from "../../SovereignSolar";

export type PresenceBadgeProps = {
  userPhiKey: string;
  kaiPulse?: number;
  showLabel?: boolean;
  animate?: boolean;
  small?: boolean;
};

/** Call getSolarArcName with either (pulse:number) or (date:Date) safely */
function resolveSolarArc(pulse: number): string {
  // Try numeric signature first (if library provides it)
  const asNumber = getSolarArcName as unknown as (p: number) => string;
  try {
    const r = asNumber(pulse);
    if (typeof r === "string" && r.length > 0) return r;
  } catch {
    // fall through to Date signature
  }
  // Fallback: assume Date signature
  const asDate = getSolarArcName as unknown as (d: Date) => string;
  // If the pulse already looks like ms epoch, use directly; else bridge via now
  const dateCandidate =
    pulse > 1_000_000_000_000 && pulse < 100_000_000_000_000
      ? new Date(pulse)
      : new Date(Date.now());
  return asDate(dateCandidate);
}

export default function PresenceBadge({
  userPhiKey,
  kaiPulse,
  showLabel = true,
  animate = false,
  small = false,
}: PresenceBadgeProps) {
  const pulse = useMemo(() => kaiPulse ?? getKaiPulseEternalInt(), [kaiPulse]);
  const beat = pulsesIntoBeatFromPulse(pulse);
  const arc = useMemo(() => resolveSolarArc(pulse), [pulse]);

  const identicon = useMemo(() => {
    const seed = userPhiKey.slice(0, 16);
    const hue = parseInt(seed.slice(0, 6), 16) % 360;
    return {
      background: `linear-gradient(135deg, hsl(${hue}, 80%, 55%), hsl(${(hue + 72) % 360}, 80%, 60%))`,
      glow: `hsl(${hue}, 100%, 70%)`,
    };
  }, [userPhiKey]);

  return (
    <div
      className={`presence-badge ${small ? "small" : ""} ${animate ? "pulse" : ""}`}
      style={{
        background: identicon.background,
        boxShadow: animate ? `0 0 12px ${identicon.glow}` : "none",
      }}
      title={`Pulse ${pulse} • Beat ${beat} • ${arc}`}
    >
      {showLabel && (
        <span className="presence-label">
          {truncateMiddle(userPhiKey, 8)}
        </span>
      )}
    </div>
  );
}
