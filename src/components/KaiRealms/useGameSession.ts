// src/components/KaiRealms/useGameSession.ts
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { DataConnection } from "peerjs"; // types only
import type { PlayerState, RemotePlayerState } from "./types";
import type { GlyphData } from "./GlyphUtils";

export type UseGameSessionResult = {
  sessionId: string;
  peers: string[];
  sendState: (state: PlayerState) => void;
  remoteStates: RemotePlayerState[];
};

function generateSessionId(): string {
  return `kai-${Math.random().toString(36).slice(2, 8)}`;
}

function isValidPlayerState(obj: unknown): obj is PlayerState {
  if (typeof obj !== "object" || obj === null) return false;
  const s = obj as Partial<PlayerState>;
  return (
    typeof s.x === "number" &&
    typeof s.pulseIndex === "number" &&
    typeof s.chakraDay === "string" &&
    typeof s.glyph === "object" &&
    s.glyph !== null
  );
}

/** Lazy-load Peer only on the client to avoid SSR/prebundle issues */
type PeerCtor = typeof import("peerjs").default;
type PeerInstance = InstanceType<PeerCtor>;

let _PeerCtor: PeerCtor | null = null;

async function getPeerCtor(): Promise<PeerCtor> {
  if (_PeerCtor) return _PeerCtor;
  const mod = await import("peerjs");
  _PeerCtor = mod.default;
  return _PeerCtor;
}

export function useGameSession(sessionIdInput?: string): UseGameSessionResult {
  const [sessionId] = useState<string>(() => sessionIdInput ?? generateSessionId());
  const [peers, setPeers] = useState<string[]>([]);
  const [remoteStates, setRemoteStates] = useState<RemotePlayerState[]>([]);

  const peerRef = useRef<PeerInstance | null>(null);
  const connectionsRef = useRef<Record<string, DataConnection>>({});

  const upsertRemoteState = useCallback((peerId: string, state: PlayerState) => {
    if (!isValidPlayerState(state)) return;

    const next: RemotePlayerState = {
      ...state,
      id: peerId,
      glyph: state.glyph as GlyphData,
    };

    setRemoteStates((prev) => {
      const idx = prev.findIndex((p) => p.id === peerId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = next;
        return copy;
      }
      return [...prev, next];
    });
  }, []);

  const handleData = useCallback(
    (data: unknown, peerId: string) => {
      if (isValidPlayerState(data)) upsertRemoteState(peerId, data);
    },
    [upsertRemoteState]
  );

  useEffect(() => {
    let destroyed = false;

    (async () => {
      const Peer = await getPeerCtor();
      if (destroyed) return;

      const peer = new Peer(sessionId);
      peerRef.current = peer;

      // Non-empty handler to satisfy strict linters
      const handleOpen = (): void => {
        // touch state to acknowledge readiness without causing re-render loops
        setPeers((prev) => prev);
      };

      peer.on("open", handleOpen);

      peer.on("connection", (conn: DataConnection) => {
        connectionsRef.current[conn.peer] = conn;
        setPeers((prev) => Array.from(new Set([...prev, conn.peer])));

        conn.on("data", (payload: unknown) => {
          handleData(payload, conn.peer);
        });

        conn.on("close", () => {
          delete connectionsRef.current[conn.peer];
          setPeers((prev) => prev.filter((p) => p !== conn.peer));
          setRemoteStates((prev) => prev.filter((r) => r.id !== conn.peer));
        });
      });
    })().catch((e: unknown) => {
      // surface initialization failures
      // eslint-disable-next-line no-console
      console.error("[KaiRealms] Peer init failed:", e);
    });

    return () => {
      destroyed = true;
      try {
        peerRef.current?.destroy();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[KaiRealms] Peer destroy failed:", e);
      }
      peerRef.current = null;
      connectionsRef.current = {};
      setPeers([]);
      setRemoteStates([]);
    };
  }, [sessionId, handleData]);

  const sendState = useCallback((state: PlayerState) => {
    const conns = Object.values(connectionsRef.current);
    for (const conn of conns) {
      if (conn.open) {
        conn.send(state);
      }
    }
  }, []);

  return { sessionId, peers, sendState, remoteStates };
}
