"use client";

import React, { useState, useRef, useCallback } from "react";
import { SendHorizonal, Loader2 } from "lucide-react";
import { useChatSession } from "./hooks/useChatSession";
import { getKaiPulseEternalInt } from "../../SovereignSolar";
import { generateSigilZKProof } from "./lib/SigilZK";
import { gossipMessage } from "./lib/PhiGossip";
import { useBreathSocket } from "./lib/BreathSocket";
import { verifyUserPhiKeyIdentity } from "./utils/identity";
import "./MessageInput.css";

type MessageInputProps = {
  userPhiKey: string;
  phraseSignature: string;
  frequencySignature: string;
};

export default function MessageInput({
  userPhiKey,
  phraseSignature,
  frequencySignature,
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // useChatSession returns ChatZKSession | null; derive a stable chatUID
  const session = useChatSession();
  const chatUID = session?.userPhiKey ?? "default-room";

  const { pulse } = useBreathSocket(); // live pulse sync

  const send = useCallback(async () => {
    if (!message.trim()) return;
    setLoading(true);

    const kaiPulse = pulse ?? getKaiPulseEternalInt();

    try {
      const { proof, publicSignals } = await generateSigilZKProof({
        pulse: kaiPulse,
        userPhiKey,
        phraseHash: phraseSignature,
      });

      const verified = verifyUserPhiKeyIdentity(proof, publicSignals, userPhiKey);
      if (!verified) {
        throw new Error("ZK proof failed identity verification.");
      }

      await gossipMessage({
        chatUID,
        body: message.trim(),
        timestamp: Date.now(),
        pulse: kaiPulse,
        userPhiKey,
        phraseSignature,
        frequencySignature,
        zkProof: proof,
        publicSignals,
      });

      setMessage("");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to send:", err);
    } finally {
      setLoading(false);
    }
  }, [message, userPhiKey, phraseSignature, frequencySignature, pulse, chatUID]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="message-input">
      <input
        ref={inputRef}
        type="text"
        placeholder="Send a harmonic message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={loading}
        className="w-full bg-transparent border-none outline-none text-lg px-4 py-3 placeholder:text-neutral-400"
      />
      <button
        onClick={() => void send()}
        disabled={loading || !message.trim()}
        className="px-3 text-white hover:text-cyan-400 transition"
      >
        {loading ? (
          <Loader2 className="animate-spin h-5 w-5" />
        ) : (
          <SendHorizonal className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}
