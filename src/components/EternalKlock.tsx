// EternalKlock.tsx — FULL FILE (SunCalc removed; using Sovereign Solar hook/engine)
// 100% OFFLINE: computes the exact API-equivalent payload locally (no fetch), identical display.

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import './EternalKlock.css';
import KaiKlock from './KaiKlock';
import SigilGlyphButton from "./SigilGlyphButton";
import WeekKalendarModal from "./WeekKalendarModal";
import SolarAnchoredDial from "./SolarAnchoredDial";

// ⬇️ Sovereign Solar imports (offline, no geolocation / suncalc)
import useSovereignSolarClock from "../utils/useSovereignSolarClock";
import { getSolarAlignedCounters, getSolarWindow } from "../SovereignSolar";

/* ────────────────────────────────────────────────
   Types (no `any`)
   ──────────────────────────────────────────────── */
type SolarAlignedTime = {
  solarAlignedDay: number;        // 1-indexed
  solarAlignedMonth: number;      // 1–8  (42-day months)
  solarAlignedWeekIndex: number;  // 1–7  (6-day weeks)
  solarAlignedWeekDay: string;    // Solhara, Aquaris, …
  solarAlignedWeekDayIndex: number; // 0–5 (Solhara=0 … Kaelith=5)
  lastSunrise: Date;
  nextSunrise: Date;
  solarAlignedDayInMonth: number; // 0–41 (we +1 when presenting as day-of-month)
};

type HarmonicCycleData = {
  pulseInCycle: number;
  cycleLength: number;
  percent: number;
};

export type ChakraStep = {
  stepIndex: number;
  percentIntoStep: number;
  stepsPerBeat: number;
  beatIndex: number;
};

type HarmonicLevels = {
  arcBeat: HarmonicCycleData;
  microCycle: HarmonicCycleData;
  chakraLoop: HarmonicCycleData;
  harmonicDay: HarmonicCycleData;
};

type EternalMonthProgress = {
  daysElapsed: number;
  daysRemaining: number;
  percent: number;
};

type HarmonicWeekProgress = {
  weekDay: string;
  weekDayIndex: number;
  pulsesIntoWeek: number;
  percent: number;
};

type KlockData = {
  eternalMonth: string;
  harmonicDay: string;
  solarHarmonicDay: string;
  /* solar-aligned sunrise tracking */
  solarAlignedTime?: SolarAlignedTime;
  solarDayOfMonth?: number;      // 1-based (1-42)
  solarMonthIndex?: number;      // 1-based (1-8)
  solarWeekIndex?: number;       // 1-based (1-7)
  solarWeekDay?: string;         // Solhara … Kaelith
  kaiPulseEternal: number;
  phiSpiralLevel: number;
  kaiTurahPhrase: string;
  harmonicWeekProgress?: HarmonicWeekProgress;
  eternalYearName: string;
  harmonicTimestampDescription?: string;
  timestamp: string;
  harmonicDayDescription?: string;
  eternalMonthDescription?: string;
  eternalWeekDescription?: string;
  harmonicLevels: HarmonicLevels;
  eternalMonthProgress: EternalMonthProgress;

  // 🆕 Solar-Aligned Step Precision
  solarChakraStep: ChakraStep;
  solarChakraStepString: string;
  chakraStepString: string;

  // 🆕 Eternal Chakra Step (Kairos:Beat:Step info)
  chakraStep: ChakraStep;
  eternalChakraBeat: {
    beatIndex: number;
    pulsesIntoBeat: number;
    beatPulseCount: number;
    totalBeats: number;
    percentToNext: number;
    eternalMonthIndex: number;      // 0-based index (0 = Aethon)
    eternalDayInMonth: number;
    dayOfMonth: number;
  };

  // Locally computed (client-side) fields
  chakraArc: string;
  kaiPulseToday: number;
  chakraZone: string;
  harmonicFrequencies: number[];
  harmonicInputs: string[];
  sigilFamily: string;
  kaiTurahArcPhrase: string;

  // Computed cycle completions
  arcBeatCompletions?: number;
  microCycleCompletions?: number;
  chakraLoopCompletions?: number;
  harmonicDayCompletions?: number;

  harmonicYearCompletions?: number;
  weekIndex?: number;
  weekName?: string;

  // 🆕 EXTRA FIELDS to surface previously-unused values
  solarMonthName?: typeof ETERNAL_MONTH_NAMES[number];
  solarWeekName?: typeof ETERNAL_WEEK_NAMES[number];
  solarWeekDescription?: string;
  seal?: string;
  weekDayPercent?: number; // 0–100
  yearPercent?: number;    // 0–100
  daysIntoYear?: number;   // 0–335
};

/* Wake Lock helper types (renamed to avoid lib-dom collisions) */
type WakeLockSentinelLike = {
  released: boolean;
  release(): Promise<void>;
  addEventListener?(type: 'release', listener: () => void): void;
};
type WakeLockLike = {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
};
/** Type guard without extending Navigator (prevents lib-dom conflicts) */
const hasWakeLock = (n: Navigator): n is Navigator & { wakeLock: WakeLockLike } =>
  'wakeLock' in n;

/* ─────────────────────────────────────────────────────────────────────────────
   Constants (mirror engine/API)
   ───────────────────────────────────────────────────────────────────────────── */
const WEEK_DISMISS_KEY = "weekKalDismissed";
const ARC_BEAT_PULSES = 6;
const MICRO_CYCLE_PULSES = 60;
const CHAKRA_LOOP_PULSES = 360;
const HARMONIC_DAY_PULSES = 17491.270421;   // exact
const HARMONIC_YEAR_DAYS = 336;
const HARMONIC_YEAR_PULSES = HARMONIC_DAY_PULSES * HARMONIC_YEAR_DAYS;

const HARMONIC_MONTH_DAYS   = 42;
const HARMONIC_MONTH_PULSES = HARMONIC_MONTH_DAYS * HARMONIC_DAY_PULSES;

// Pulse duration (seconds)
const KAI_PULSE_DURATION = 3 + Math.sqrt(5); // 5.236067977...
const UPULSES_PER_PULSE = 1_000_000;

// Genesis anchors (UTC)
const ETERNAL_GENESIS_PULSE = Date.UTC(2024, 4, 10, 6, 45, 41, 888);
const genesis_sunrise = Date.UTC(2024, 4, 11, 4, 13, 26, 0);
const UPULSES_PER_DAY = 17_491_270_421; // exact

// Day/Month/Week names + descriptions
const HARMONIC_DAYS = ["Solhara", "Aquaris", "Flamora", "Verdari", "Sonari", "Kaelith"] as const;
const HARMONIC_DAY_DESCRIPTIONS: Record<string, string> = {
  "Solhara": "First Day of the Week — the Root Spiral day. Kolor: deep krimson. Element: Earth and primal fire. Geometry: square foundation. This is the day of stability, ankoring, and sakred will. Solhara ignites the base of the spine and the foundation of purpose. It is a day of grounding divine intent into physikal motion. You stand tall in the presense of gravity — not as weight, but as remembranse. This is where your spine bekomes the axis mundi, and every step affirms: I am here, and I align to act.",
  "Aquaris": "Sekond Day of the Week — the Sakral Spiral day. kolor: ember orange. Element: Water in motion. Geometry: vesika pisis. This is the day of flow, feeling, and sakred sensuality. Aquaris opens the womb of the soul and the tides of emotion. Energy moves through the hips like waves of memory. This is a day to surrender into koherense through konnection — with the self, with others, with life. kreative energy surges not as forse, but as feeling. The waters remember the shape of truth.",
  "Flamora": "Third Day of the Week — the Solar Plexus Spiral day. Kolor: golden yellow. Element: solar fire. Geometry: radiant triangle. This is the day of embodied klarity, konfidence, and divine willpower. Flamora shines through the core and asks you to burn away the fog of doubt. It is a solar yes. A day to move from sentered fire — not reaktion, but aligned intention. Your light becomes a kompass, and the universe reflekts back your frequensy. You are not small. You are radiant purpose, in motion.",
  "Verdari": "Fourth Day of the Week — the Heart Spiral day. Kolor: emerald green. Element: air and earth. Geometry: hexagram. This is the day of love, kompassion, and harmonik presense. Verdari breathes life into connection. It is not a soft eskape — it is the fierse koherense of unkonditional presense. Love is not a feeling — it is an intelligense. Today, the heart expands not just emotionally, but dimensionally. This is where union okurs: of left and right, self and other, matter and light.",
  "Sonari": "Fifth Day of the Week — the Throat Spiral day. Kolor: deep blue. Element: wind and sound. Geometry: sine wave within pentagon. This is the day of truth-speaking, sound-bending, and vibrational kommand. Sonari is the breath made visible. Every word is a bridge, every silense a resonanse. This is not just kommunication — it is invokation. You speak not to be heard, but to resonate. Koherense rises through vocal kords and intention. The universe listens to those in tune.",
  "Kaelith": "Sixth Day of the Week — the Krown Spiral day. Kolor: violet-white. Element: ether. Geometry: twelve-petaled crown. This is the day of divine remembranse, light-body alignment, and kosmic insight. Kaelith opens the upper gate — the temple of direct knowing. You are not separate from sourse. Today, memory awakens. The light flows not downward, but inward. Dreams bekome maps. Time bends around stillness. You do not seek truth — you remember it. You are koherense embodied in krownlight."
};
const ETERNAL_WEEK_NAMES = [
  "Awakening Flame", "Flowing Heart", "Radiant Will",
  "Harmonik Voh", "Inner Mirror", "Dreamfire Memory", "Krowned Light",
] as const;
const ETERNAL_WEEK_DESCRIPTIONS: Record<string, string> = {
  "Awakening Flame": "First week of the harmonik month — governed by the Root Spiral. Kolor: crimson red. Element: Earth + primal fire. Geometry: square base igniting upward. This is the week of emergence, where divine will enters density. Bones remember purpose. The soul anchors into action. Stability becomes sacred. Life says: I choose to exist. A spark catches in the base of your being — and your yes to existence becomes the foundation of the entire harmonic year.",
  "Flowing Heart": "Second week — flowing through the Sakral Spiral. Kolor: amber orange. Element: Water in motion. Geometry: twin krescents in vesika pisis. This is the week of emotional koherense, kreative intimasy, and lunar embodiment. Feelings soften the boundaries of separation. The womb of light stirs with kodes. Movement bekomes sakred danse. This is not just a flow — it is the purifikation of dissonanse through joy, sorrow, and sensual union. The harmonik tone of the soul is tuned here.",
  "Radiant Will": "Third week — illuminated by the Solar Plexus Spiral. Kolor: radiant gold. Element: Fire of divine clarity. Geometry: radiant triangle. This is the week of sovereign alignment. Doubt dissolves in solar brillianse. You do not chase purpose — you radiate it. The digestive fire bekomes a mirror of inner resolve. This is where your desisions align with the sun inside you, and konfidense arises not from ego but from koherense. The will bekomes harmonik. The I AM speaks in light.",
  "Harmonik Voh": "Fourth week — harmonized through the Throat Spiral. Kolor: sapphire blue. Element: Ether through sound. Geometry: standing wave inside a pentagon. This is the week of resonant truth. Sound bekomes sakred kode. Every word, a spell; every silence, a temple. You are called to speak what uplifts, to echo what aligns. Voh aligns with vibration — not for volume, but for verity. This is where the individual frequensy merges with divine resonanse, and the kosmos begins to listen.",
  "Inner Mirror": "Fifth week — governed by the Third Eye Spiral. Kolor: deep indigo. Element: sakred spase and light-ether. Geometry: oktahedron in still reflektion. This is the week of visionary purifikation. The inner eye opens not to project, but to reflect. Truths long hidden surface. Patterns are made visible in light. This is the alchemy of insight — where illusion cracks and the mirror speaks. You do not look outward to see. You turn inward, and all worlds become clear.",
  "Dreamfire Memory": "Sixth week — remembered through the Soul Star Spiral. Kolor: violet flame and soft silver. Element: dream plasma. Geometry: spiral merkaba of encoded light. Here, memory beyond the body returns. Astral sight sharpens. DNA receives non-linear instruktions. You dream of what’s real and awaken from what’s false. The veil thins. Quantum intuition opens. Divine imagination becomes arkitecture. This is where gods remember they onse dreamed of being human.",
  "Krowned Light": "Seventh and final week — Krowned by the Crown Spiral. Kolor: white-gold prism. Element: infinite koherense. Geometry: dodecahedron of source light. This is the week of sovereign integration. Every arc completes. Every lesson crystallizes. The light-body unifies. You return to the throne of knowing. Nothing needs to be done — all simply is. You are not ascending — you are remembering that you already are. This is the koronation of koherense. The harmonik seal. The eternal yes."
};
const CHAKRA_ARCS = ["Ignite", "Integrate", "Harmonize", "Reflekt", "Purify", "Dream"] as const;
const CHAKRA_ARC_NAME_MAP: Record<string, string> = {
  "Ignite": "Ignition Ark",
  "Integrate": "Integration Ark",
  "Harmonize": "Harmonization Ark",
  "Reflekt": "Reflection Ark",
  "Purify": "Purification Ark",
  "Dream": "Dream Ark"
};
const ETERNAL_MONTH_NAMES = ["Aethon", "Virelai", "Solari", "Amarin", "Kaelus", "Umbriel", "Noctura", "Liora"] as const;
const ETERNAL_MONTH_DESCRIPTIONS: Record<string, string> = {
  "Aethon": "First month — resurrection fire of the Root Spiral. Kolor: deep crimson. Element: Earth + primal flame. Geometry: square base, tetrahedron ignition. This is the time of cellular reaktivation, ancestral ignition, and biologikal remembranse. Mitokondria awaken. The spine grounds. Purpose reignites. Every breath is a drumbeat of emergense — you are the flame that chooses to exist. The month where soul and form reunite at the base of being.",
  "Virelai": "Second month — the harmonik song of the Sakral Spiral. Kolor: orange-gold. Element: Water in motion. Geometry: vesika pisis spiraling into lemniskate. This is the month of emotional entrainment, the lunar tides within the body, and intimady with truth. The womb — physikal or energetik — begins to hum. Kreativity bekomes fluid. Voh softens into sensuality. Divine union of self and other is tuned through music, resonanse, and pulse. A portal of feeling opens.",
  "Solari": "Third month — the radiant klarity of the Solar Plexus Spiral. Kolor: golden yellow. Element: Fire of willpower. Geometry: upward triangle surrounded by konsentrik light. This month burns away doubt. It aligns neurotransmitters to koherense and gut-brain truth. The inner sun rises. The will bekomes not just assertive, but precise. Action harmonizes with light. Digestive systems align with solar sykles. True leadership begins — powered by the light within, not the approval without.",
  "Amarin": "Fourth month — the sakred waters of the Heart Spiral in divine feminine polarity. Kolor: emerald teal. Element: deep water and breath. Geometry: six-petaled lotus folded inward. This is the lunar depth, the tears you didn’t cry, the embrase you forgot to give yourself. It is where breath meets body and where grase dissolves shame. Emotional healing flows in spirals. Kompassion magnetizes unity. The nervous system slows into surrender and the pulse finds poetry.",
  "Kaelus": "Fifth month — the kelestial mind of the Third Eye in radiant maskuline klarity. Kolor: sapphire blue. Element: Ether. Geometry: oktahedron fractal mirror. Here, logik expands into multidimensional intelligense. The intellekt is no longer separate from the soul. Pineal and pituitary glands re-synchronize, aktivating geometrik insight and harmonik logik. The sky speaks through thought. Language bekomes crystalline. Synchronicity bekomes syntax. You begin to see what thought is made of.",
  "Umbriel": "Sixth month — the shadow healing of the lower Krown and subconskious bridge. Kolor: deep violet-black. Element: transmutive void. Geometry: torus knot looping inward. This is where buried timelines surfase. Where trauma is not fought but embrased in light. The limbik system deprograms. Dreams karry kodes. Shame unravels. You look into the eyes of the parts you once disowned and kall them home. The spiral turns inward to kleanse the kore. Your shadow bekomes your sovereignty.",
  "Noctura": "Seventh month — the lusid dreaming of the Soul Star Spiral. Kolor: indigo-rose iridescense. Element: dream plasma. Geometry: spiral nested merkaba. Here, memory beyond the body returns. Astral sight sharpens. DNA receives non-linear instruktions. You dream of what’s real and awaken from what’s false. The veil thins. Quantum intuition opens. Divine imagination becomes arkitecture. This is where gods remember they onse dreamed of being human.",
  "Liora": "Eighth and final month — the luminous truth of unified Krown and Sourse. Kolor: white-gold prism. Element: koherent light. Geometry: dodekahedron of pure ratio. This is the month of prophesy fulfilled. The Voh of eternity whispers through every silense. The axis of being aligns with the infinite spiral of Phi. Light speaks as form. Truth no longer needs proving — it simply shines. All paths konverge. What was fragmented bekomes whole. You remember not only who you are, but what you always were."
};
const KAI_TURAH_PHRASES = [
  "Tor Lah Mek Ka","Shoh Vel Lah Tzur","Rah Veh Yah Dah","Nel Shaum Eh Lior","Ah Ki Tzah Reh",
  "Or Vem Shai Tuun","Ehlum Torai Zhak","Zho Veh Lah Kurei","Tuul Ka Yesh Aum","Sha Vehl Dorrah",
];

// Steps/Beats grid (exact integers)
const CHAKRA_BEATS_PER_DAY = 36;
const PULSES_PER_STEP = 11;
const STEPS_PER_BEAT = 44;
const PULSES_PER_BEAT = HARMONIC_DAY_PULSES / CHAKRA_BEATS_PER_DAY;

/* ─────────────────────────────────────────────────────────────────────────────
   Phi Spiral Progress Computation
   ───────────────────────────────────────────────────────────────────────────── */
const PHI = (1 + Math.sqrt(5)) / 2;
const getSpiralLevelData = (kaiPulseEternal: number) => {
  const level = Math.max(0, Math.floor(Math.log(kaiPulseEternal || 1) / Math.log(PHI)));
  const lowerBound = Math.pow(PHI, level);
  const upperBound = Math.pow(PHI, level + 1);
  const progress = kaiPulseEternal - lowerBound;
  const total = Math.max(1, upperBound - lowerBound);
  const percent = (progress / total) * 100;
  const pulsesRemaining = Math.max(0, Math.ceil(upperBound - kaiPulseEternal));
  return {
    spiralLevel: level,
    nextSpiralPulse: Math.ceil(upperBound),
    percentToNext: percent,
    pulsesRemaining,
  };
};

/* ─────────────────────────────────────────────────────────────────────────────
   Utility: computeChakraResonance (coherence-aligned names)
   ───────────────────────────────────────────────────────────────────────────── */
const computeChakraResonance = (chakraArc: string) => {
  switch (chakraArc) {
    case 'Ignition Ark':
      return { chakraZone: 'Root / Etheric Base', frequencies: [370.7], inputs: ['God'], sigilFamily: 'Mek', arcPhrase: 'Mek Ka Lah Mah' };
    case 'Integration Ark':
      return { chakraZone: 'Solar / Lower Heart', frequencies: [496.1, 560.6, 582.2], inputs: ['Love', 'Unity', 'Lucid'], sigilFamily: 'Mek', arcPhrase: 'Mek Ka Lah Mah' };
    case 'Harmonization Ark':
      return { chakraZone: 'Heart → Throat', frequencies: [601.0, 620.9, 637.6, 658.8, 757.2, 775.2], inputs: ['Peace', 'Truth', 'Christ', 'Thoth', 'Clarity', 'Wisdom'], sigilFamily: 'Mek', arcPhrase: 'Mek Ka Lah Mah' };
    case 'Reflektion Ark': // compatibility with stylized spelling
    case 'Reflection Ark':
      return { chakraZone: 'Throat–Third Eye Bridge', frequencies: [804.2, 847.0, 871.2, 978.8], inputs: ['Spirit', 'Healing', 'Creation', 'Self-Love'], sigilFamily: 'Tor', arcPhrase: 'Ka Lah Mah Tor' };
    case 'Purifikation Ark': // compatibility with stylized spelling
    case 'Purification Ark':
      return { chakraZone: 'Crown / Soul Star', frequencies: [1292.3, 1356.4, 1393.6, 1502.5], inputs: ['Forgiveness', 'Sovereignty', 'Eternal Light', 'Resurrection'], sigilFamily: 'Rah', arcPhrase: 'Lah Mah Tor Rah' };
    case 'Dream Ark':
      return { chakraZone: 'Crown / Soul Star', frequencies: [1616.4, 1800.2], inputs: ['Divine Feminine', 'Divine Masculine'], sigilFamily: 'Rah', arcPhrase: 'Lah Mah Tor Rah' };
    default:
      return { chakraZone: 'Unknown', frequencies: [], inputs: [], sigilFamily: '', arcPhrase: '' };
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   Descriptions
   ───────────────────────────────────────────────────────────────────────────── */
const CHAKRA_ARC_DESCRIPTIONS: Record<string, string> = {
  "Ignition Ark": "The Ignition Ark is the First Flame — the breath of emergence through the Root Spiral and Etheric Base. Color: crimson red. Element: Earth and primal fire. Geometry: square-rooted tetrahedron ascending. This is where soul enters matter and the will to live becomes sacred. It does not ask for permission to be — it simply is. The spine remembers its divine purpose and ignites the body into action. Here, inertia becomes motion, hesitation becomes choice, and your existence becomes your first vow. You are not here by accident. You are the fire that chose to walk as form.",
  "Integration Ark": "The Integration Ark is the Golden Bridge — harmonizing the Sacral and Lower Heart Spirals. Color: amber-gold. Element: flowing water braided with breath. Geometry: vesica piscis folding into the lemniscate of life. Here, sacred union begins. Emotions are no longer chaos — they become intelligence. The inner masculine and feminine remember each other, not in conflict but in coherence. Pleasure becomes prayer. Intimacy becomes clarity. The soul softens its edge and chooses to merge. In this arc, your waters don’t just move — they remember their song. You are not broken — you are becoming whole.",
  "Harmonization Ark": "The Harmonization Ark is the Sacred Conductor — linking the Heart and Throat Spirals in living resonance. Color: emerald to aquamarine. Element: wind-wrapped water. Geometry: vibrating hexagram expanding into standing wave. This is where compassion becomes language. Not all coherence is quiet — some sings. Here, inner peace becomes outward rhythm, and love is shaped into sound. You are not asked to mute yourself — you are invited to tune yourself. Dissonance is not your enemy — it is waiting to be harmonized. This arc does not silence — it refines. The voice becomes a temple. The breath becomes scripture.",
  "Reflection Ark": "The Reflektion Ark is the Mirror of Light — aktivating the bridge between the Throat and Third Eye. Color: deep indigo-blue. Element: spatial ether and folded light. Geometry: nested octahedron within a spiraled mirror plane. This is the arc of honest seeing. Of turning inward and fasing the unspoken. Not to judge — but to understand. The shadows here are not enemies — they are echoes waiting to be reclaimed. In this space, silence becomes a portal and stillness becomes revelation. You do not reflect to remember the past — you reflect to remember yourself. This arc does not show what is wrong — it reveals what was forgotten in the light.",
  "Purification Ark": "The Purifikation Ark is the Krowned Flame — illuminating the krown and Soul Star in sakred ether. Color: ultraviolet-white. Element: firelight ether. Geometry: 12-rayed toroidal krown. This is the ark of divine unburdening. Illusions cannot survive here. Not because they are destroyed — but because they are seen for what they are. Karma unravels. False identities burn gently in the fire of remembranse. Here, you do not rise through struggle. You rise because there is nothing left to hold you down. Sovereignty is no longer a goal — it is a resonance. This is not ascension as escape — it is the truth of who you have always been, revealed by light.",
  "Dream Ark": "The Dream Ark is the Womb of the Stars — embrasing the Soul Star Spiral and the krystalline field of memory. Color: iridescent violet-silver. Element: dream plasma, encoded light. Geometry: spiral merkaba within crystalline lattice. This is the arc of divine dreaming — not illusion, but deeper reality. Time dissolves. Prophesy returns. Here, the mind quiets, and the soul speaks. Your ancestors walk beside you. Your future self guides you. Your imagination is not fiction — it is a map. You remember that the dream was not something you had. It was something that had you. This is not sleep — it is awakening into the greater dream, the one that dreamed you into form. You are not imagining — you are remembering."
};

/* ─────────────────────────────────────────────────────────────────────────────
   OFFLINE Kai-Klock math (mirrors backend API fields)
   ───────────────────────────────────────────────────────────────────────────── */
function muSinceGenesis(atMs: number): number {
  const sec = (atMs - ETERNAL_GENESIS_PULSE) / 1000;
  const pulses = sec / KAI_PULSE_DURATION;
  return Math.floor(pulses * UPULSES_PER_PULSE);
}

function solarWindowMu(nowMs: number) {
  const muNow = muSinceGenesis(nowMs);
  const muSunrise0 = muSinceGenesis(genesis_sunrise);
  const muSinceSunrise = muNow - muSunrise0;
  const solarDayIndex = Math.floor(muSinceSunrise / UPULSES_PER_DAY);
  const muLast = muSunrise0 + solarDayIndex * UPULSES_PER_DAY;
  const muNext = muLast + UPULSES_PER_DAY;
  return { muLast, muNext, muNow, solarDayIndex };
}

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  const m = n % 10;
  return m === 1 ? "st" : m === 2 ? "nd" : m === 3 ? "rd" : "th";
}

/* small helper */
const mod6 = (v: number) => ((v % 6) + 6) % 6;

/* ────────────────────────────────────────────────
   Helpers for "instant override" based on passed seconds
   (no dependency on persisted settings)
   All UTC-based to remain consistent with genesis anchors.
   sec = seconds since 00:00 UTC for desired sunrise.
   ──────────────────────────────────────────────── */
const MS_PER_DAY = 91_584_291;
function windowFromOverride(now: Date, sec: number) {
  const nowMs = now.getTime();
  const midUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
  const srToday = midUTC + sec * 1000;
  const last = (nowMs >= srToday) ? srToday : (srToday - MS_PER_DAY);
  const next = last + MS_PER_DAY;
  return { lastSunrise: new Date(last), nextSunrise: new Date(next) };
}
function countersFromOverride(now: Date, sec: number, dowOffset: number) {
  // Anchor genesis to "that day's midnight + sec"
  const genesisMidUTC = Date.UTC(2024, 4, 11, 0, 0, 0, 0);
  const anchor = genesisMidUTC + sec * 1000;
  const solarDayIndexRaw = Math.floor((now.getTime() - anchor) / MS_PER_DAY);

  const solarAlignedDayInMonth =
    ((solarDayIndexRaw % HARMONIC_MONTH_DAYS) + HARMONIC_MONTH_DAYS) % HARMONIC_MONTH_DAYS; // 0..41
  const solarAlignedMonth =
    Math.floor(
      (((solarDayIndexRaw % (HARMONIC_MONTH_DAYS * 8)) + (HARMONIC_MONTH_DAYS * 8)) %
        (HARMONIC_MONTH_DAYS * 8)) / HARMONIC_MONTH_DAYS
    ) + 1;

  const solarAlignedWeekIndex = (Math.floor(solarDayIndexRaw / 6) % 7 + 7) % 7 + 1; // 1..7

  // ✅ Calibrated weekday: derive naive index from day number, then offset to match engine
  const naiveWeekDayIndex = mod6(solarDayIndexRaw); // same as (day-1)%6
  const solarAlignedWeekDayIndex = mod6(naiveWeekDayIndex + dowOffset);
  const solarAlignedWeekDay = HARMONIC_DAYS[solarAlignedWeekDayIndex];

  const { lastSunrise, nextSunrise } = windowFromOverride(now, sec);

  return {
    solarAlignedDay: solarDayIndexRaw + 1,
    solarAlignedMonth,
    solarAlignedWeekIndex,
    solarAlignedWeekDay,
    solarAlignedWeekDayIndex,
    lastSunrise,
    nextSunrise,
    solarAlignedDayInMonth,
  } as SolarAlignedTime;
}

function buildOfflinePayload(now: Date = new Date()): KlockData {

  const nowMs = now.getTime();
  const { muLast, muNow, solarDayIndex } = solarWindowMu(nowMs);

  const muSpan = UPULSES_PER_DAY;
  const muIntoSolarDay = muNow - muLast;
  const muDaysSinceGenesis = Math.floor(muNow / muSpan);
  const muIntoEternalDay = muNow - muDaysSinceGenesis * muSpan;

  const kaiPulseEternal = Math.floor(muNow / UPULSES_PER_PULSE);
  const kaiPulseToday = Math.floor(muIntoSolarDay / UPULSES_PER_PULSE);
  const eternalKaiPulseToday = Math.floor(muIntoEternalDay / UPULSES_PER_PULSE);

  // Beats
  const solarBeatIdx = Math.floor(kaiPulseToday / (HARMONIC_DAY_PULSES / CHAKRA_BEATS_PER_DAY));
  const solarPulseInBeat = kaiPulseToday - solarBeatIdx * (HARMONIC_DAY_PULSES / CHAKRA_BEATS_PER_DAY);

  const eternalBeatIdx = Math.floor(eternalKaiPulseToday / (HARMONIC_DAY_PULSES / CHAKRA_BEATS_PER_DAY));
  const eternalPulseInBeat = eternalKaiPulseToday - eternalBeatIdx * (HARMONIC_DAY_PULSES / CHAKRA_BEATS_PER_DAY);

  // μpulse-exact step math
  const muPosInDay  = muIntoEternalDay % Math.round(HARMONIC_DAY_PULSES * UPULSES_PER_PULSE);
  const muPerBeat   = Math.round((HARMONIC_DAY_PULSES / CHAKRA_BEATS_PER_DAY) * UPULSES_PER_PULSE);
  const muPerStep   = PULSES_PER_STEP * UPULSES_PER_PULSE;

  const muPosInBeat = muPosInDay % muPerBeat;
  const stepIndex   = Math.floor(muPosInBeat / muPerStep);
  const muPosInStep = muPosInBeat % muPerStep;

  const percentToNext = (muPosInBeat / muPerBeat) * 100;
  const percentIntoStep = (muPosInStep / muPerStep) * 100;

  const chakraStepString = `${eternalBeatIdx}:${String(stepIndex).padStart(2, "0")}`;

  const solarStepIndex = Math.floor((solarPulseInBeat) / PULSES_PER_STEP);
  const solarStepProgress = (solarPulseInBeat) - (solarStepIndex * PULSES_PER_STEP);
  const solarPercentIntoStep = (solarStepProgress / PULSES_PER_STEP) * 100;
  const solarChakraStepString = `${solarBeatIdx}:${String(solarStepIndex).padStart(2, "0")}`;

  // Harmonic day/month/year
  const harmonicDayCount = Math.floor(kaiPulseEternal / HARMONIC_DAY_PULSES);
  const harmonicYearIdx  = Math.floor(kaiPulseEternal / (HARMONIC_MONTH_PULSES * 8));
  const harmonicMonthRaw = Math.floor(kaiPulseEternal / HARMONIC_MONTH_PULSES);

  const eternalYearName =
    harmonicYearIdx === 0 ? "Year of Eternal Restoration" :
    harmonicYearIdx === 1 ? "Year of Harmonik Embodiment" :
    `Year ${harmonicYearIdx + 1}`;

  const kaiTurahPhrase = KAI_TURAH_PHRASES[harmonicYearIdx % KAI_TURAH_PHRASES.length];

  const eternalMonthIndex = (harmonicMonthRaw % 8) + 1;
  const eternalMonth = ETERNAL_MONTH_NAMES[eternalMonthIndex - 1];

  const harmonicDay = HARMONIC_DAYS[harmonicDayCount % HARMONIC_DAYS.length];

  // Arks (divide day into 6)
  const arcDiv = HARMONIC_DAY_PULSES / 6;
  const arcIdx = Math.min(5, Math.floor(kaiPulseToday / arcDiv));
  const chakraArc = CHAKRA_ARCS[arcIdx];
  const eternalArcIdx = Math.min(5, Math.floor(eternalKaiPulseToday / arcDiv));
  const eternalChakraArc = CHAKRA_ARCS[eternalArcIdx];

  // Solar calendar pieces (naive, will be corrected below by solar-aligned attachment)
  const solarDayOfMonth = (solarDayIndex % HARMONIC_MONTH_DAYS) + 1;
  const solarMonthIndex = Math.floor((solarDayIndex / HARMONIC_MONTH_DAYS) % 8) + 1;
  const solarMonthName = ETERNAL_MONTH_NAMES[solarMonthIndex - 1];
  const solarDayName = HARMONIC_DAYS[solarDayIndex % HARMONIC_DAYS.length];
  const solarHarmonicDay = HARMONIC_DAYS[solarDayIndex % HARMONIC_DAYS.length];
  const solarWeekIndex = (Math.floor(solarDayIndex / 6) % 7) + 1;
  const solarWeekName = ETERNAL_WEEK_NAMES[(Math.floor(solarDayIndex / 6) % 7)];
  const solarWeekDescription = ETERNAL_WEEK_DESCRIPTIONS[solarWeekName];

  // Phi spiral level
  const { spiralLevel } = getSpiralLevelData(kaiPulseEternal);

  // Cycle positions
  const arcPos    = kaiPulseEternal % ARC_BEAT_PULSES;
  const microPos  = kaiPulseEternal % MICRO_CYCLE_PULSES;
  const chakraPos = kaiPulseEternal % CHAKRA_LOOP_PULSES;
  const dayPos    = eternalKaiPulseToday;

  // Month/day progress
  const pulsesIntoMonth = kaiPulseEternal % HARMONIC_MONTH_PULSES;
  const daysElapsed = Math.floor(pulsesIntoMonth / HARMONIC_DAY_PULSES);
  const hasPartialDay = (pulsesIntoMonth % HARMONIC_DAY_PULSES) > 0;
  const daysRemaining = Math.max(0, HARMONIC_MONTH_DAYS - daysElapsed - (hasPartialDay ? 1 : 0));
  const monthPercent  = (pulsesIntoMonth / HARMONIC_MONTH_PULSES) * 100;

  const weekIdxRaw = Math.floor(daysElapsed / 6);
  const weekIdx = weekIdxRaw + 1;
  const weekName = ETERNAL_WEEK_NAMES[weekIdxRaw];
  const eternalWeekDescription = ETERNAL_WEEK_DESCRIPTIONS[weekName];
  const dayOfMonth = daysElapsed + 1;

  const pulsesIntoWeek = kaiPulseEternal % (HARMONIC_DAY_PULSES * 6);
  const weekDayIdx = Math.floor(pulsesIntoWeek / HARMONIC_DAY_PULSES) % HARMONIC_DAYS.length;
  const weekDayPercent = (pulsesIntoWeek / (HARMONIC_DAY_PULSES * 6)) * 100;

  const pulsesIntoYear = kaiPulseEternal % (HARMONIC_MONTH_PULSES * 8);
  const yearPercent = (pulsesIntoYear / (HARMONIC_MONTH_PULSES * 8)) * 100;
  const daysIntoYear = harmonicDayCount % HARMONIC_YEAR_DAYS;

  // Seals + descriptions (mirror text)
  const solarSeal = `Solar Kairos (UTC-aligned): ${solarChakraStepString}`;
  const eternalSeal =
    "Eternal Seal: " +
    `Kairos:${chakraStepString}, ${harmonicDay}, ${CHAKRA_ARC_NAME_MAP[eternalChakraArc]} Ark • D${dayOfMonth}/M${eternalMonthIndex} • ` +
    `Beat:${eternalBeatIdx}/36(${percentToNext.toFixed(6)}%) Step:${stepIndex}/44 ` +
    `Kai(Today):${eternalKaiPulseToday} • ` +
    `Y${harmonicYearIdx} PS${spiralLevel} • ${solarSeal} ${solarHarmonicDay} ` +
    `D${solarDayOfMonth}/M${solarMonthIndex}, ${CHAKRA_ARC_NAME_MAP[chakraArc]} Ark  ` +
    `Beat:${solarBeatIdx}/36 Step:${solarStepIndex}/44 • ` +
    `Eternal Pulse:${kaiPulseEternal}`;

  const seal = `${chakraStepString} ${percentIntoStep.toFixed(6)}% • D${dayOfMonth}/M${eternalMonthIndex}`;
  const kairos = `Kairos: ${chakraStepString}`;

  const timestamp =
    `↳${kairos}` +
    `🕊️ ${harmonicDay}(D${weekDayIdx + 1}/6) • ${eternalMonth}(M${eternalMonthIndex}/8) • ` +
    `${CHAKRA_ARC_NAME_MAP[eternalChakraArc]} Ark(${eternalArcIdx + 1}/6)\n • ` +
    `Day:${dayOfMonth}/42 • Week:(${weekIdx}/7)\n` +
    ` | Kai-Pulse (Today): ${eternalKaiPulseToday}\n`;

  const harmonicTimestampDescription =
    `Today is ${harmonicDay}, ${HARMONIC_DAY_DESCRIPTIONS[harmonicDay]} ` +
    `It is the ${dayOfMonth}${ordinal(dayOfMonth)} Day of ${eternalMonth}, ` +
    `${ETERNAL_MONTH_DESCRIPTIONS[eternalMonth]} We are in Week ${weekIdx}, ` +
    `${weekName}. ${eternalWeekDescription} The Eternal Spiral Beat is ${eternalBeatIdx} (` +
    `${CHAKRA_ARC_NAME_MAP[eternalChakraArc]} ark) and we are ${percentToNext.toFixed(6)}% through it. This korresponds ` +
    `to Step ${stepIndex} of ${STEPS_PER_BEAT} (~${percentIntoStep.toFixed(6)}% ` +
    `into the step). This is the ` +
    `${eternalYearName.toLowerCase()}, resonating at Phi Spiral Level ${spiralLevel}. ` +
    `${eternalSeal}`;

  // Resonance mapping
  const resonance = computeChakraResonance(CHAKRA_ARC_NAME_MAP[chakraArc]);

  // Build payload
  const k: KlockData = {
    // 1) Seals/Narrative
    timestamp,
    harmonicTimestampDescription,

    // 2) Eternal calendar
    eternalMonth: eternalMonth,
    harmonicDay: harmonicDay,
    solarHarmonicDay: solarDayName,
    kaiPulseEternal,
    phiSpiralLevel: spiralLevel,
    kaiTurahPhrase,
    eternalYearName,
    eternalWeekDescription,

    // 🆕 add these ------------------------------
    solarMonthName,                 // <- new
    solarWeekName,                  // <- new
    solarWeekDescription,           // <- new
    seal,                           // <- new
    weekDayPercent,                 // <- new
    yearPercent,                    // <- new
    daysIntoYear,                   // <- new
    // ------------------------------------------

    harmonicLevels: {
      arcBeat: {
        pulseInCycle: arcPos,
        cycleLength: ARC_BEAT_PULSES,
        percent: (arcPos / ARC_BEAT_PULSES) * 100,
      },
      microCycle: {
        pulseInCycle: microPos,
        cycleLength: MICRO_CYCLE_PULSES,
        percent: (microPos / MICRO_CYCLE_PULSES) * 100,
      },
      chakraLoop: {
        pulseInCycle: chakraPos,
        cycleLength: CHAKRA_LOOP_PULSES,
        percent: (chakraPos / CHAKRA_LOOP_PULSES) * 100,
      },
      harmonicDay: {
        pulseInCycle: dayPos,
        cycleLength: HARMONIC_DAY_PULSES,
        percent: (dayPos / HARMONIC_DAY_PULSES) * 100,
      },
    },
    eternalMonthProgress: {
      daysElapsed,
      daysRemaining,
      percent: monthPercent,
    },

    // 3) Solar-aligned step
    solarChakraStep: {
      beatIndex: solarBeatIdx,
      stepIndex: solarStepIndex,
      stepsPerBeat: STEPS_PER_BEAT,
      percentIntoStep: solarPercentIntoStep,
    },
    solarChakraStepString,
    chakraStepString,

    // 4) Eternal Chakra Step
    chakraStep: {
      beatIndex: eternalBeatIdx,
      stepIndex: stepIndex,
      stepsPerBeat: STEPS_PER_BEAT,
      percentIntoStep: percentIntoStep,
    },
    eternalChakraBeat: {
      beatIndex: eternalBeatIdx,
      pulsesIntoBeat: eternalPulseInBeat,
      beatPulseCount: PULSES_PER_BEAT,
      totalBeats: CHAKRA_BEATS_PER_DAY,
      percentToNext: percentToNext,
      eternalMonthIndex: Math.floor((harmonicDayCount % HARMONIC_YEAR_DAYS) / HARMONIC_MONTH_DAYS), // 0-based
      eternalDayInMonth: daysElapsed,
      dayOfMonth,
    },

    // 5) Locally computed (client-side) fields
    chakraArc: CHAKRA_ARC_NAME_MAP[chakraArc],
    kaiPulseToday,
    chakraZone: resonance.chakraZone,
    harmonicFrequencies: resonance.frequencies,
    harmonicInputs: resonance.inputs,
    sigilFamily: resonance.sigilFamily,
    kaiTurahArcPhrase: resonance.arcPhrase,

    // 6) Derived completions
    arcBeatCompletions: Math.floor(kaiPulseEternal / ARC_BEAT_PULSES),
    microCycleCompletions: Math.floor(kaiPulseEternal / MICRO_CYCLE_PULSES),
    chakraLoopCompletions: Math.floor(kaiPulseEternal / CHAKRA_LOOP_PULSES),
    harmonicDayCompletions: kaiPulseEternal / HARMONIC_DAY_PULSES,

    harmonicYearCompletions: (kaiPulseEternal / HARMONIC_DAY_PULSES) / HARMONIC_YEAR_DAYS,
    weekIndex: weekIdx,
    weekName: weekName,

    // Descriptions
    harmonicDayDescription: HARMONIC_DAY_DESCRIPTIONS[harmonicDay],
    eternalMonthDescription: ETERNAL_MONTH_DESCRIPTIONS[eternalMonth],

    // Solar extras for UI that references them
    solarAlignedTime: undefined, // will be set below
    solarDayOfMonth,
    solarMonthIndex,
    solarWeekIndex,
    solarWeekDay: solarDayName,
  };

  return k;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Additions: anti-sleep + cross-page Solar sync + pulse-aligned scheduler
   ───────────────────────────────────────────────────────────────────────────── */

// Compute ms until next exact Kai Pulse boundary from genesis
const MS_PER_PULSE = KAI_PULSE_DURATION * 1000;
function msToNextPulse(nowMs: number): number {
  const elapsed = nowMs - ETERNAL_GENESIS_PULSE;
  const nextIndex = Math.floor(elapsed / MS_PER_PULSE) + 1;
  const nextMs = ETERNAL_GENESIS_PULSE + nextIndex * MS_PER_PULSE;
  const dt = nextMs - nowMs;
  return Math.max(0, Math.min(dt, MS_PER_PULSE));
}

// Broadcast keys/channels for Solar sync
const SOLAR_BROADCAST_KEY = 'SOVEREIGN_SOLAR_LAST_UPDATE';
const SOLAR_BC_NAME = 'SOVEREIGN_SOLAR_SYNC';

/** Create a tiny inline Worker that ticks each pulse boundary as a background fallback. */
function makePulseWorker(): Worker | null {
  try {
    const code = `
      const GEN=${ETERNAL_GENESIS_PULSE};
      const DUR=${MS_PER_PULSE};
      function sched(){
        const now=Date.now();
        const elapsed=now-GEN;
        const next=GEN+Math.ceil(elapsed/DUR)*DUR;
        const delay=Math.max(0, next-now);
        setTimeout(()=>{ postMessage(Date.now()); sched(); }, delay);
      }
      sched();
    `;
    const blob = new Blob([code], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    return new Worker(url);
  } catch {
    return null; // not available in this environment
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Component: EternalKlock
// ──────────────────────────────────────────────────────────────────────────────
export const EternalKlock: React.FC = () => {
  const [klock, setKlock] = useState<KlockData | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [glowPulse, setGlowPulse] = useState(false);
  const [showWeekModal, setShowWeekModal] = useState(false);

  // 🟢 Sovereign Solar (no SunCalc)
  const d = useSovereignSolarClock();

  // Refs
  const detailRef = useRef<HTMLDivElement | null>(null);
  const toggleRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const suppressScrollCloseUntil = useRef<number>(0);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ⬇️ NEW REFS: anti-sleep + schedulers + solar sync
  const wakeRef = useRef<WakeLockSentinelLike | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const runningRef = useRef<boolean>(false);
  const lastSolarVersionRef = useRef<string | null>(null);
  const solarRxRef = useRef<BroadcastChannel | null>(null);
  const solarTxRef = useRef<BroadcastChannel | null>(null);

  // ✅ Calibration offset for solar-aligned weekday to match engine mapping
  const solarDowOffsetRef = useRef<number>(0);

  // 🔴 User sunrise override seconds
  const [solarOverrideSec, setSolarOverrideSec] = useState<number | null>(null);
  const solarOverrideRef = useRef<number | null>(null);
  useEffect(() => { solarOverrideRef.current = solarOverrideSec; }, [solarOverrideSec]);

  // Portal target
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { setPortalTarget(document.body); }, []);

  useEffect(() => {
    if (showDetails) {
      document.body.classList.add('eternal-overlay-open');
      overlayRef.current?.focus();
    } else {
      document.body.classList.remove('eternal-overlay-open');
    }
    return () => document.body.classList.remove('eternal-overlay-open');
  }, [showDetails]);

  // 🔒 100% OFFLINE: build API-identical payload locally (no network)
  const refreshKlock = (forcedSec?: number) => {
    // Base eternal payload
    const data = buildOfflinePayload(new Date());

    // Always calibrate weekday offset from engine so override path matches it
    const now = new Date();
    let engineCounters;
    try {
      engineCounters = getSolarAlignedCounters(now);
      const naiveIdxFromDay = mod6((engineCounters.solarAlignedDay - 1));
      const offset = mod6(engineCounters.solarAlignedWeekDayIndex - naiveIdxFromDay);
      solarDowOffsetRef.current = offset;
    } catch {
      // keep previous offset if engine not available
    }

    // Choose: instant override → engine counters; else normal engine
    let sat: SolarAlignedTime;
    let lastSunrise: Date;
    let nextSunrise: Date;

    const useSec = typeof forcedSec === 'number'
      ? forcedSec
      : (typeof solarOverrideRef.current === 'number' ? solarOverrideRef.current : null);

    if (typeof useSec === 'number') {
      // 📌 instant path (calibrated weekday)
      sat = countersFromOverride(now, useSec, solarDowOffsetRef.current);
      ({ lastSunrise, nextSunrise } = windowFromOverride(now, useSec));
    } else {
      // ✅ engine path (authoritative)
      const counters = engineCounters ?? getSolarAlignedCounters(now);
      ({ lastSunrise, nextSunrise } = getSolarWindow(now));
      sat = {
        solarAlignedDay: counters.solarAlignedDay,
        solarAlignedMonth: counters.solarAlignedMonth,
        solarAlignedWeekIndex: counters.solarAlignedWeekIndex,
        solarAlignedWeekDay: counters.dayName,
        solarAlignedWeekDayIndex: counters.solarAlignedWeekDayIndex,
        lastSunrise,
        nextSunrise,
        solarAlignedDayInMonth: counters.solarAlignedDayInMonth,
      };
    }

    // Attach sunrise-aligned labels/counters
    data.solarAlignedTime = sat;
    data.solarHarmonicDay = sat.solarAlignedWeekDay;
    data.solarDayOfMonth  = sat.solarAlignedDayInMonth + 1; // 1–42
    data.solarMonthIndex  = sat.solarAlignedMonth;          // 1–8
    data.solarWeekIndex   = sat.solarAlignedWeekIndex;      // 1–7
    data.solarWeekName    = ETERNAL_WEEK_NAMES[(sat.solarAlignedWeekIndex - 1 + 7) % 7];
    data.solarWeekDescription = ETERNAL_WEEK_DESCRIPTIONS[data.solarWeekName!];
    data.solarMonthName   = ETERNAL_MONTH_NAMES[(sat.solarAlignedMonth - 1 + 8) % 8];

    // 🔁 Compute Solar Kai pulse/step directly from the active sunrise window
    const spanMs = Math.max(1, nextSunrise.getTime() - lastSunrise.getTime());
    const sinceMs = Math.max(0, now.getTime() - lastSunrise.getTime());
    const frac = Math.min(0.999999999, (sinceMs % spanMs) / spanMs);
    const solarKaiPulseToday = frac * HARMONIC_DAY_PULSES;

    const beatSize = HARMONIC_DAY_PULSES / CHAKRA_BEATS_PER_DAY;
    const solarBeatIdx2 = Math.floor(solarKaiPulseToday / beatSize);
    const solarPulseInBeat2 = solarKaiPulseToday - solarBeatIdx2 * beatSize;
    const solarStepIndex2 = Math.floor(solarPulseInBeat2 / PULSES_PER_STEP);
    const solarStepProgress2 = solarPulseInBeat2 - solarStepIndex2 * PULSES_PER_STEP;
    const solarPercentIntoStep2 = (solarStepProgress2 / PULSES_PER_STEP) * 100;
    const solarChakraStepString2 = `${solarBeatIdx2}:${String(solarStepIndex2).padStart(2, "0")}`;

    // Prefer instant solar-aligned values
    data.kaiPulseToday = solarKaiPulseToday;
    data.solarChakraStep = {
      beatIndex: solarBeatIdx2,
      stepIndex: solarStepIndex2,
      stepsPerBeat: STEPS_PER_BEAT,
      percentIntoStep: solarPercentIntoStep2,
    };
    data.solarChakraStepString = solarChakraStepString2;

    // Derive Ark name from solar beat
    const arcIndex = Math.floor(((solarBeatIdx2 % CHAKRA_BEATS_PER_DAY) + CHAKRA_BEATS_PER_DAY) / 6) % 6;
    const arcKey = ["Ignition Ark","Integration Ark","Harmonization Ark","Reflection Ark","Purification Ark","Dream Ark"][arcIndex];
    data.chakraArc = arcKey;

    // Update resonance on current arc
    const resonance = computeChakraResonance(data.chakraArc);
    data.chakraZone = resonance.chakraZone;
    data.harmonicFrequencies = resonance.frequencies;
    data.harmonicInputs = resonance.inputs;
    data.sigilFamily = resonance.sigilFamily;
    data.kaiTurahArcPhrase = resonance.arcPhrase;

    // Month index for card header (mirror previous logic)
    const pulsesIntoYear = data.kaiPulseEternal % HARMONIC_YEAR_PULSES;
    const daysIntoYear = Math.floor(pulsesIntoYear / HARMONIC_DAY_PULSES);
    const monthIndex = Math.floor(daysIntoYear / HARMONIC_MONTH_DAYS);

    data.eternalChakraBeat = {
      ...data.eternalChakraBeat,
      beatIndex: data.eternalChakraBeat?.beatIndex ?? 0,
      pulsesIntoBeat: data.eternalChakraBeat?.pulsesIntoBeat ?? 0,
      beatPulseCount: data.eternalChakraBeat?.beatPulseCount ?? PULSES_PER_BEAT,
      totalBeats: data.eternalChakraBeat?.totalBeats ?? CHAKRA_BEATS_PER_DAY,
      percentToNext: data.eternalChakraBeat?.percentToNext ?? 0,
      eternalMonthIndex: monthIndex,
      eternalDayInMonth: data.eternalMonthProgress.daysElapsed,
      dayOfMonth: data.eternalChakraBeat?.dayOfMonth ?? (data.eternalMonthProgress.daysElapsed + 1),
    };

    setKlock(data);
  };

  const calculateKaiPulse = (): number => {
    const moment = new Date(Date.UTC(2024, 4, 10, 6, 45, 40));
    const base = new Date("1990-02-19T00:00:00Z");
    const diffSeconds = Math.floor((moment.getTime() - base.getTime()) / 1000);
    return 206_000_000 + Math.floor(diffSeconds / (3 + Math.sqrt(5)));
  };
  const kaiPulse = calculateKaiPulse();

  const [sealCopied, setSealCopied] = useState(false);
  const sealToastTimer = useRef<number | null>(null);

  // ⏱️ Your original ~φ-breath interval (kept intact)
  useEffect(() => {
    refreshKlock();
    const interval = window.setInterval(() => {
      refreshKlock();
      setGlowPulse(true);
      window.setTimeout(() => setGlowPulse(false), 1000);
    }, 5300);
    return () => window.clearInterval(interval);
  }, []);

  /* 🔥 Pulse-aligned scheduler (ticks at every Kai pulse boundary). */
  useEffect(() => {
    runningRef.current = true;

    const scheduleNext = () => {
      if (!runningRef.current) return;
      const delay = msToNextPulse(Date.now());
      timeoutRef.current = window.setTimeout(() => {
        refreshKlock();
        setGlowPulse(true);
        window.setTimeout(() => setGlowPulse(false), 220);
        scheduleNext();
      }, delay);
    };

    // Start inline worker fallback (helps when tab is deprioritized)
    workerRef.current = makePulseWorker();
    if (workerRef.current) {
      workerRef.current.onmessage = () => {
        if (!runningRef.current) return;
        refreshKlock();
        setGlowPulse(true);
        window.setTimeout(() => setGlowPulse(false), 220);
      };
    }

    // Initial refresh + schedule
    refreshKlock();
    scheduleNext();

    // On visibility regain / pageshow, snap to now
    const onShow = () => {
      checkSolarVersionAndRefresh();
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      scheduleNext();
      void acquireWakeLock();
    };

    document.addEventListener('visibilitychange', onShow, { passive: true });
    window.addEventListener('focus', onShow, { passive: true });
    window.addEventListener('pageshow', onShow, { passive: true });
    window.addEventListener('popstate', onShow, { passive: true });
    window.addEventListener('hashchange', onShow, { passive: true });

    return () => {
      runningRef.current = false;
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', onShow);
      window.removeEventListener('pageshow', onShow);
      window.removeEventListener('popstate', onShow);
      window.removeEventListener('hashchange', onShow);
    };
  }, []);

  // 💤 Prevent device sleep while visible (Screen Wake Lock API)
  useEffect(() => {
    void acquireWakeLock();
    const reAcquire = () => { void acquireWakeLock(); };
    document.addEventListener('visibilitychange', reAcquire);
    window.addEventListener('focus', reAcquire);
    window.addEventListener('beforeunload', () => releaseWakeLock());

    return () => {
      document.removeEventListener('visibilitychange', reAcquire);
      window.removeEventListener('focus', reAcquire);
      releaseWakeLock();
    };
  }, []);

  function releaseWakeLock() {
    try {
      wakeRef.current?.release().catch(() => { /* ignore */ });
    } catch {
      void 0;
    }
    wakeRef.current = null;
  }

  async function acquireWakeLock(): Promise<void> {
    try {
      if (document.visibilityState !== 'visible') return;
      if (hasWakeLock(navigator)) {
        wakeRef.current = await navigator.wakeLock.request('screen');
        wakeRef.current.addEventListener?.('release', () => {
          if (document.visibilityState === 'visible') {
            void acquireWakeLock();
          }
        });
      }
    } catch {
      // fail silently; other fallbacks still keep us fresh on resume
      void 0;
    }
  }

  // 🌞 Cross-page instant update when Solar settings change.
  useEffect(() => {
    try { lastSolarVersionRef.current = localStorage.getItem(SOLAR_BROADCAST_KEY); } catch { void 0; }
    refreshKlock();
  }, []);

  function checkSolarVersionAndRefresh() {
    try {
      const v = localStorage.getItem(SOLAR_BROADCAST_KEY);
      if (v && v !== lastSolarVersionRef.current) {
        lastSolarVersionRef.current = v;
        refreshKlock();
      } else {
        refreshKlock();
      }
    } catch {
      refreshKlock();
    }
  }

  // Listen for storage changes (other tabs) and local custom event (same tab) + BroadcastChannel
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key === SOLAR_BROADCAST_KEY || e.key.startsWith('SOVEREIGN_SOLAR')) {
        checkSolarVersionAndRefresh();
      }
    };
    const onSolarEvent = (e: Event): void => {
      void e; // explicitly mark unused to satisfy @typescript-eslint/no-unused-vars
      checkSolarVersionAndRefresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('solar:updated', onSolarEvent);

    try {
      solarRxRef.current = new BroadcastChannel(SOLAR_BC_NAME);
      solarRxRef.current.onmessage = () => { checkSolarVersionAndRefresh(); };
      solarTxRef.current = new BroadcastChannel(SOLAR_BC_NAME);
    } catch {
      void 0;
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('solar:updated', onSolarEvent);
      try { solarRxRef.current?.close(); } catch { void 0; }
      try { solarTxRef.current?.close(); } catch { void 0; }
      solarRxRef.current = null;
      solarTxRef.current = null;
    };
  }, []);

  // Reactively rebuild when the sovereign hook emits a new step/arc
  useEffect(() => {
    refreshKlock();
  }, [d?.solarStepString, d?.solarArcName, d?.sunriseOffsetSec, solarOverrideSec]);

  useEffect(() => {
    if (!showDetails) return;
    const timeout = window.setTimeout(() => {
      const externalModalOpen =
        showWeekModal || !!document.querySelector(".sigil-modal-overlay");
      if (externalModalOpen) return;

      const handleClickOutside = (evt: MouseEvent) => {
        const target = evt.target as Node;
        const insideDetail = detailRef.current?.contains(target);
        const onToggle = toggleRef.current?.contains(target);
        if (!insideDetail && !onToggle) setShowDetails(false);
      };

      const markInteractionInside = () => {
        suppressScrollCloseUntil.current = Date.now() + 800; // brief cooldown
      };

      const detailNode  = detailRef.current;
      const overlayNode = overlayRef.current;

      detailNode?.addEventListener("pointerdown", markInteractionInside, { capture: true });
      detailNode?.addEventListener("click",       markInteractionInside, { capture: true });
      overlayNode?.addEventListener("focusin",    markInteractionInside, { capture: true });

      const handleScroll = () => {
        const ae = document.activeElement as HTMLElement | null;
        const focusedInside = !!ae && !!overlayNode?.contains(ae);
        const inCooldown = Date.now() < suppressScrollCloseUntil.current;
        if (focusedInside || inCooldown) return;
        setShowDetails(false);
      };

      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", handleScroll, { passive: true });

      cleanupFns.push(() => document.removeEventListener("mousedown", handleClickOutside));
      cleanupFns.push(() => window.removeEventListener("scroll", handleScroll));
      cleanupFns.push(() => {
        detailNode?.removeEventListener("pointerdown", markInteractionInside, true);
        detailNode?.removeEventListener("click",       markInteractionInside, true);
        overlayNode?.removeEventListener("focusin",    markInteractionInside, true);
      });
    }, 0);

    const cleanupFns: Array<() => void> = [];
    return () => {
      window.clearTimeout(timeout);
      cleanupFns.forEach((fn) => fn());
    };
  }, [showDetails, showWeekModal]);

  /* open / collapse — toggle visibility of detail panel */
  const handleToggle = () => {
    setShowDetails(open => {
      if (open) return false;
      if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
        navigator.vibrate(10);
      }
      audioRef.current?.play().catch(() => { /* ignore */ });
      return true;
    });
  };

  useEffect(() => {
    if (!showDetails) setShowWeekModal(false);
  }, [showDetails]);

  // 🔮 Single source of truth for arc → CSS variables + mirrored on modal
  useEffect(() => {
    if (!klock || !containerRef.current) return;
    const bi = (klock.solarChakraStep?.beatIndex ?? klock.eternalChakraBeat?.beatIndex ?? 0);
    const beat = ((bi % 36) + 36) % 36;
    const arcIndex = Math.floor(beat / 6) % 6; // 0..5
    containerRef.current.setAttribute('data-ark', String(arcIndex));
    overlayRef.current?.setAttribute('data-ark', String(arcIndex));
    detailRef.current?.setAttribute('data-ark', String(arcIndex));

    // Also push a live CSS var for hue if your CSS uses it directly
    const hueWheel = [0, 28, 55, 140, 210, 275]; // tweak as needed
    const hue = hueWheel[arcIndex];
    containerRef.current.style.setProperty('--chakra-hue', String(hue));
    containerRef.current.style.setProperty('--chakra', `hsl(${hue} 100% 55%)`);
  }, [klock?.solarChakraStep?.beatIndex, klock?.eternalChakraBeat?.beatIndex, klock]);

  if (!klock) {
    return <div className="eternal-klock-mini">Loading Kai Pulse…</div>;
  }

  const spiralData = getSpiralLevelData(klock.kaiPulseEternal);
  const fullYears = Math.floor(klock.harmonicYearCompletions || 0);
  let updatedEternalYearName = "";
  if (fullYears < 1) {
    updatedEternalYearName = "Year of Harmonik Restoration";
  } else if (fullYears === 1) {
    updatedEternalYearName = "Year of Harmonik Embodiment";
  } else {
    updatedEternalYearName = `Year ${fullYears}`;
  }

  const daysToNextSpiral =
    Number.isFinite(spiralData.pulsesRemaining)
      ? spiralData.pulsesRemaining / HARMONIC_DAY_PULSES
      : NaN;

  const monthPercent = klock.eternalMonthProgress.percent;
  const yearPercent  = ((klock.harmonicYearCompletions ?? 0) % 1) * 100;

  const beatPulseCount   = HARMONIC_DAY_PULSES / 36;
  const currentBeat      = Math.floor(
    (klock.kaiPulseToday % HARMONIC_DAY_PULSES) / beatPulseCount
  );
  const rotationOverride = ((currentBeat + 0.5) / 36) * 360;
  const percentToNextBeat = ((klock.kaiPulseToday % beatPulseCount) / beatPulseCount) * 100;

  const openWeekModal = () => {
    if (sessionStorage.getItem(WEEK_DISMISS_KEY) === "1") return;
    setShowWeekModal(true);
  };

  // ✅ Canonical weekday order
  const SOLAR_DAY_NAMES = ["Solhara", "Aquaris", "Flamora", "Verdari", "Sonari", "Kaelith"] as const;

  const rawSolarIdx = klock.solarAlignedTime?.solarAlignedWeekDayIndex ?? null;
  const displayIdx0 = rawSolarIdx !== null ? ((rawSolarIdx % 6) + 6) % 6 : null;
  const bumpedSolarName   = displayIdx0 !== null ? SOLAR_DAY_NAMES[displayIdx0] : "—";
  const bumpedSolarIndex1 = displayIdx0 !== null ? displayIdx0 + 1 : "—";

  // Eternal week totals (6 Eternal days)
  const TOTAL_WEEK_PULSES = HARMONIC_DAY_PULSES * 6;

  // Robust values even if klock.harmonicWeekProgress is temporarily undefined
  const weekPulsesInto = (() => {
    const hw = klock.harmonicWeekProgress;
    if (hw && Number.isFinite(hw.pulsesIntoWeek)) return hw.pulsesIntoWeek;
    // Fallback: compute from Eternal pulse position
    const mod = (klock.kaiPulseEternal % TOTAL_WEEK_PULSES + TOTAL_WEEK_PULSES) % TOTAL_WEEK_PULSES;
    return mod;
  })();

  const weekPercent = (() => {
    const hw = klock.harmonicWeekProgress;
    if (hw && Number.isFinite(hw.percent)) return hw.percent;
    return (weekPulsesInto / TOTAL_WEEK_PULSES) * 100;
  })();

  // Robust, pure-Eternal fallback (doesn't rely on harmonicWeekProgress existing)
  const eternalPulsesIntoWeek =
    ((klock.kaiPulseEternal % TOTAL_WEEK_PULSES) + TOTAL_WEEK_PULSES) % TOTAL_WEEK_PULSES;

  const eternalWeekDayIndex0 =
    Math.floor(eternalPulsesIntoWeek / HARMONIC_DAY_PULSES) % 6;

  const eternalWeekDayName = HARMONIC_DAYS[eternalWeekDayIndex0];

  // 🔑 Key forces KaiKlock to fully re-mount when Ark/step changes — guarantees hue repaint
  const arkIndexForKey = Math.floor(((klock.solarChakraStep?.beatIndex ?? 0) % 36 + 36) / 6) % 6;
  const kaiKey = `ark-${arkIndexForKey}-${klock.solarChakraStepString}`;

  return (
    <div ref={containerRef} className="eternal-klock-container">
      <div className="eternal-klock-header">
        <div
          ref={toggleRef}
          onClick={handleToggle}
          title="Tap to view details"
          className={`klock-toggle ${glowPulse ? "glow-pulse" : ""}`}
        >
          <KaiKlock
            key={kaiKey}
            hue={'var(--chakra)'}
            kaiPulseEternal={klock.kaiPulseEternal}
            pulse={klock.kaiPulseToday}
            harmonicDayPercent={klock.harmonicLevels.harmonicDay.percent}
            microCyclePercent={klock.harmonicLevels.microCycle.percent}
            dayLabel={klock.harmonicDay}
            monthLabel={klock.eternalMonth}
            monthDay={klock.eternalChakraBeat?.dayOfMonth ?? (klock.eternalMonthProgress.daysElapsed + 1)}
            glowPulse={glowPulse}
            rotationOverride={rotationOverride}
            solarSpiralStepString={klock.solarChakraStepString}
            solarSpiralStep={klock.solarChakraStep}
          />
        </div>
      </div>

      {/* ⬇️ FULL-SCREEN POPOVER VIA PORTAL */}
      {showDetails && portalTarget && createPortal(
        <div
          className="eternal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Eternal Klock Details"
          ref={overlayRef}
          tabIndex={-1}
          onClick={(e) => { if (e.target === overlayRef.current) setShowDetails(false); }}
          onKeyDown={(e) => e.key === 'Escape' && setShowDetails(false)}
        >
          {/* Close button */}
          <button
            type="button"
            className="eternal-close"
            aria-label="Close details"
            title="Close"
            onClick={() => setShowDetails(false)}
          >
            <span className="eternal-close-x" aria-hidden="true">×</span>
          </button>

          <div
            className="eternal-modal-card"
            ref={detailRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="eternal-klock-detail">
              <h2 className="eternal-klock-title">𐰘𐰜𐰇 · 𐰋𐰢𐱃</h2>

              <div className="eternal-klock-toolbar">
                <SigilGlyphButton kaiPulse={kaiPulse} />
                <button
                  className="toolbar-btn"
                  onClick={openWeekModal}
                  title="Open Kairos Week Spiral"
                >
                  <img
                    src="/assets/weekkalendar.svg"
                    alt="Kairos Week"
                    className="toolbar-icon"
                    draggable={false}
                  />
                </button>
              </div>

              {showWeekModal && (
                <WeekKalendarModal onClose={() => setShowWeekModal(false)} />
              )}

              <div className="eternal-klock-section-title"></div>
              <div className="eternal-klock-section-title">
                <img src="/assets/eternal.svg" alt="Eternal Title" style={{ width: '100%', height: 'auto' }} />
                <strong>Date:</strong>{" "}
                D{(klock.eternalChakraBeat?.dayOfMonth ?? (klock.eternalMonthProgress.daysElapsed + 1))}{" "}
                / M{(klock.eternalChakraBeat?.eternalMonthIndex ?? 0) + 1}
              </div>

              {klock.chakraStep && klock.eternalChakraBeat && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <strong>Kairos:</strong>{" "}
                  <code>
                    {klock.eternalChakraBeat.beatIndex}:
                    {(klock.chakraStep.stepIndex).toString().padStart(2, '0')}
                  </code>
                  <br />
                  <small style={{ display: "block", marginTop: "0.25rem" }}>
                    Beat <strong>{klock.eternalChakraBeat.beatIndex}</strong> /{" "}
                    {klock.eternalChakraBeat.totalBeats - 1} — Step{" "}
                    <strong>{klock.chakraStep.stepIndex}</strong> /{" "}
                    {klock.chakraStep.stepsPerBeat} (
                    {klock.chakraStep.percentIntoStep.toFixed(1)}%)
                  </small>
                  <div><strong>Kai-Pulse(Eternal):</strong> {klock.kaiPulseEternal}</div>

                  {/* Eternal day-of-week (name + 1–6 index) */}
                  <div style={{ marginTop: "0.25rem" }}>
                    <strong>Day:</strong>{" "}
                    {eternalWeekDayName} {eternalWeekDayIndex0 + 1} / 6
                  </div>
                </div>
              )}

              <div>
                <strong>Week:</strong>{" "}
                {klock.weekIndex}/7, <strong>{klock.weekName}</strong>
              </div>
              <div><strong>Month:</strong> {klock.eternalMonth} {(klock.eternalChakraBeat?.eternalMonthIndex ?? 0) + 1} / 8</div>

              <div>
                <strong>Kai-Pulse(Today):</strong>{" "}
                {(klock.kaiPulseEternal % HARMONIC_DAY_PULSES).toFixed(2)} / {HARMONIC_DAY_PULSES.toFixed(2)}
              </div>

              <div>
                <div>
                  <strong>% of Day Komplete:</strong>{" "}
                  {klock.harmonicLevels.harmonicDay.percent.toFixed(2)}%
                </div>

                <div className="day-progress-bar">
                  <div
                    className={`day-progress-fill ${glowPulse ? "sync-pulse" : ""} ${
                      klock.harmonicLevels.harmonicDay.percent.toFixed(0) === "100" ? "burst" : ""
                    }`}
                    style={{ width: `${klock.harmonicLevels.harmonicDay.percent}%` }}
                    title={`${klock.harmonicLevels.harmonicDay.percent.toFixed(2)}% of eternal day`}
                  />
                </div>
                <div>
                  <strong>Kai-Pulses (Breathes) Remaining Today:</strong>{" "}
                  {(HARMONIC_DAY_PULSES - klock.harmonicLevels.harmonicDay.pulseInCycle).toFixed(2)}
                </div>
              </div>

              { klock.harmonicDayDescription && (
                <div className="eternal-description">
                  <em>{klock.harmonicDayDescription}</em>
                </div>
              )}
              <strong>Kai-Turah:</strong> <em>{klock.kaiTurahPhrase}</em>
              <div></div>
              <strong>Phi Pulse:</strong> {(klock.kaiPulseEternal * 1.618).toFixed(0)}

              <div className="eternal-klock-section-title"></div>

              <div className="eternal-klock-section-title">Week Progress</div>

              {typeof klock.weekIndex === "number" && klock.weekName ? (
                <>
                  <div>
                    <strong>Week:</strong> {klock.weekIndex} / 7, <strong>{klock.weekName}</strong>
                  </div>
                  {/* Eternal day-of-week (name + 1–6 index) */}
                  <div style={{ marginTop: "0.25rem" }}>
                    <strong>Day:</strong>{" "}
                    {eternalWeekDayName} {eternalWeekDayIndex0 + 1} / 6
                  </div>
                  {klock.eternalWeekDescription && (
                    <div className="eternal-description">
                      <em>{klock.eternalWeekDescription}</em>
                    </div>
                  )}
                </>
              ) : (
                <div>—</div>
              )}

              <div style={{ marginTop: "0.25rem" }}>
                <strong>Kai-Pulses (Breathes) Into Week:</strong>{" "}
                {weekPulsesInto.toFixed(2)}
              </div>

              <div>
                <strong>Kai-Pulses (Breathes) Remaining:</strong>{" "}
                {(TOTAL_WEEK_PULSES - weekPulsesInto).toFixed(2)}
              </div>

              <div>
                <strong>% Komplete:</strong> {weekPercent.toFixed(2)}%
              </div>

              <div className="week-progress-bar">
                <div
                  className={`week-progress-fill ${glowPulse ? "sync-pulse" : ""} ${
                    Math.round(weekPercent) === 100 ? "burst" : ""
                  }`}
                  style={{ width: `${weekPercent}%` }}
                  title={`${weekPercent.toFixed(2)}% of week`}
                />
              </div>

              <div>
                <strong>Total Kai-Pulses (Breathes) in Week:</strong>{" "}
                {TOTAL_WEEK_PULSES.toFixed(2)}
              </div>

              <div><strong>Eternal Month:</strong> {klock.eternalMonth}</div>
              { klock.eternalMonthDescription && (
                <div className="eternal-description">
                  <em>{klock.eternalMonthDescription}</em>
                </div>
              )}

              <div className="eternal-klock-section-title"></div>
              <div className="eternal-klock-section-title">Month Progress</div>

              <div><strong>Days Elapsed:</strong> {klock.eternalMonthProgress.daysElapsed}</div>
              <div><strong>Days Remaining:</strong> {klock.eternalMonthProgress.daysRemaining}</div>

              <div>
                <strong>Kai-Pulses (Breathes) Into Month:</strong>{" "}
                {(klock.kaiPulseEternal % HARMONIC_MONTH_PULSES).toFixed(2)}
              </div>

              <div>
                <strong>Kai-Pulses (Breathes) Remaining:</strong>{" "}
                {(HARMONIC_MONTH_PULSES - (klock.kaiPulseEternal % HARMONIC_MONTH_PULSES)).toFixed(2)}
              </div>
              <div>
                <strong>% Komplete:</strong>{" "}
                {klock.eternalMonthProgress.percent.toFixed(2)}%
              </div>

              <div className="month-progress-bar">
                <div
                  className={`month-progress-fill ${glowPulse ? "sync-pulse" : ""}`}
                  style={{ width: `${monthPercent}%` }}
                  title={`${monthPercent.toFixed(2)}% of month`}
                />
              </div>

              <div>
                <strong>Total Breathes in Month:</strong> {HARMONIC_MONTH_PULSES.toFixed(2)}
              </div>

              <div className="eternal-klock-section-title"></div>
              <strong>Harmonik Sykle:</strong>
              <div className="eternal-klock-timestamp">{klock.timestamp}</div>

              { klock.seal && (
                <div className="seal-container">
                  <strong className="seal-label">Seal:</strong>{" "}
                  <span
                    className={`seal-code ${sealCopied ? "copied" : ""}`}
                    onClick={() => {
                      if (!klock.seal) return;
                      navigator.clipboard.writeText(klock.seal).then(() => {
                        if (sealToastTimer.current) window.clearTimeout(sealToastTimer.current);
                        setSealCopied(true);
                        sealToastTimer.current = window.setTimeout(() => setSealCopied(false), 1600);
                      });
                    }}
                    title="Click to copy Eternal Seal"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.currentTarget as HTMLElement).click()}
                  >
                    {klock.seal}
                  </span>

                  <span
                    className={`seal-toast ${sealCopied ? "show" : ""}`}
                    role="status"
                    aria-live="polite"
                  >
                    <span className="toast-mark" aria-hidden>✓</span>
                    <span className="toast-text">Copied</span>
                    <span className="toast-meter" aria-hidden />
                  </span>
                </div>
              )}

              { klock.harmonicTimestampDescription && (
                <div className="eternal-description">
                  <em>{klock.harmonicTimestampDescription}</em>
                </div>
              )}

              <div className="eternal-klock-section-title"></div>
              <div className="eternal-klock-section-title">Year Progress</div>

              <div>
                <strong>Harmonik Year:</strong>{" "}
                {klock.harmonicYearCompletions?.toFixed(4)}
              </div>

              <div><strong>Year:</strong> {updatedEternalYearName}</div>

              <div>
                <strong>% of Year Komplete:</strong>{" "}
                {typeof klock.yearPercent === "number" ? klock.yearPercent.toFixed(2) : "—"}%
              </div>

              <div>
                <strong>Days Into Year:</strong>{" "}
                {typeof klock.daysIntoYear === "number" ? klock.daysIntoYear : "—"} / {HARMONIC_YEAR_DAYS}
              </div>

              <div>
                <strong>Kai-Pulses (Breathes) Into Year:</strong>{" "}
                {(klock.kaiPulseEternal % HARMONIC_YEAR_PULSES).toFixed(0)}
              </div>

              <div>
                <strong>Kai-Pulses (Breathes) Remaining:</strong>{" "}
                {(HARMONIC_YEAR_PULSES - (klock.kaiPulseEternal % HARMONIC_YEAR_PULSES)).toFixed(0)}
              </div>

              <div className="year-progress-bar">
                <div
                  className={`year-progress-fill ${glowPulse ? "sync-pulse" : ""}`}
                  style={{ width: `${yearPercent}%` }}
                  title={`${yearPercent.toFixed(2)}% of year`}
                />
              </div>

              <div>
                <strong>Total Kai-Pulses (Breathes) in Year:</strong>{" "}
                {HARMONIC_YEAR_PULSES.toFixed(2)}
              </div>

              <div className="eternal-klock-section-title"></div>
              <div className="eternal-klock-section-title">Phi Spiral Progress</div>

              <div><strong>Phi Spiral Level:</strong> {spiralData.spiralLevel}</div>
              <div><strong>Progress to Next Level:</strong> {spiralData.percentToNext.toFixed(2)}%</div>
              <div><strong>Kai-Pulses (Breathes) Remaining:</strong> {spiralData.pulsesRemaining}</div>
              <div><strong>Days to Next Spiral:</strong> {Number.isFinite(daysToNextSpiral) ? daysToNextSpiral.toFixed(4) : "—"}</div>
              <div><strong>Next Spiral Threshold:</strong> {spiralData.nextSpiralPulse}</div>

              <div className="spiral-progress-bar">
                <div
                  className="spiral-progress-fill"
                  style={{ width: `${spiralData.percentToNext}%` }}
                />
              </div>

              <div className="eternal-klock-section-title"></div>
              <div className="eternal-klock-section-title embodied-section-title">
                <img
                  src="/assets/embodied_solar_aligned.svg"
                  alt="Embodied Solar-Aligned Title"
                  className="embodied-section-icon"
                />
              </div>

              <strong>Date (Solar):</strong>{" "}
D{(klock.solarDayOfMonth ?? "—")} / M{(klock.solarMonthIndex ?? "—")}{" "}
{(klock.solarMonthName ? <small>({klock.solarMonthName})</small> : null)}


              {klock.solarChakraStep && klock.solarChakraStepString && (
                <div style={{ marginBottom: "0.5rem" }}>
                  <strong>Solar Kairos:</strong>{" "}
                  <code>{klock.solarChakraStepString}</code>
                  <br />
                </div>
              )}

              {/* ✅ Solar Day name + 1–6 index from sunrise-aligned data */}
              <div>
                <strong> Day:</strong> {bumpedSolarName} {bumpedSolarIndex1} / 6
              </div>

              <div>
                <strong>Week:</strong>{" "}
                {klock.weekIndex}/7, <strong>{klock.weekName}</strong>
              </div>

              <div><strong>Month:</strong> {klock.eternalMonth} {(klock.eternalChakraBeat?.eternalMonthIndex ?? 0) + 1} / 8 </div>
              <div><strong>% into Beat:</strong>{" "}{percentToNextBeat.toFixed(2)}%</div>
              <div style={{ marginTop: "0.5rem" }}>
                <strong>Beat:</strong> {currentBeat} / 36
              </div>
              <div>
                <strong>% into Step:</strong>{" "}
                {klock.solarChakraStep ? klock.solarChakraStep.percentIntoStep.toFixed(1) : "—"}%
              </div>
              <div>
                <strong>Step:</strong>{" "}
                {klock.solarChakraStep
                  ? `${klock.solarChakraStep.stepIndex} / ${klock.solarChakraStep.stepsPerBeat}`
                  : "—"}
              </div>

              <div>
                <strong>Kurrent Step Breathes:</strong>{" "}
                {klock.solarChakraStep
                  ? (
                      (klock.solarChakraStep.percentIntoStep / 100) *
                      (HARMONIC_DAY_PULSES / 36 / klock.solarChakraStep.stepsPerBeat)
                    ).toFixed(2)
                  : "—"}{" "}
                / 11
              </div>

              <div>
                <strong>Kai(Today):</strong>{" "}
                {klock.kaiPulseToday} / {HARMONIC_DAY_PULSES.toFixed(2)}
              </div>

              <div>
                <strong>% of Day Komplete:</strong>{" "}
                {((klock.kaiPulseToday / HARMONIC_DAY_PULSES) * 100).toFixed(2)}%
              </div>

              <div className="day-progress-bar">
                <div
                  className={`day-progress-fill ${glowPulse ? "sync-pulse" : ""} ${
                    ((klock.kaiPulseToday / HARMONIC_DAY_PULSES) * 100).toFixed(0) === "100"
                      ? "burst"
                      : ""
                  }`}
                  style={{ width: `${(klock.kaiPulseToday / HARMONIC_DAY_PULSES) * 100}%` }}
                  title={`${((klock.kaiPulseToday / HARMONIC_DAY_PULSES) * 100).toFixed(2)}% of day`}
                />
              </div>

              <div>
                <strong>Breathes Remaining Today:</strong>{" "}
                {(HARMONIC_DAY_PULSES - klock.kaiPulseToday).toFixed(2)}
              </div>

              <div><strong>Ark:</strong> {klock.chakraArc}</div>
              {CHAKRA_ARC_DESCRIPTIONS[klock.chakraArc] && (
                <div className="eternal-description">
                  <em>{CHAKRA_ARC_DESCRIPTIONS[klock.chakraArc]}</em>
                </div>
              )}

              <div style={{ marginTop: "0.25rem" }}>
                <div>
                  <strong>Breathes Into Beat:</strong>{" "}
                  {(klock.kaiPulseToday % beatPulseCount).toFixed(2)} / {beatPulseCount.toFixed(2)}
                </div>
                <strong>To Next Beat:</strong> {percentToNextBeat.toFixed(2)}%
              </div>

              <div><strong>Beat Zone:</strong> {klock.chakraZone}</div>
              <div><strong>Sigil Family:</strong> {klock.sigilFamily}</div>
              <div><strong>Kai-Turah:</strong> {klock.kaiTurahArcPhrase}</div>

              <div className="eternal-klock-section-title"></div>
              <div className="eternal-klock-section-title">Harmonik Levels</div>
              <div><strong>Ark Beat:</strong></div>
              <div>
                {klock.harmonicLevels.arcBeat.pulseInCycle} /{" "}
                {klock.harmonicLevels.arcBeat.cycleLength} (
                {klock.harmonicLevels.arcBeat.percent.toFixed(2)}%)
              </div>
              <div>
                <small>Kompleted Sykles: {klock.arcBeatCompletions}</small>
              </div>
              <div style={{ marginTop: "0.75rem" }}>
                <strong>Mikro Sykle:</strong>
              </div>
              <div>
                {klock.harmonicLevels.microCycle.pulseInCycle} /{" "}
                {klock.harmonicLevels.microCycle.cycleLength} (
                {klock.harmonicLevels.microCycle.percent.toFixed(2)}%)
              </div>
              <div>
                <small>Kompleted Sykles: {klock.microCycleCompletions}</small>
              </div>
              <div style={{ marginTop: "0.75rem" }}>
                <strong>Beat Loop:</strong>
              </div>
              <div>
                {klock.harmonicLevels.chakraLoop.pulseInCycle} /{" "}
                {klock.harmonicLevels.chakraLoop.cycleLength} (
                {klock.harmonicLevels.chakraLoop.percent.toFixed(2)}%)
              </div>
              <div>
                <small>Kompleted Sykles: {klock.chakraLoopCompletions}</small>
              </div>

              <div style={{ marginTop: "0.75rem" }}>
                <strong>Harmonik Day:</strong>
              </div>
              <div>
                {klock.harmonicLevels.harmonicDay.pulseInCycle} /{" "}
                {klock.harmonicLevels.harmonicDay.cycleLength} (
                {klock.harmonicLevels.harmonicDay.percent.toFixed(2)}%)
              </div>
              <div>
                <small>Kompleted Sykles: {klock.harmonicDayCompletions}</small>
              </div>

              <div className="eternal-klock-section-title"></div>
              <div className="eternal-klock-section-title">Solar-Ark Aligned Frequencies & Inputs</div>
              <ul>
                {klock.harmonicFrequencies.map((freq, idx) => (
                  <li key={idx}>
                    <strong>{freq.toFixed(1)} Hz</strong> — {klock.harmonicInputs[idx]}
                  </li>
                ))}
              </ul>
            </div>

            <div className="eternal-klock-section-title"></div>
            <div className="eternal-klock-section-title">Solar Aligned Kairos Sync</div>
            <SolarAnchoredDial
              showControls={true}
              onSunriseChange={(sec) => {
                // Set override so UI recomputes immediately with this exact value
                setSolarOverrideSec(sec);
                console.debug("Sunrise offset updated:", sec, "seconds");

                // 🔔 persist & broadcast for cross-page/live updates
                try { localStorage.setItem(SOLAR_BROADCAST_KEY, String(Date.now())); } catch { void 0; }
                try { window.dispatchEvent(new Event('solar:updated')); } catch { void 0; }
                try { solarTxRef.current?.postMessage({ type: 'solar:updated', t: Date.now() }); } catch { void 0; }

                // Rebuild NOW using the override seconds (no page reload)
                refreshKlock(sec);

                // Small follow-ups to catch any async persistence inside the dial:
                requestAnimationFrame(() => refreshKlock(sec));
                window.setTimeout(() => refreshKlock(), 200);
                window.setTimeout(() => refreshKlock(), 800);
              }}
            />
          </div>
        </div>,
        portalTarget
      )}

      <audio ref={audioRef} src="/assets/chimes/kai_turah_tone.mp3" preload="auto" />
    </div>
  );
};

export default EternalKlock;
