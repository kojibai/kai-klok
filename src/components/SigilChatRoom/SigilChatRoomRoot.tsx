"use client";

import { useMemo } from "react";
import ChatLog from "./ChatLog";
import MessageInput from "./MessageInput";
import SigilRoomStatus from "./SigilRoomStatus";
import PresenceBadge from "./PresenceBadge";
import { useChatSession } from "./hooks/useChatSession";
import { SigilContextProvider } from "./hooks/useSigilContext";
import KaiQR from "./KaiQR";
import { useKaiPulse } from "./hooks/useKaiPulse";
import { getUserPhiKey, getPhraseHash } from "./utils/identity";

/**
 * Main sovereign chat room container. Connects:
 * - Kai-pulse clock + presence status
 * - Shared sigil context for uploads + zkProofs
 * - Log + input wired to sovereign gossip
 */
export default function SigilChatRoomRoot() {
  const session = useChatSession(); // ChatZKSession | null
  const kaiPulse = useKaiPulse();

  // Safely derive userPhiKey (from session if available, else local identity)
  const userPhiKey = useMemo(() => {
    const maybe =
      session && typeof (session as { userPhiKey?: unknown }).userPhiKey === "string"
        ? (session as { userPhiKey: string }).userPhiKey
        : undefined;

    if (maybe && maybe.trim().length > 0) return maybe;

    try {
      return getUserPhiKey();
    } catch {
      return "anon";
    }
  }, [session]);

  // Phrase/frequency signatures for MessageInput
  const phraseSignature = useMemo(() => {
    try {
      return getPhraseHash();
    } catch {
      // Fallback: deterministic hash could be added; for now keep a stable placeholder
      return "phi:anon";
    }
  }, []);

  const frequencySignature = phraseSignature;

  // Connection heuristic: presence channel available on client
  const connected =
    typeof window !== "undefined" && typeof BroadcastChannel !== "undefined";

  return (
    <SigilContextProvider>
      <div className="w-full max-w-2xl mx-auto flex flex-col h-[calc(100dvh-100px)] px-2">
        {/* Header / Kai presence status */}
        <div className="flex items-center justify-between mb-2">
          <SigilRoomStatus pulse={kaiPulse} connected={connected} />
          <PresenceBadge userPhiKey={userPhiKey} kaiPulse={kaiPulse} />
        </div>

        {/* Chat log scroll zone */}
        <div className="flex-1 overflow-y-auto bg-black/10 rounded-xl border border-neutral-800 p-4 mb-2">
          <ChatLog />
        </div>

        {/* QR for sovereign sync / presence */}
        <div className="flex justify-center mb-2">
          <KaiQR uid={userPhiKey} />
        </div>

        {/* Message input */}
        <MessageInput
          userPhiKey={userPhiKey}
          phraseSignature={phraseSignature}
          frequencySignature={frequencySignature}
        />
      </div>
    </SigilContextProvider>
  );
}
