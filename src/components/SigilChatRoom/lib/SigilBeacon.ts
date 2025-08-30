import type { SigilMetadata } from "../types/SigilMetadata";

type BeaconCallback = (sigil: SigilMetadata) => void;

const CHANNEL_NAME = "sigil-beacon";
let beaconChannel: BroadcastChannel | null = null;

type IntervalID = ReturnType<typeof setInterval>;

interface WindowWithBeaconInterval extends Window {
  __SIGIL_BEACON_INTERVAL__?: IntervalID;
}

/**
 * Starts broadcasting your current presence sigil on a loop.
 */
export function startSigilBeacon(
  sigil: SigilMetadata,
  intervalMs: number = 5236
): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;

  if (!beaconChannel) {
    beaconChannel = new BroadcastChannel(CHANNEL_NAME);
  }

  const send = () => {
    if (beaconChannel) {
      beaconChannel.postMessage(sigil);
    }
  };

  send();

  const id = setInterval(send, intervalMs);

  // Safe attachment to window
  (window as WindowWithBeaconInterval).__SIGIL_BEACON_INTERVAL__ = id;
}

/**
 * Listens for presence sigils from other users.
 */
export function listenForBeacons(onReceive: BeaconCallback): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;

  if (!beaconChannel) {
    beaconChannel = new BroadcastChannel(CHANNEL_NAME);
  }

  beaconChannel.onmessage = (event: MessageEvent<unknown>) => {
    const data = event.data;
    if (typeof data === "object" && data !== null && "userPhiKey" in data) {
      onReceive(data as SigilMetadata);
    }
  };
}

/**
 * Stops the beacon loop and listener.
 */
export function stopSigilBeacon(): void {
  const win = window as WindowWithBeaconInterval;
  if (win.__SIGIL_BEACON_INTERVAL__ !== undefined) {
    clearInterval(win.__SIGIL_BEACON_INTERVAL__);
    delete win.__SIGIL_BEACON_INTERVAL__;
  }

  if (beaconChannel) {
    beaconChannel.close();
    beaconChannel = null;
  }
}
