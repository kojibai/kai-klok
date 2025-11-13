// /src/pages/SigilFeedPage.tsx
"use client";

/**
 * Memory Stream — mobile-first, Eternal-Klok aligned
 * v6.1 — /p~ short alias + label-based pickers; legacy /p#t= and /p?t= expand.
 * Canonical: /stream/p/<token>[?add=<parentUrl>]
 * Short alias: /p~<token>
 */

import React from "react";
import { SigilStreamRoot } from "./sigilstream";
import "./SigilFeedPage.css";
import "../utils/kopyFeedback"

export default function SigilFeedPage(): React.JSX.Element {
  return <SigilStreamRoot />;
}
