import { useState, useEffect } from "react";
import { getKaiPulseEternalInt } from "../../../SovereignSolar";

/**
 * React hook that returns the current Kai-Klok pulse, updating in sync with φ.
 * Internally polls every 5.236 seconds, matching pulse length.
 */
export function useKaiPulse(): number {
  const [pulse, setPulse] = useState<number>(() => getKaiPulseEternalInt());

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(getKaiPulseEternalInt());
    }, 5236); // 5.236 seconds

    return () => clearInterval(interval);
  }, []);

  return pulse;
}
