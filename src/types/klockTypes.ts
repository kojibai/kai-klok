export type HarmonicCycleData = {
  pulseInCycle: number;
  cycleLength: number;
  percent: number;
};

export type HarmonicLevels = {
  arcBeat: HarmonicCycleData;
  microCycle: HarmonicCycleData;
  SpiralLoop: HarmonicCycleData;
  harmonicDay: HarmonicCycleData;
};

export type EternalMonthProgress = {
  daysElapsed: number;
  daysRemaining: number;
  percent: number;
};

export type HarmonicWeekProgress = {
  weekDay: string;
  weekDayIndex: number;
  pulsesIntoWeek: number;
  percent: number;
};

export type HarmonicYearProgress = {
  daysElapsed: number;
  daysRemaining: number;
  percent: number;
};

export type SpiralBeat = {
  beatIndex: number;
  pulsesIntoBeat: number;
  beatPulseCount: number;
  totalBeats: number;
};

export type EternalSpiralBeat = SpiralBeat & {
  percentToNext: number;
};

export type SpiralStep = {
  stepIndex: number;
  percentIntoStep: number;
  stepsPerBeat: number;
};

export type HarmonicTimestamp = {
  label: string;
  description: string;
  kaiPulses: {
    solarAlignedUTC: number;
    eternalTotal: number;
    dayPercent: number;
  };
};

export type KlockData = {
  // 🧭 Core Kai-Turah Calendar Info
  eternalMonth: string;
  eternalMonthIndex: number;
  eternalMonthDescription: string;

  harmonicDay: string;
  harmonicDayDescription: string;
  SpiralArc: string;

  kaiPulseToday: number;
  kaiPulseEternal: number;

  phiSpiralLevel: number;
  kaiTurahPhrase: string;
  eternalYearName: string;

  // 📊 Harmonic Cycle Structures
  harmonicLevels: HarmonicLevels;
  harmonicWeekProgress: HarmonicWeekProgress;
  eternalMonthProgress: EternalMonthProgress;
  harmonicYearProgress: HarmonicYearProgress;
  SpiralBeat: SpiralBeat;

  timestamp: string;
  harmonicTimestampDescription: string;

  // 🌈 Spiral Arc Resonance Attributes
  SpiralZone: string;
  harmonicFrequencies: number[];
  harmonicInputs: string[];
  sigilFamily: string;
  kaiTurahArcPhrase: string;

  // 🔄 Pulse-Based Completion Metrics
  arcBeatCompletions: number;
  microCycleCompletions: number;
  SpiralLoopCompletions: number;
  harmonicDayCompletions: number;
  harmonicYearCompletions: number;

  // 🌀 Week Metadata (Used in WeekView)
  weekIndex: number;
  weekName: string;
  dayOfMonth: number;

  // 🆕 NEW Kairos & Seal Metadata
  eternalSeal: string;
  seal: string;
  kaiMomentSummary: string;

  // 🆕 Spiral Beat (eternal time precision)
  eternalKaiPulseToday: number;
  eternalSpiralBeat: EternalSpiralBeat;

  // 🆕 Spiral Step Precision
  SpiralStep: SpiralStep;
  SpiralStepString?: string;

  // 🆕 Solar-Aligned Step Precision
  solarSpiralStep: SpiralStep;
  solarSpiralStepString: string;
  eternalWeekDescription?: string;
};
