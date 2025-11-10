// src/components/KaiRealms/constants.ts
// ─── Kai-Klok Harmonic Constants ─────────────────────────────

export const KAI_PULSE_MS = 5236; // 1 breath = 5.236s
export const PULSES_PER_STEP = 11;
export const STEPS_PER_BEAT = 44;
export const BEATS_PER_DAY = 36;
export const PULSES_PER_BEAT = PULSES_PER_STEP * STEPS_PER_BEAT; // 484

export const GENESIS_KAI_EPOCH_MS = 1715323541888; // May 10, 2024 06:45:41.888 UTC

// ─── Game World Dimensions ───────────────────────────────────

export const WORLD_WIDTH = 800;
export const WORLD_HEIGHT = 500;
export const PLAYER_RADIUS = 28;
export const ORB_RADIUS = 10;

// ─── Gameplay Values ─────────────────────────────────────────

export const MAX_ORBS = 10;
export const ORB_COLLISION_RADIUS = PLAYER_RADIUS + ORB_RADIUS;

export const WAGER_AMOUNT = 3;
export const WIN_MULTIPLIER = 3;
export const MISSION_INTERVAL = 11; // Every 11 pulses

// ─── Chakra Colors ───────────────────────────────────────────

export const CHAKRA_COLOR_MAP: Record<string, string> = {
  Root: '#FF0033',
  Sacral: '#FF8000',
  Solar: '#FFD700',
  Heart: '#00FF99',
  Throat: '#33CCFF',
  ThirdEye: '#9933FF',
  Crown: '#AA00FF',
};

export const DEFAULT_CHAKRA_COLOR = '#00FFFF';

// ─── Visual Tuning ───────────────────────────────────────────

export const AURA_GLOW_BLUR = 15;
export const AURA_RING_WIDTH = 1.5;
