"use client";

import { useEffect, useRef, useState } from "react";
import { useChatSession } from "./hooks/useChatSession";
import { useBreathSocket } from "./lib/BreathSocket";
import { fetchMessagesForChat } from "./lib/PhiGossip";
import PresenceBadge from "./PresenceBadge";
import type { PhiPacket } from "./types/PhiPacket";

type ChatMessage = {
  chatUID: string;
  body: string;
  timestamp: number;
  pulse: number;
  userPhiKey: string;
  phraseSignature: string;
  frequencySignature: string;
  zkProof?: Record<string, unknown>;
  publicSignals?: string[];
};

/** Narrow unknown → PhiPacket without casting payload to Record */
function isPhiPacket(x: unknown): x is PhiPacket {
  if (typeof x !== "object" || x === null) return false;
  const obj = x as { [k: string]: unknown };
  return (
    typeof obj.kaiSignature === "string" &&
    typeof obj.sender === "string" &&
    typeof obj.payload === "object" &&
    obj.payload !== null &&
    (obj as { kind?: unknown; type?: unknown }).kind !== undefined // just sanity
  );
}

/** Convert a PhiPacket → ChatMessage (safe, no Record casts) */
function packetToChatMessage(pkt: PhiPacket, defaultChatUID: string): ChatMessage | null {
  // Only render message packets
  const kind = pkt.type ?? pkt.kind;
  if (kind !== "message") return null;

  // Defaults
  let body = "";
  let from = pkt.from ?? pkt.sender ?? "";
  let lineage = pkt.lineageTag;

  // Prefer nested payload.message
  if (pkt.payload.kind === "message") {
    const m = pkt.payload.message as unknown as {
      text?: unknown;
      body?: unknown;
      senderPhiKey?: unknown;
      lineageTag?: unknown;
    };

    if (typeof m.text === "string") body = m.text;
    else if (typeof m.body === "string") body = m.body;

    if (!from && typeof m.senderPhiKey === "string") from = m.senderPhiKey;
    if (!lineage && typeof m.lineageTag === "string") lineage = m.lineageTag;
  }

  // Fallback to flattened convenience fields
  if (!body && typeof (pkt as unknown as { message?: unknown }).message === "string") {
    body = (pkt as unknown as { message: string }).message;
  }

  const chatUID = lineage ?? defaultChatUID;
  const pulse = pkt.kai?.pulse ?? pkt.pulse ?? 0;
  const timestamp = pkt.kai?.timestamp ?? Date.now();

  const phraseSignature = pkt.kaiSignature;
  const frequencySignature = pkt.kaiSignature;

  return {
    chatUID,
    body,
    timestamp,
    pulse,
    userPhiKey: from,
    phraseSignature,
    frequencySignature,
    zkProof: undefined,
    publicSignals: undefined,
  };
}

export default function ChatLog() {
  // useChatSession returns ChatZKSession | null; derive room id from userPhiKey
  const session = useChatSession();
  const chatUID = session?.userPhiKey ?? "default-room";

  const { pulse } = useBreathSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Autoscroll on new messages
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  // Initial load + live updates
  useEffect(() => {
    async function loadInitial() {
      const cachedPackets = await fetchMessagesForChat(chatUID);
      const transformed = cachedPackets
        .map((pkt) => packetToChatMessage(pkt, chatUID))
        .filter((m): m is ChatMessage => m !== null);
      setMessages(transformed);
    }
    void loadInitial();

    const eventName = "phigossip:new-message";
    const listener = (e: Event) => {
      const custom = e as CustomEvent<unknown>;
      const detail = custom.detail;

      if (isPhiPacket(detail)) {
        const mapped = packetToChatMessage(detail, chatUID);
        if (mapped && mapped.chatUID === chatUID) {
          setMessages((prev) => [...prev, mapped]);
        }
        return;
      }

      if (typeof detail === "object" && detail !== null) {
        const maybeMsg = detail as Partial<ChatMessage>;
        if (
          typeof maybeMsg.chatUID === "string" &&
          typeof maybeMsg.body === "string" &&
          typeof maybeMsg.pulse === "number" &&
          typeof maybeMsg.timestamp === "number" &&
          typeof maybeMsg.userPhiKey === "string"
        ) {
          if (maybeMsg.chatUID === chatUID) {
            setMessages((prev) => [...prev, maybeMsg as ChatMessage]);
          }
        }
      }
    };

    window.addEventListener(eventName, listener);
    return () => window.removeEventListener(eventName, listener);
  }, [chatUID, pulse]);

  return (
    <div
      ref={containerRef}
      className="chat-log flex-1 overflow-y-auto px-4 py-6 space-y-5"
    >
      {messages.map((msg) => (
        <div key={`${msg.timestamp}-${msg.userPhiKey}`} className="bg-neutral-800/50 rounded-xl p-4 shadow-md">
          <div className="flex justify-between items-center text-xs text-neutral-400 mb-1">
            <PresenceBadge userPhiKey={msg.userPhiKey} />
            <span>P{msg.pulse}</span>
          </div>
          <div className="text-white text-base whitespace-pre-wrap break-words">
            {msg.body}
          </div>
        </div>
      ))}
    </div>
  );
}
