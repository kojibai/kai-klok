import { useEffect, useState } from "react";
import type { SigilMetadata } from "../types/SigilMetadata";

type PresenceCallback = (sigil: SigilMetadata) => void;

const CHANNEL_NAME = "kai-breath-socket";
let channel: BroadcastChannel | null = null;

export function initBreathSocket(onReceive: PresenceCallback): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;

  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      const data = event.data;
      if (data && typeof data === "object" && "userPhiKey" in data) {
        onReceive(data as SigilMetadata);
      }
    };
  }
}

export function emitBreathSigil(sigil: SigilMetadata): void {
  if (channel) {
    channel.postMessage(sigil);
  }
}

export function closeBreathSocket(): void {
  if (channel) {
    channel.close();
    channel = null;
  }
}

// 🧠 Local pulse hook synced from breath socket
export function useBreathSocket() {
  const [pulse, setPulse] = useState<number>(0);

  useEffect(() => {
    function handlePulse(sigil: SigilMetadata) {
      if (typeof sigil.pulse === "number") {
        setPulse(sigil.pulse);
      }
    }

    initBreathSocket(handlePulse);
    return () => {
      closeBreathSocket();
    };
  }, []);

  return { pulse };
}
