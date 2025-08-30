// src/types/ChatMessage.ts

import type { ZKProof } from "./ZKProof";

export interface ChatMessage {
  /** Unique message ID (KaiSignature hash or temporary UUID) */
  id: string;

  /** Sender's PhiKey (permanent identity) */
  senderPhiKey: string;

  /** Optional local alias / nickname for display */
  senderAlias?: string;

  /** Kai time breakdown for display and sort */
  kai: {
    pulse: number;
    beat: number;
    stepIndex: number;
    muPulse: number;
    timestamp: number;
    arc: string;
    weekday: string;
  };

  /** Message content (plain text) */
  text: string;

  /** ZK proof of sender identity */
  zkProof: ZKProof;

  /** Parent ID if this is a reply */
  parentId?: string;

  /** Reactions (emoji → PhiKeys) */
  reactions?: Record<string, string[]>;

  /** Attachments (if present) */
  attachments?: {
    name: string;
    url: string;
    mime: string;
    size: number;
  }[];

  /** Delivery status (local echo, sent, confirmed) */
  status?: "local" | "pending" | "confirmed" | "failed";
}
