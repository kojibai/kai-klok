// src/pages/sigilstream/attachments/embeds.tsx
"use client";


/* ─────────────────────────────────────────────────────────────
   Local helpers (URL parsing + file-type detection)
   ───────────────────────────────────────────────────────────── */

function extFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").pop() || "";
    const dot = last.lastIndexOf(".");
    return dot >= 0 ? last.slice(dot + 1).toLowerCase() : "";
  } catch {
    return "";
  }
}

function isImageExt(ext: string): boolean {
  return ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp"].includes(ext);
}

function isVideoExt(ext: string): boolean {
  return ["mp4", "webm", "ogg", "ogv", "mov", "m4v"].includes(ext);
}

function isPdfExt(ext: string): boolean {
  return ext === "pdf";
}

function ytIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.slice(1);
      return id || null;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      // /embed/<id>
      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.indexOf("embed");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    }
    return null;
  } catch {
    return null;
  }
}

function vimeoIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("vimeo.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const idPart = parts.find((p) => /^\d+$/.test(p));
    return idPart || null;
  } catch {
    return null;
  }
}

function spotifyEmbedFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("spotify.com")) return null;
    // Support /track/, /album/, /playlist/
    if (
      u.pathname.startsWith("/track/") ||
      u.pathname.startsWith("/album/") ||
      u.pathname.startsWith("/playlist/")
    ) {
      return `https://open.spotify.com/embed${u.pathname}${u.search}`;
    }
    return null;
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   Small presentational pieces
   ───────────────────────────────────────────────────────────── */

export function Favicon({ host }: { host: string }) {
  const src = `https://${host}/favicon.ico`;
  return (
    <img
      src={src}
      alt=""
      width={16}
      height={16}
      loading="lazy"
      decoding="async"
      style={{ borderRadius: 3 }}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
}

export function LinkCard({ url, title }: { url: string; title?: string }) {
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    /* ignore */
  }

  return (
    <a
      className="sf-att-link"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="sf-att-link__row">
        {host && <Favicon host={host} />}
        <div className="sf-att-link__text">
          <div className="sf-att-link__title">{title || host || "Open link"}</div>
          <div className="sf-att-link__url">{url}</div>
        </div>
      </div>
    </a>
  );
}

export function IframeEmbed({ src, title }: { src: string; title: string }) {
  return (
    <div className="sf-embed">
      <iframe
        src={src}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        // Constrain powers for third-party content
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}

/**
 * UrlEmbed renders a smart preview:
 * - YouTube / Vimeo / Spotify → iframe player
 * - Direct image/video/pdf → inline media
 * - Otherwise → LinkCard
 */
export function UrlEmbed({ url, title }: { url: string; title?: string }) {
  // Media & rich embeds
  const yt = ytIdFromUrl(url);
  if (yt) return <IframeEmbed src={`https://www.youtube.com/embed/${yt}`} title={title || "YouTube"} />;

  const vimeo = vimeoIdFromUrl(url);
  if (vimeo) return <IframeEmbed src={`https://player.vimeo.com/video/${vimeo}`} title={title || "Vimeo"} />;

  const spot = spotifyEmbedFromUrl(url);
  if (spot) return <IframeEmbed src={spot} title={title || "Spotify"} />;

  // Direct file assets
  const ext = extFromUrl(url);

  if (isImageExt(ext)) {
    return (
      <div className="sf-media sf-media--image">
        <img src={url} alt={title || "image"} loading="lazy" decoding="async" />
      </div>
    );
  }

  if (isVideoExt(ext)) {
    return (
      <div className="sf-media sf-media--video">
        <video src={url} controls playsInline preload="metadata" />
      </div>
    );
  }

  if (isPdfExt(ext)) {
    return (
      <div className="sf-embed sf-embed--doc">
        <iframe src={url} title={title || "Document"} loading="lazy" />
      </div>
    );
  }

  // Fallback: basic link card
  return <LinkCard url={url} title={title} />;
}
