"use client";

import { useEffect, useRef, useState } from "react";
import blake from "blakejs";
import { fetchKai } from "../../utils/kai_pulse"; // Canonical Kai Pulse engine
import type { ComposedPost } from "./PostComposer"; // ✅ type-only import for verbatimModuleSyntax

export interface SealedPost {
  pulse: number;
  kaiSignature: string;
  chakraDay: string;
  post: ComposedPost;
}

interface BreathSealerProps {
  post: ComposedPost;
  onSealComplete: (sealed: SealedPost) => void;
}

export default function BreathSealer({ post, onSealComplete }: BreathSealerProps) {
  const [breathPhase, setBreathPhase] = useState<"idle" | "inhale" | "exhale" | "sealed">("idle");
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const PULSE_MS = 5236;

  const startBreathCycle = () => {
    setBreathPhase("inhale");
    setProgress(0);

    const start = Date.now();
    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(elapsed / PULSE_MS, 1));

      if (elapsed >= PULSE_MS) {
        window.clearInterval(intervalRef.current!);
        setBreathPhase("exhale");

        setTimeout(() => {
          sealNow();
        }, PULSE_MS);
      }
    }, 50);
  };

  const sealNow = async () => {
    const { pulse, chakraDay } = await fetchKai(); // ✅ Uses the real Kai Moment structure

    const keyMaterial = `${post.file.name}-${pulse}`;
    const kaiSignature = blake.blake2bHex(keyMaterial, undefined, 32);

    onSealComplete({
      pulse,
      kaiSignature,
      chakraDay,
      post,
    });

    setBreathPhase("sealed");
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 p-6 text-center">
      {/* Pulse Orb */}
      <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-purple-400 to-pink-500 animate-pulse flex items-center justify-center text-white text-2xl">
        {breathPhase === "idle" && "🌬"}
        {breathPhase === "inhale" && "🫁"}
        {breathPhase === "exhale" && "🌀"}
        {breathPhase === "sealed" && "✅"}
      </div>

      <p className="opacity-70 text-sm">
        {breathPhase === "idle" && "Start your breath"}
        {breathPhase === "inhale" && `Inhale… (${Math.round(progress * 100)}%)`}
        {breathPhase === "exhale" && "Exhale… sealing"}
        {breathPhase === "sealed" && "Sealed in resonance!"}
      </p>

      {breathPhase === "idle" && (
        <button
          onClick={startBreathCycle}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-all"
        >
          Begin Breath
        </button>
      )}
    </div>
  );
}
