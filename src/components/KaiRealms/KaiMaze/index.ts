// src/components/KaiRealms/KaiMaze/index.ts

// Component re-exports (both default and named)
export { default } from "./KaiMaze";
export { default as KaiMaze } from "./KaiMaze";

// Optional: surface engine APIs & types for power users
export * as KaiMazeEngine from "./engine/engine";
export * as KaiMazeConstants from "./engine/constants";
export type {
  Vec2,
  Dir,
  Tile,
  Grid,
  EntityKind,
  Entity,
  Ghost,
  GameState,
} from "./engine/types";
