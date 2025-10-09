// src/pages/SigilFeedPage.tsx
import { useEffect, useMemo, useState } from "react";
import FeedCard from "../components/FeedCard";
import "./SigilFeedPage.css";

type Source = { url: string };

async function loadLinks(): Promise<Source[]> {
  try {
    const r = await fetch("/links.json", { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch { return []; }
}

export default function SigilFeedPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [paste, setPaste] = useState("");

  useEffect(() => { loadLinks().then(setSources); }, []);

  const urls = useMemo(() => sources.map(s => s.url), [sources]);

  const addUrls = () => {
    const list = paste.split(/\s+/).map(s=>s.trim()).filter(Boolean);
    if (!list.length) return;
    setSources(s => [...list.map(u => ({ url: u })), ...s]);
    setPaste("");
  };

  return (
    <main className="sf">
      <header className="sf-head">
        <h1>Glyph Stream</h1>
        <p>Paste any sigil/action URLs (with <code>?p=c:…</code>) below. The feed will decode them on the fly.</p>
        <div className="sf-add">
          <textarea rows={3} placeholder="Paste one per line or spaced…" value={paste} onChange={e=>setPaste(e.target.value)} />
          <button onClick={addUrls}>Add to Feed</button>
        </div>
      </header>

      <section className="sf-list">
        {urls.length === 0 && <div className="sf-empty">No items yet. Seed <code>public/links.json</code> or paste some URLs.</div>}
        {urls.map(u => <FeedCard key={u} url={u} />)}
      </section>
    </main>
  );
}
