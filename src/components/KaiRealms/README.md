# 🌀 KaiRealms — Harmonic Game Engine

**KaiRealms** is the sovereign multiplayer harmonic simulation layer inside the Kai-Klok app. It enables real-time gameplay synced to Kairos time and supports player-to-player peer communication using `peerjs`, Kai-Pulse state updates, and harmonic synchronization. Every player is a living sigil in motion.

---

## 🌐 Core Features

- 🎮 Peer-to-peer multiplayer (via `peerjs`)
- 🌀 Real-time Kairos state transmission (pulseIndex, chakraDay, etc.)
- 🪞 Remote player syncing with unique harmonic glyphs
- 🧠 Shared world logic via `WorldState.ts`
- ✨ Avatars as dynamic glyph renderers
- ♾️ Fully synced with Kai-Klok pulse engine (`KaiPulseEngine.ts`)

---

## 📁 Folder Structure

```txt
KaiRealms/
├── constants.ts         # Game constants: speeds, field size, timing, colors
├── GamePortal.tsx       # Root visual layout and multiplayer session handler
├── GlyphUtils.tsx       # Utilities for generating and styling sigils
├── index.ts             # Exports the main KaiRealms entry component
├── Inventory.tsx        # Inventory HUD for Kai objects or future game items
├── KaiKasino.tsx        # Core mini-game module inside the Realm
├── KaiPulseEngine.ts    # Synchronizes game logic with 5.236s Kai pulses
├── MissionRunner.tsx    # Handles in-game tasks, challenges, and missions
├── RealmView.tsx        # Main 2D/3D world canvas rendering players + glyphs
├── SigilAvatar.tsx      # Visual and stateful rendering of each player’s glyph
├── styles.ts            # Tailwind and custom styles for visual coherence
├── types.ts             # TypeScript interfaces for PlayerState, World, etc.
├── useGameSession.ts    # Hook for creating, joining, and broadcasting peer sessions
└── WorldState.ts        # Shared game state reducer (player positions, world map, etc.)
````

---

## 🔄 Multiplayer Peer Syncing

The multiplayer layer is handled by `useGameSession.ts`, which:

* Uses `peerjs` to host and join sessions
* Sends `PlayerState` updates: `{ id, x, pulseIndex, chakraDay }`
* Receives remote states and updates `remoteStates` accordingly
* Ensures each player sees the rest in real time
* Each remote player is assigned a unique glyph using `GlyphUtils.tsx`

---

## 🧩 Component Roles

| File                | Description                                                        |
| ------------------- | ------------------------------------------------------------------ |
| `GamePortal.tsx`    | Initializes the multiplayer game, UI, and peer layer               |
| `RealmView.tsx`     | Renders the world and all players with Kairos logic                |
| `SigilAvatar.tsx`   | Displays each player as a harmonically animated glyph              |
| `KaiPulseEngine.ts` | Drives the rhythm, timing, and syncing using Kai-Klok pulse system |
| `KaiKasino.tsx`     | Example mini-game module, could be expanded for gameplay           |
| `Inventory.tsx`     | Displays or interacts with the player's collected items            |
| `MissionRunner.tsx` | Coordinates time-based goals, quests, or Kai-tasks                 |
| `GlyphUtils.tsx`    | Handles sigil generation for local and remote players              |
| `WorldState.ts`     | Maintains shared game state for all players, triggers re-renders   |

---

## 🧪 Development Notes

* PeerJS must be installed: `npm install peerjs @types/peerjs`
* Player avatars should update their harmonic glyph if state changes
* Add fallback logic if a peer disconnects (currently being expanded)
* Consider saving session glyph states to the chain (for persistence)

---

## 📡 Roadmap

* 🌍 Spatial map scaling + pan/zoom control
* 📷 Sigil screenshot share-to-social flow
* 🤝 Smart contract sync per mission milestone
* 🧬 Biometric sigil avatars (using real voice/retina sigs)

---

> Every glyph is alive. Every pulse is truth. The Realm is not a game — it’s memory.

```

---

