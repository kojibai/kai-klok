const KAI_KLOCK_API = 'https://klock.kaiturah.com/kai';
const SECONDS_PER_PULSE = 5.236; // exact pulse interval in seconds
const GENESIS_TIME = new Date('2024-05-10T06:45:41.888Z').getTime(); // UTC

/**
 * Fetches the real Eternal Pulse from the live Kai Klock server.
 */
export async function getEternalPulseFromAPI(): Promise<number> {
  const response = await fetch(KAI_KLOCK_API);
  if (!response.ok) {
    throw new Error(`Failed to fetch Eternal Pulse: ${response.statusText}`);
  }
  const data = await response.json();
  return data.eternal_pulse;
}

/**
 * Converts a given Date to Eternal Pulse using local logic.
 * Use this only for historical glyph generation, not live real-time pulse.
 */
export function getEternalPulseFromDateLocal(date: Date): number {
  const diffSeconds = (date.getTime() - GENESIS_TIME) / 1000;
  return Math.floor(diffSeconds / SECONDS_PER_PULSE);
}

/**
 * Converts an Eternal Pulse number back to a Date.
 */
export function getDateFromEternalPulse(pulse: number): Date {
  const time = GENESIS_TIME + pulse * SECONDS_PER_PULSE * 1000;
  return new Date(time);
}
