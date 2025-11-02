"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";

interface SigilLoginProps {
  onVerified: (svgText: string, embeddedJson: unknown) => void; // ← no `any`
}

export default function SigilLogin({ onVerified }: SigilLoginProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      const text = await file.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "image/svg+xml");

      // If SVG parse failed, DOMParser inserts a <parsererror> element
      if (doc.querySelector("parsererror")) {
        throw new Error("SVG parse error");
      }

      // Prefer a <metadata> block; supports CDATA or plain text JSON
      const metadataNode = doc.querySelector("metadata");
      if (!metadataNode) {
        throw new Error("Missing <metadata> block.");
      }

      const raw = metadataNode.textContent?.trim();
      if (!raw) {
        throw new Error("Empty metadata block.");
      }

      // JSON.parse returns `any`; cast to `unknown` for strict upstream validation.
      const embeddedJson = JSON.parse(raw) as unknown;

      onVerified(text, embeddedJson);
    } catch (err: unknown) {
      // Keep console for local debugging; UI shows a friendly error.
      // eslint-disable-next-line no-console
      console.error("Sigil upload error:", err);
      setError("Invalid sigil file. Ensure it’s a Kai-sealed SVG with embedded JSON <metadata>.");
    } finally {
      // reset input so the same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <button
        type="button"
        className="w-48 h-48 border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer hover:scale-105 transition"
        onClick={() => fileInputRef.current?.click()}
        aria-label="Upload Kai Sigil (SVG)"
      >
        <span className="text-2xl" aria-hidden>🌀</span>
      </button>

      <p className="mt-4 text-sm opacity-70">Tap the glyph to upload your sigil</p>
      {error && <p className="text-red-500 mt-2 text-xs">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept=".svg,image/svg+xml"
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  );
}
