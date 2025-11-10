// src/components/KaiRealms/WorldState.ts

// ─── Types ──────────────────────────────────────────────

export type PhiOrb = {
  id: string;
  x: number;
  y: number;
  spawnedAtPulse: number;
};

export type WorldMission = {
  id: string;
  pulseIndex: number;
  completed: boolean;
};

export type PowerUp = {
  id: string;
  type: 'double-jump' | 'aura-boost' | 'sigil-flare';
  x: number;
  y: number;
  collected: boolean;
};

export type WorldState = {
  orbs: PhiOrb[];
  missions: WorldMission[];
  powerUps: PowerUp[];
};

// ─── State Initialization ──────────────────────────────

export const createInitialWorldState = (): WorldState => ({
  orbs: [],
  missions: [],
  powerUps: [],
});

// ─── Orb Logic ──────────────────────────────────────────

export function spawnOrb(pulse: number): PhiOrb {
  const id = `orb-${pulse}-${Math.random().toString(36).substring(2, 6)}`;
  return {
    id,
    x: Math.random() * 760 + 20,
    y: Math.random() * 440 + 20,
    spawnedAtPulse: pulse,
  };
}

export function filterCollectedOrbs(orbs: PhiOrb[], playerX: number, playerY: number): PhiOrb[] {
  return orbs.filter((orb) => {
    const dx = orb.x - playerX;
    const dy = orb.y - playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist >= 38; // Assume collision radius is 28 + 10
  });
}

// ─── Mission Logic ─────────────────────────────────────

export function createMission(pulseIndex: number): WorldMission {
  return {
    id: `mission-${pulseIndex}`,
    pulseIndex,
    completed: false,
  };
}

export function markMissionComplete(missions: WorldMission[], id: string): WorldMission[] {
  return missions.map((m) => (m.id === id ? { ...m, completed: true } : m));
}

// ─── Power-Up Logic ────────────────────────────────────

export function spawnPowerUp(type: PowerUp['type']): PowerUp {
  const id = `power-${type}-${Math.random().toString(36).substring(2, 5)}`;
  return {
    id,
    type,
    x: Math.random() * 760 + 20,
    y: Math.random() * 440 + 20,
    collected: false,
  };
}

export function collectPowerUp(powerUps: PowerUp[], id: string): PowerUp[] {
  return powerUps.map((p) => (p.id === id ? { ...p, collected: true } : p));
}
