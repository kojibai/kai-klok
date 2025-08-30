import type { SigilMetadata } from "./SigilMetadata";
import type { PhiPacket } from "./PhiPacket";
import type { ZKProof } from "./ZKProof";
import type { ChatMessage } from "./ChatMessage";

/**
 * Represents a live harmonic chat session, sealed by a sigil
 * and anchored in Kai-Klok time. Supports full gossip, memory replay,
 * ZK-backed identity, and sovereign message presence.
 */
export interface ChatroomSession {
  /** Primary sigil metadata used to open or join the room */
  sigil: SigilMetadata;

  /** Canonical room ID (e.g. lineage root, userPhiKey, or topic hash) */
  roomId: string;

  /** Short human-readable label (topic, group name, or intention) */
  label?: string;

  /** Kai-Klok pulse this session was instantiated at (μpulse aligned) */
  pulse: number;

  /** Pulse resolution breakdown for temporal anchoring */
  kai: {
    beat: number;         // 0–35
    stepIndex: number;    // 0–43
    arc: string;          // e.g., "Ignition"
    weekday: string;      // e.g., "Kaelith"
    pulse: number;
    muPulse: number;      // micro pulse (μpulse)
    timestamp: number;    // UNIX bridge timestamp (if needed)
  };

  /** Lineage of sigils used to derive or inherit this chat */
  lineage: {
    parentSigilHash?: string;
    topicHash?: string;
    zkOriginProof?: ZKProof;
  };

  /** List of detected or verified participants (PhiKeys) */
  participants: string[];

  /** Optional map of presence metadata keyed by PhiKey */
  presence: Record<
    string,
    {
      lastSeenPulse: number;
      connected: boolean;
      nickname?: string;
      avatarUrl?: string;
    }
  >;

  /** All messages in this session, sorted by Kai pulse */
  messages: ChatMessage[];

  /** Pending local messages not yet confirmed by gossip */
  localEchoes: ChatMessage[];

  /** PhiPacket log — canonical, sovereign message transport unit */
  packetLog: PhiPacket[];

  /** Mute/block state per PhiKey (local) */
  muted?: Record<string, boolean>;
  blocked?: Record<string, boolean>;

  /** Whether this room is sealed with harmonic encryption */
  isEncrypted: boolean;

  /** Whether this session is ephemeral (not persisted to stream) */
  isEphemeral?: boolean;

  /** Optional avatar/sigil preview for this session */
  avatarSigilUrl?: string;

  /** Optional custom color/theme identity (Kai resonance aesthetic) */
  resonanceTheme?: {
    primaryHue: number;
    background: string;
    sigilGlow?: string;
  };

  // ────────────────────────────────────────────────
  // ACTION METHODS (bound to session context)
  // ────────────────────────────────────────────────

  /** Sends a new message to this chatroom as a PhiPacket */
  sendMessage: (text: string, zkProof?: ZKProof) => void;

  /** Replies to a specific message in the chat thread */
  replyToMessage: (
    text: string,
    parentMessage: ChatMessage,
    zkProof?: ZKProof
  ) => void;

  /** Broadcasts current presence to all known peers */
  broadcastPresence: () => void;

  /** Soft deletes a message locally (won’t affect peers) */
  deleteMessageLocal: (messageId: string) => void;

  /** Replaces local echo with confirmed message from gossip */
  confirmMessage: (tempId: string, confirmed: ChatMessage) => void;

  /** Loads more PhiPackets from disk, crystal, or gossip sync */
  loadHistory: (beforePulse: number, limit?: number) => Promise<void>;

  /** Clears local state but keeps session metadata intact */
  resetSession: () => void;
}
