import type { ZKProof } from "./ZKProof";
import type { SigilMetadata } from "./SigilMetadata";
import type { ChatMessage } from "./ChatMessage";

/**
 * PhiPacket — A raw transmission unit between Phi Network nodes or peers,
 * used for gossip sync, ZK verification, sigil relay, or memory crystal transport.
 */
export interface PhiPacket {
  /** Unique packet ID (hash of payload or UUIDv4) */
  id: string;

  /** Alias of kind, to support destructured use */
  type?: "message" | "presence" | "sigil" | "crystal" | "announcement";

  /** Type of packet being sent (used for routing) */
  kind: "message" | "presence" | "sigil" | "crystal" | "announcement";

  /** Sender PhiKey (public identity string) */
  sender: string;

  /** Receiver PhiKey (optional) */
  to?: string;

  /** Original sender / source (if relayed) */
  from?: string;

  /** Required: Harmonic identity signature for Kai-pulse alignment */
  kaiSignature: string;

  /** Canonical harmonic Kairos timestamp for when this packet was created */
  kai: {
    pulse: number;
    muPulse: number;
    beat: number;
    stepIndex: number;
    arc: string;
    weekday: string;
    timestamp: number;
  };

  /** Direct access to pulse (shortcut) */
  pulse?: number;

  /** Optional message content (flattened for access) */
  message?: string;

  /** Optional sigil anchor or wrapper metadata */
  sigil?: SigilMetadata;

  /** Zero-knowledge proof of sender's harmonic identity */
  zkProof?: ZKProof;

  /** Optional lineage tag for multi-hop or threaded messages */
  lineageTag?: string;

  /** Type-specific payload object */
  payload:
    | PhiMessagePayload
    | PhiPresencePayload
    | PhiSigilPayload
    | PhiCrystalPayload
    | PhiAnnouncementPayload;

  /** Optional deterministic signature over payload (for gossip validation) */
  signature?: string;

  /** Optional hash of this packet, computed during emission */
  packetHash?: string;

  /** Whether this packet is encrypted */
  encrypted?: boolean;
}

/* Type variants for packet payloads */
export interface PhiMessagePayload {
  kind: "message";
  message: ChatMessage;
}

export interface PhiPresencePayload {
  kind: "presence";
  presence: {
    status: "online" | "away" | "offline";
    lastSeenPulse: number;
  };
}

export interface PhiSigilPayload {
  kind: "sigil";
  encodedSvg: string;
  metadata: SigilMetadata;
}

export interface PhiCrystalPayload {
  kind: "crystal";
  crystalName: string;
  base64Data: string;
}

export interface PhiAnnouncementPayload {
  kind: "announcement";
  text: string;
  author?: string;
}
