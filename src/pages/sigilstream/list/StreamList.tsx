// src/pages/sigilstream/list/StreamList.tsx
"use client";

import type React from "react";
import FeedCard from "../../../components/FeedCard";

type Props = {
  /** Ordered list of canonical item URLs to render */
  urls: string[];
};

/**
 * StreamList — maps an ordered array of URLs to <FeedCard/>.
 * Mobile-first, minimal DOM, safe to embed anywhere.
 */
export function StreamList({ urls }: Props): React.JSX.Element {
  if (!urls || urls.length === 0) {
    return (
      <section className="sf-list">
        <div className="sf-empty">
          No items yet. Paste a link above or open a <code>/stream/p/&lt;payload&gt;</code> link and reply to start a thread.
        </div>
      </section>
    );
  }

  return (
    <section className="sf-list" aria-label="Memory Stream">
      {urls.map((u) => (
        <FeedCard key={u} url={u} />
      ))}
    </section>
  );
}

export default StreamList;
