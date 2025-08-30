import { useRef, useCallback } from "react";
import { useKaiPulse } from "./useKaiPulse";

/**
 * Hook to throttle an action based on Kai-Klok pulses.
 * Returns a function you can call once per `intervalPulses`.
 */
export function useKaiThrottle(intervalPulses: number = 1): () => boolean {
  const pulse = useKaiPulse();
  const lastPulseRef = useRef<number>(-Infinity);

  const tryActivate = useCallback((): boolean => {
    const elapsed = pulse - lastPulseRef.current;
    const allowed = elapsed >= intervalPulses;

    if (allowed) {
      lastPulseRef.current = pulse;
      return true;
    }

    return false;
  }, [pulse, intervalPulses]);

  return tryActivate;
}
