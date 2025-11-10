// src/components/KaiRealms/KaiMaze/engine/input.ts
import type { Dir, Entity } from "./types";

export function enqueueDir(e: Entity, d: Dir): void {
  e.nextDir = d;
}

export function keyToDir(key: string): Dir {
  const k = key.toLowerCase();
  if (k === "arrowup" || k === "w") return "up";
  if (k === "arrowdown" || k === "s") return "down";
  if (k === "arrowleft" || k === "a") return "left";
  if (k === "arrowright" || k === "d") return "right";
  return "none";
}
