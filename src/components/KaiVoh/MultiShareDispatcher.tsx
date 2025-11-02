// /components/KaiVoh/MultiShareDispatcher.tsx
import { useMemo, useState } from "react";
import { useSession } from "./SessionManager";
import type { EmbeddedMediaResult } from "./SignatureEmbedder";

type SocialPlatform = "x" | "ig" | "tiktok" | "threads";

interface MultiShareDispatcherProps {
  media: EmbeddedMediaResult;
  onComplete: (result: { platform: SocialPlatform; link: string }[]) => void;
}

interface PostResult {
  platform: SocialPlatform;
  link: string;
}

interface PlatformStatus {
  platform: SocialPlatform;
  label: string;
  handle?: string;
  selected: boolean;
}

function isSocialPlatform(k: string): k is SocialPlatform {
  return k === "x" || k === "ig" || k === "tiktok" || k === "threads";
}

function ensureMaxLen(s: string, limit: number): string {
  if (s.length <= limit) return s;
  return s.slice(0, Math.max(0, limit - 1)) + "…";
}

function makeVerifyUrl(pulse: unknown, sig: unknown): string {
  const p = typeof pulse === "number" ? pulse : String(pulse ?? "");
  const s = typeof sig === "string" ? sig.slice(0, 10) : String(sig ?? "").slice(0, 10);
  return `https://kai.to/verify/${p}-${s}`;
}

/** Build a platform-specific caption (uses `platform` so no unused-var lint). */
function buildCaption(
  meta: Record<string, unknown>,
  platform: SocialPlatform,
  handle?: string
): string {
  const pulse = meta.pulse;
  const kaiSig = typeof meta.kaiSignature === "string" ? meta.kaiSignature : "";
  const shortSig = kaiSig.slice(0, 10);
  const phiKey = typeof meta.phiKey === "string" ? meta.phiKey : "φK";
  const link = makeVerifyUrl(pulse, kaiSig);

  const baseHashtags = ["#KaiKlok", "#SigilProof", "#PostedByBreath"];
  const platformHashtags: Record<SocialPlatform, string[]> = {
    x: baseHashtags,
    ig: [...baseHashtags, "#HarmonicTime"],
    tiktok: [...baseHashtags, "#KaiTime", "#ForYou"],
    threads: [...baseHashtags, "#Threads"],
  };

  const byline = handle ? ` by @${handle}` : "";

  if (platform === "x") {
    // Keep it under ~270 chars to be safe with link + emojis
    const oneLine = [
      `🌀 Pulse ${pulse}${byline}`,
      `Sig:${shortSig}`,
      `ID:${phiKey}`,
      `Verify:${link}`,
      ...platformHashtags.x,
    ].join(" • ");
    return ensureMaxLen(oneLine, 270);
  }

  if (platform === "ig") {
    // Multiline, hashtags at end. (Link not clickable but included for parity.)
    return [
      `🌀 Pulse ${pulse}${byline}`,
      `Sig: ${shortSig}`,
      `ID: ${phiKey}`,
      `Verify: ${link}`,
      "",
      platformHashtags.ig.join(" "),
    ].join("\n");
  }

  if (platform === "tiktok") {
    // Short, hashtag-forward, link up front for copyability.
    return [
      `Verify: ${link}`,
      `🌀 Pulse ${pulse}${byline}`,
      `Sig: ${shortSig} • ID: ${phiKey}`,
      platformHashtags.tiktok.join(" "),
    ].join("\n");
  }

  // threads
  return [
    `🌀 Pulse ${pulse}${byline}`,
    `Sig: ${shortSig} • ID: ${phiKey}`,
    `Verify: ${link}`,
    platformHashtags.threads.join(" "),
  ].join("\n");
}

export default function MultiShareDispatcher({
  media,
  onComplete,
}: MultiShareDispatcherProps) {
  const { session } = useSession();

  const targets = useMemo<PlatformStatus[]>(() => {
    const list: PlatformStatus[] = [];
    if (!session) return list;

    for (const [k, v] of Object.entries(session.connectedAccounts)) {
      if (isSocialPlatform(k) && v) {
        const label =
          k === "x" ? "X / Twitter" : k === "ig" ? "Instagram" : k === "tiktok" ? "TikTok" : "Threads";
        list.push({ platform: k, label, handle: v, selected: true });
      }
    }
    return list;
  }, [session]);

  const [selection, setSelection] = useState<Record<SocialPlatform, boolean>>(() => {
    const initial: Record<SocialPlatform, boolean> = { x: false, ig: false, tiktok: false, threads: false };
    for (const t of targets) initial[t.platform] = true;
    return initial;
  });

  const [status, setStatus] = useState<"idle" | "posting" | "done">("idle");
  const [results, setResults] = useState<PostResult[]>([]);

  const toggle = (p: SocialPlatform) => {
    setSelection((prev) => ({ ...prev, [p]: !prev[p] }));
  };

  async function postToPlatform(platform: SocialPlatform, handle?: string): Promise<{ link: string }> {
    const form = new FormData();
    form.append("file", media.content, media.filename);
    form.append("caption", buildCaption(media.metadata, platform, handle));
    if (handle) form.append("handle", handle);

    const res = await fetch(`/api/post/${platform}`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`POST /api/post/${platform} failed: ${res.status}`);
    const json = (await res.json()) as { url?: string };
    return { link: json.url ?? "#" };
  }

  const handlePostSelected = async () => {
    if (!session) return;
    setStatus("posting");

    const selectedTargets = targets.filter((t) => selection[t.platform]);
    const promises = selectedTargets.map(async (t) => {
      try {
        const r = await postToPlatform(t.platform, t.handle);
        return { platform: t.platform, link: r.link };
      } catch (e) {
        console.warn(`Post to ${t.platform} failed:`, e);
        return { platform: t.platform, link: "❌ Failed" };
      }
    });

    const posted = await Promise.all(promises);
    setResults(posted);
    onComplete(posted);
    setStatus("done");
  };

  const allDisabled = targets.length === 0 || !targets.some((t) => selection[t.platform]);

  return (
    <div className="flex flex-col items-center gap-5 p-6 w-full max-w-xl">
      <h2 className="text-lg opacity-80">Broadcast to connected socials</h2>

      {/* Selection grid */}
      <div className="grid grid-cols-2 gap-3 w-full">
        {targets.map((t) => (
          <label
            key={t.platform}
            className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition ${
              selection[t.platform]
                ? "border-green-500 bg-green-500/10"
                : "border-white/30 bg-white/5"
            }`}
          >
            <input
              type="checkbox"
              className="accent-green-500"
              checked={!!selection[t.platform]}
              onChange={() => toggle(t.platform)}
            />
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {t.label} {t.handle ? `· @${t.handle}` : ""}
              </span>
              <span className="text-xs opacity-60">Post as selected</span>
            </div>
          </label>
        ))}
      </div>

      {/* Action button */}
      {status === "idle" && (
        <button
          disabled={allDisabled}
          className={`px-6 py-2 rounded text-white transition ${
            allDisabled ? "bg-gray-500 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
          onClick={handlePostSelected}
        >
          {allDisabled ? "No platforms selected" : "Post to Selected"}
        </button>
      )}

      {status === "posting" && (
        <p className="opacity-60 animate-pulse">Posting with breath…</p>
      )}

      {/* Results */}
      {status === "done" && (
        <div className="w-full">
          <h3 className="text-sm opacity-70 mb-2">Post Results</h3>
          <ul className="text-sm space-y-1">
            {results.map((r) => (
              <li key={r.platform} className="flex items-center gap-2">
                <span className="font-bold min-w-[72px] capitalize">{r.platform}</span>
                <span>:</span>
                {r.link === "❌ Failed" ? (
                  <span className="text-red-400">{r.link}</span>
                ) : (
                  <a
                    href={r.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline break-all"
                  >
                    {r.link}
                  </a>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <button
              className="px-4 py-2 rounded bg-gray-700 text-white"
              onClick={() => setStatus("idle")}
            >
              Post Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
