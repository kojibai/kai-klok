"use client";

/**
 * useBreathSocket — breath-linked presence + chat (offline, no servers)
 *
 * Transport: BroadcastChannel("sigil-room") only.
 * Math: kaiPulse = floor((now - GENESIS) / 5236ms)
 * Peers: heartbeat every ~2.5s; prune if stale (>12s)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SigilAsset } from "./useSigilContext";

const GENESIS_UTC_MS = Date.UTC(2024, 4, 10, 6, 45, 41, 888); // 2024-05-10 06:45:41.888Z
const PULSE_MS = 5236; // 3 + √5 seconds ≈ 5.236s
const HEARTBEAT_MS = 2500;
const PEER_TTL_MS = 12000;

export type ChatMessage = {
  id: string;
  content: string;
  sender: string; // userPhiKey preferred
  name?: string | null;
  pulse: number; // kaiPulse when sent
  sigil?: SigilAsset | null;
  ts: number; // epoch ms
};

export type Peer = {
  id: string;
  name?: string | null;
  pulse: number;
  lastSeen: number; // epoch ms
};

type WireEnvelope =
  | { type: "presence"; id: string; name?: string | null; pulse: number; ts: number }
  | { type: "chat"; payload: ChatMessage };

type UseBreathSocket = {
  messages: ChatMessage[];
  sendMessage: (m: {
    content: string;
    sender: string;
    name?: string | null;
    pulse: number;
    sigil?: SigilAsset | null;
  }) => void;
  connected: boolean;
  kaiPulse: number;
  peers: Peer[];
};

function nanoId(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function computeKaiPulse(nowMs: number): number {
  const delta = nowMs - GENESIS_UTC_MS;
  if (delta <= 0) return 0;
  return Math.floor(delta / PULSE_MS);
}

export function useBreathSocket(): UseBreathSocket {
  const selfIdRef = useRef<string>(nanoId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [kaiPulse, setKaiPulse] = useState<number>(() => computeKaiPulse(Date.now()));
  const peersMapRef = useRef<Map<string, Peer>>(new Map());

  // ── Pulse ticker (aligns near pulse boundaries) ─────────────────────────────
  useEffect(() => {
    let raf = 0;
    let timer: number | null = null;

    const tick = () => {
      const now = Date.now();
      const nextPulseAt = GENESIS_UTC_MS + (computeKaiPulse(now) + 1) * PULSE_MS;
      const wait = Math.max(8, nextPulseAt - now);
      setKaiPulse(computeKaiPulse(now));
      timer = window.setTimeout(() => {
        raf = window.requestAnimationFrame(tick);
      }, wait);
    };

    tick();
    return () => {
      if (timer !== null) clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, []);

  // ── BroadcastChannel transport only ─────────────────────────────────────────
  const bcRef = useRef<BroadcastChannel | null>(null);

  const postWire = useCallback((wire: WireEnvelope) => {
    const bc = bcRef.current;
    if (bc) bc.postMessage(wire);
  }, []);

  useEffect(() => {
    try {
      bcRef.current = new BroadcastChannel("sigil-room");
      setConnected(true);
    } catch {
      bcRef.current = null;
      setConnected(false);
    }

    const bc = bcRef.current;
    if (bc) {
      bc.onmessage = (ev: MessageEvent) => {
        const msg = ev.data as WireEnvelope;
        if (!msg || typeof msg !== "object") return;

        if (msg.type === "presence") {
          const { id, name, pulse, ts } = msg;
          const now = Date.now();
          peersMapRef.current.set(id, {
            id,
            name: name ?? null,
            pulse,
            lastSeen: typeof ts === "number" ? ts : now,
          });
          // touch state to refresh derived peers (cheap)
          setMessages((prev) => prev.slice());
        } else if (msg.type === "chat") {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.payload.id)) return prev;
            return [...prev, msg.payload].slice(-500);
          });
        }
      };
    }

    return () => {
      if (bc) {
        bc.onmessage = null;
        try {
          bc.close();
        } catch {
          /* noop */
        }
      }
      bcRef.current = null;
      setConnected(false);
    };
  }, []);

  // ── Presence heartbeat + pruning ────────────────────────────────────────────
  useEffect(() => {
    let hbTimer: number | null = null;
    let pruneTimer: number | null = null;

    const beat = () => {
      postWire({
        type: "presence",
        id: selfIdRef.current,
        name: null,
        pulse: kaiPulse,
        ts: Date.now(),
      });
    };

    const prune = () => {
      const now = Date.now();
      let changed = false;
      for (const [id, p] of peersMapRef.current) {
        if (now - p.lastSeen > PEER_TTL_MS) {
          peersMapRef.current.delete(id);
          changed = true;
        }
      }
      if (changed) {
        setMessages((prev) => prev.slice());
      }
    };

    beat();
    hbTimer = window.setInterval(beat, HEARTBEAT_MS);
    pruneTimer = window.setInterval(prune, 2000);

    return () => {
      if (hbTimer !== null) clearInterval(hbTimer);
      if (pruneTimer !== null) clearInterval(pruneTimer);
    };
  }, [postWire, kaiPulse]);

  // ── Send chat message ───────────────────────────────────────────────────────
  const sendMessage = useCallback<UseBreathSocket["sendMessage"]>(
    (m) => {
      const msg: ChatMessage = {
        id: nanoId(),
        content: m.content,
        sender: m.sender,
        name: m.name ?? null,
        pulse: m.pulse,
        sigil: m.sigil ?? null,
        ts: Date.now(),
      };

      setMessages((prev) => [...prev, msg].slice(-500));
      postWire({ type: "chat", payload: msg });
    },
    [postWire]
  );

  // ── Derived peers array (stable, sorted by recency) ─────────────────────────
  const peers = useMemo<Peer[]>(() => {
    return Array.from(peersMapRef.current.values()).sort((a, b) => b.lastSeen - a.lastSeen);
  }, [messages.length]); // refresh reference cheaply when messages change

  return {
    messages,
    sendMessage,
    connected,
    kaiPulse,
    peers,
  };
}
