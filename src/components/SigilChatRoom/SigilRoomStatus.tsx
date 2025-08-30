"use client";

import { ChevronRight } from "lucide-react";
import {
  getDisplayAlignedCounters,
  getSolarArcName,
  pulsesIntoBeatFromPulse,
} from "../../SovereignSolar";

export type SigilRoomStatusProps = {
  pulse: number;
  connected: boolean;
  roomTitle?: string;
  uid?: string;
};

type CountersShape = {
  display?: {
    dayName?:
      | "Solhara"
      | "Aquaris"
      | "Flamora"
      | "Verdari"
      | "Sonari"
      | "Kaelith";
    dayIndex1?: number;
    dayInMonth1?: number;
    dayInYear1?: number;
    monthIndex1?: number;
    monthName?:
      | "Aethon"
      | "Virelai"
      | "Solari"
      | "Amarin"
      | "Kaelus"
      | "Umbriel"
      | "Noctura"
      | "Liora";
    weekIndex1?: number;
  };
  eternal?: {
    stepIndex?: number;
    beatIndex?: number;
  };
};

/** Safely call getSolarArcName with number-or-Date signatures */
function solarArcFromPulse(pulse: number): string {
  // Try number signature first
  try {
    const asNumber = getSolarArcName as unknown as (p: number) => string;
    const r = asNumber(pulse);
    if (typeof r === "string") return r;
  } catch {
    // fall through
  }
  // Fallback to Date signature
  const isEpochMs = pulse > 1_000_000_000_000 && pulse < 100_000_000_000_000;
  const when = isEpochMs ? new Date(pulse) : new Date();
  const asDate = getSolarArcName as unknown as (d: Date) => string;
  return asDate(when);
}

/** Safely call getDisplayAlignedCounters with number-or-Date signatures */
function countersFromPulse(pulse: number): CountersShape {
  // Try number signature first
  try {
    const asNumber = getDisplayAlignedCounters as unknown as (
      p: number
    ) => unknown;
    return asNumber(pulse) as CountersShape;
  } catch {
    // fall through
  }
  // Fallback to Date signature
  const isEpochMs = pulse > 1_000_000_000_000 && pulse < 100_000_000_000_000;
  const when = isEpochMs ? new Date(pulse) : new Date();
  const asDate = getDisplayAlignedCounters as unknown as (d: Date) => unknown;
  return asDate(when) as CountersShape;
}

/** Safely call pulsesIntoBeatFromPulse with number-or-Date signatures */
function beatFromPulse(pulse: number): number {
  // Try number signature
  try {
    const asNumber = pulsesIntoBeatFromPulse as unknown as (
      p: number
    ) => number;
    const v = asNumber(pulse);
    if (Number.isFinite(v)) return v;
  } catch {
    // fall through
  }
  // Fallback to Date signature
  const isEpochMs = pulse > 1_000_000_000_000 && pulse < 100_000_000_000_000;
  const when = isEpochMs ? new Date(pulse) : new Date();
  const asDate = pulsesIntoBeatFromPulse as unknown as (d: Date) => number;
  const v = asDate(when);
  return Number.isFinite(v) ? v : 0;
}

export default function SigilRoomStatus({
  pulse,
  connected,
  roomTitle,
  uid,
}: SigilRoomStatusProps) {
  const counters = countersFromPulse(pulse);

  const chakraDay =
    typeof counters.display?.dayName === "string"
      ? counters.display.dayName
      : undefined;

  const beatIndex =
    typeof counters.eternal?.beatIndex === "number"
      ? counters.eternal.beatIndex
      : beatFromPulse(pulse);

  const stepIndex =
    typeof counters.eternal?.stepIndex === "number"
      ? counters.eternal.stepIndex
      : Math.abs(pulse) % 44; // stable fallback 0..43

  const solarArc = solarArcFromPulse(pulse);
  const title =
    roomTitle && roomTitle.trim().length > 0 ? roomTitle : "Unnamed";

  return (
    <div className="px-4 py-3 bg-neutral-900/80 rounded-xl shadow-md flex justify-between items-center text-xs sm:text-sm text-white/80">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="font-mono text-teal-300 tracking-tight">
          🔐 Room: <span className="text-white">{title}</span>
        </div>

        <div className="hidden sm:block text-neutral-500">
          <ChevronRight className="inline w-4 h-4" />
        </div>

        <div className="font-mono">
          🫁 Pulse: <span className="text-white">{pulse}</span>
        </div>

        <div className="font-mono">
          ☀️ Arc: <span className="text-white">{solarArc}</span>
        </div>

        <div className="font-mono">
          🌈 Step: <span className="text-white">{stepIndex}</span>
        </div>

        <div className="font-mono">
          💎 Beat: <span className="text-white">{beatIndex}</span>
        </div>

        {chakraDay && (
          <div className="font-mono">
            🪷 Day: <span className="text-white">{chakraDay}</span>
          </div>
        )}

        <div
          className={`ml-1 h-2.5 w-2.5 rounded-full ${
            connected ? "bg-emerald-400 animate-pulse" : "bg-neutral-500"
          }`}
          aria-label={connected ? "connected" : "offline"}
          title={connected ? "connected" : "offline"}
        />
      </div>

      {uid && (
        <div className="hidden sm:block text-[10px] text-neutral-600 font-mono">
          UID: <span className="text-xs text-neutral-400">{uid}</span>
        </div>
      )}
    </div>
  );
}
