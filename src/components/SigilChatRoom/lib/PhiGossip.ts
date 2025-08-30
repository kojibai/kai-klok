import type { PhiPacket } from "../types/PhiPacket";
import { verifyKaiSignature } from "../utils/verifyKaiSignature";
import { hashPhiPacket } from "../utils/hashPhiPacket";

type GossipCallback = (packet: PhiPacket) => void;

const GOSSIP_CHANNEL = "phi-gossip-channel";
let gossipChannel: BroadcastChannel | null = null;

/**
 * Initialize the Phi Gossip channel for real-time peer-to-peer packet syncing.
 */
export function initPhiGossip(
  phraseSignature: string,
  onReceive: GossipCallback
): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;

  if (!gossipChannel) {
    gossipChannel = new BroadcastChannel(GOSSIP_CHANNEL);

    gossipChannel.onmessage = (event) => {
      const packet = event.data as PhiPacket;

      const from = packet.from ?? packet.sender;
      const pulse = packet.kai?.pulse ?? packet.pulse ?? 0;

      const isValid = verifyKaiSignature(
        packet.kaiSignature,
        from,
        pulse,
        phraseSignature
      );

      if (isValid) {
        onReceive(packet);
      } else {
        // eslint-disable-next-line no-console
        console.warn("Invalid PhiPacket signature:", packet);
      }
    };
  }
}

/**
 * Emit a PhiPacket to all peers via BroadcastChannel.
 * Automatically computes packetHash if missing.
 */
export function emitGossipPacket(packet: PhiPacket): void {
  if (!packet.packetHash) {
    // Back-compat canonical hash (pulse:from:kaiSignature:message)
    // Works because our PhiPacket includes convenience fields: pulse, from, message.
    packet.packetHash = hashPhiPacket({
      pulse: packet.pulse ?? packet.kai?.pulse ?? 0,
      from: packet.from ?? packet.sender,
      kaiSignature: packet.kaiSignature,
      message: packet.message ?? "",
      type: "message",
    } as unknown as PhiPacket);
  }

  if (gossipChannel) {
    gossipChannel.postMessage(packet);
  }
}

/**
 * High-level helper to build a PhiPacket from a UI message,
 * persist to sessionStorage, broadcast to peers, and dispatch
 * a DOM event for local listeners (ChatLog, etc).
 */
export async function gossipMessage(input: {
  chatUID: string;
  body: string;
  timestamp: number;
  pulse: number;
  userPhiKey: string;
  phraseSignature: string;
  frequencySignature: string;
  zkProof?: unknown;
  publicSignals?: string[];
}): Promise<void> {
  const packet: PhiPacket = {
    id: `${input.userPhiKey}:${input.pulse}:${input.timestamp}`,
    kind: "message",
    type: "message",
    sender: input.userPhiKey,
    from: input.userPhiKey,
    to: undefined,
    kaiSignature: input.phraseSignature, // keep consistent with your verifyKaiSignature() flow
    kai: {
      pulse: input.pulse,
      muPulse: 0,
      beat: 0,
      stepIndex: 0,
      arc: "",
      weekday: "",
      timestamp: input.timestamp,
    },
    // convenience/flattened access for older handlers:
    pulse: input.pulse,
    message: input.body,
    lineageTag: input.chatUID,
    sigil: undefined,
    zkProof: undefined,
    payload: {
      kind: "message",
      message: {
        id: `${input.userPhiKey}:${input.timestamp}`,
        senderPhiKey: input.userPhiKey,
        senderAlias: undefined,
        text: input.body,
        kai: {
          pulse: input.pulse,
          beat: 0,
          stepIndex: 0,
          muPulse: 0,
          timestamp: input.timestamp,
          arc: "",
          weekday: "",
        },
        zkProof: {
          // best-effort mapping for local echo; real verification done elsewhere
          phiKeyField: input.userPhiKey,
          kaiPulse: input.pulse,
          proof: { pi_a: ["0x0", "0x0"], pi_b: [["0x0", "0x0"], ["0x0", "0x0"]], pi_c: ["0x0", "0x0"] },
          publicSignals: input.publicSignals ?? [],
        },
        status: "confirmed",
      },
    },
    signature: undefined,
    packetHash: undefined,
    encrypted: false,
  };

  // Persist to sessionStorage (simple local history)
  const key = `chatlog:${input.chatUID}`;
  const prev = sessionStorage.getItem(key);
  const list: PhiPacket[] = prev ? (JSON.parse(prev) as PhiPacket[]) : [];
  list.push(packet);
  sessionStorage.setItem(key, JSON.stringify(list));

  // Broadcast to peers + local app
  emitGossipPacket(packet);
  window.dispatchEvent(new CustomEvent<PhiPacket>("phigossip:new-message", { detail: packet }));
}

/**
 * Close the gossip channel connection cleanly.
 */
export function closePhiGossip(): void {
  if (gossipChannel) {
    gossipChannel.close();
    gossipChannel = null;
  }
}

/**
 * Load prior chat messages for a given chatUID (sessionStorage-backed).
 */
export async function fetchMessagesForChat(chatUID: string): Promise<PhiPacket[]> {
  const local = sessionStorage.getItem(`chatlog:${chatUID}`);
  return local ? (JSON.parse(local) as PhiPacket[]) : [];
}
