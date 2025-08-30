// src/utils/klock_adapters.ts
// Maps φ-exact engine output (buildKaiKlockResponse) → typed KlockData used by the app.

import type {
    KlockData,
    HarmonicLevels,
    SpiralBeat,
    EternalSpiralBeat,
    SpiralStep,
  } from "../types/klockTypes";
  import { microPulsesSinceGenesis } from "./kai_pulse";
  
  /** Local Euclidean floor division (matches kai_pulse semantics) */
  function floorDivE(a: bigint, d: bigint): bigint {
    const q = a / d;
    const r = a % d;
    return (r === 0n || a >= 0n) ? q : q - 1n;
  }
  
  type EngineOut = Awaited<
    ReturnType<typeof import("./kai_pulse").buildKaiKlockResponse>
  >;
  
  /**
   * Pulses since solar sunrise (UTC-aligned) for the evaluated instant.
   * Falls back to eternal "today" pulses if sunrise is unavailable.
   */
  function pulsesSinceSolarSunrise(
    res: EngineOut,
    when?: string | Date | bigint
  ): number {
    try {
      if (!res.solar_day_start_iso || !when) return res.kaiPulseToday;
      const sunriseMs = BigInt(new Date(res.solar_day_start_iso).getTime());
      const msUTC =
        typeof when === "string"
          ? BigInt(new Date(when).getTime())
          : typeof when === "bigint"
          ? when
          : BigInt(when.getTime());
  
      const muNow = microPulsesSinceGenesis(msUTC);
      const muSunrise = microPulsesSinceGenesis(sunriseMs);
      // integer pulses since sunrise
      return Number(floorDivE(muNow - muSunrise, 1_000_000n));
    } catch {
      return res.kaiPulseToday;
    }
  }
  
  /** Map φ-exact engine output → your KlockData (strict, no UI logic) */
  export function toKlockData(
    res: EngineOut,
    when?: string | Date | bigint
  ): KlockData {
    // ── 0) Compute solar-aligned "today" pulses up-front so we can use it in the object
    const solarAlignedUTC = pulsesSinceSolarSunrise(res, when);
  
    // ── 1) Harmonic levels (rename chakraLoop → SpiralLoop to match your types)
    const harmonicLevels: HarmonicLevels = {
      arcBeat: {
        pulseInCycle: res.harmonicLevels.arcBeat.pulseInCycle,
        cycleLength: res.harmonicLevels.arcBeat.cycleLength,
        percent: res.harmonicLevels.arcBeat.percent,
      },
      microCycle: {
        pulseInCycle: res.harmonicLevels.microCycle.pulseInCycle,
        cycleLength: res.harmonicLevels.microCycle.cycleLength,
        percent: res.harmonicLevels.microCycle.percent,
      },
      SpiralLoop: {
        pulseInCycle: res.harmonicLevels.chakraLoop.pulseInCycle,
        cycleLength: res.harmonicLevels.chakraLoop.cycleLength,
        percent: res.harmonicLevels.chakraLoop.percent,
      },
      harmonicDay: {
        pulseInCycle: res.harmonicLevels.harmonicDay.pulseInCycle,
        cycleLength: res.harmonicLevels.harmonicDay.cycleLength,
        percent: res.harmonicLevels.harmonicDay.percent,
      },
    };
  
    // ── 2) Beats/steps
    const SpiralBeat: SpiralBeat = {
      beatIndex: res.chakraBeat.beatIndex,
      pulsesIntoBeat: res.chakraBeat.pulsesIntoBeat,
      beatPulseCount: res.chakraBeat.beatPulseCount,
      totalBeats: res.chakraBeat.totalBeats,
    };
  
    const eternalSpiralBeat: EternalSpiralBeat = {
      ...SpiralBeat,
      percentToNext: res.eternalChakraBeat.percentToNext,
    };
  
    const SpiralStep: SpiralStep = {
      stepIndex: res.chakraStep.stepIndex,
      percentIntoStep: res.chakraStep.percentIntoStep,
      stepsPerBeat: res.chakraStep.stepsPerBeat,
    };
  
    const solarSpiralStep: SpiralStep = {
      stepIndex: res.solarChakraStep.stepIndex,
      percentIntoStep: res.solarChakraStep.percentIntoStep,
      stepsPerBeat: res.solarChakraStep.stepsPerBeat,
    };
  
    // ── 3) Compose KlockData (display strings + counts)
    // IMPORTANT: kaiPulseToday is SOLAR-ALIGNED; eternalKaiPulseToday carries the eternal count.
    const kd: KlockData = {
      // 🧭 Core Kai-Turah Calendar Info
      eternalMonth: res.eternalMonth,
      eternalMonthIndex: res.eternalMonthIndex,
      eternalMonthDescription: res.eternalMonthDescription,
  
      harmonicDay: res.harmonicDay,
      harmonicDayDescription: res.harmonicDayDescription,
      SpiralArc: res.eternalChakraArc,
  
      // Use sunrise-aligned pulses for "today"
      kaiPulseToday: solarAlignedUTC,
      // Total eternal pulse index (unchanged)
      kaiPulseEternal: res.kaiPulseEternal,
  
      phiSpiralLevel: res.phiSpiralLevel,
      kaiTurahPhrase: res.kaiTurahPhrase,
      eternalYearName: res.eternalYearName,
  
      // 📊 Harmonic Cycle Structures
      harmonicLevels,
      harmonicWeekProgress: res.harmonicWeekProgress,
      eternalMonthProgress: res.eternalMonthProgress,
      harmonicYearProgress: res.harmonicYearProgress,
      SpiralBeat,
  
      timestamp: new Date().toISOString(), // set/override in caller
      harmonicTimestampDescription: res.harmonicTimestampDescription,
  
      // 🌈 Spiral Arc Resonance Attributes (you can enrich later)
      SpiralZone: res.eternalChakraArc,
      harmonicFrequencies: [],
      harmonicInputs: [],
      sigilFamily: "Kairos",
      kaiTurahArcPhrase: res.kaiTurahPhrase,
  
      // 🔄 Pulse-Based Completion Metrics (initialize to 0)
      arcBeatCompletions: 0,
      microCycleCompletions: 0,
      SpiralLoopCompletions: 0,
      harmonicDayCompletions: 0,
      harmonicYearCompletions: 0,
  
      // 🌀 Week Metadata (Used in WeekView)
      weekIndex: res.weekIndex,
      weekName: res.weekName,
      dayOfMonth: res.dayOfMonth,
  
      // 🆕 Kairos & Seal Metadata
      eternalSeal: res.eternalSeal,
      seal: res.seal,
      kaiMomentSummary: res.kaiMomentSummary,
  
      // 🆕 Spiral Beat (eternal time precision)
      eternalKaiPulseToday: res.eternalKaiPulseToday,
      eternalSpiralBeat,
  
      // 🆕 Spiral Step Precision
      SpiralStep,
      SpiralStepString: res.chakraStepString,
  
      // 🆕 Solar-Aligned Step Precision
      solarSpiralStep,
      solarSpiralStepString: res.solarChakraStepString,
  
      eternalWeekDescription: res.eternalWeekDescription,
    };
  
    return kd;
  }
  