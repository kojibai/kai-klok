"use client";

import React, { useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { cn } from "./utils/cn";
import { useSigilContext } from "./hooks/useSigilContext";

interface SigilUploaderProps {
  className?: string;
}

/**
 * SigilUploader lets users drag & drop or browse for a KaiSigil PNG/SVG
 * to attach to their sovereign chat message.
 */
export default function SigilUploader({ className }: SigilUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { attachedSigil, setAttachedSigil, loadSigilFile } = useSigilContext();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelect(file: File) {
    try {
      setError(null);
      // This constructs a proper SigilAsset (kind/mime/objectUrl/meta/stagedAt)
      await loadSigilFile(file);
      // loadSigilFile already stages it; nothing else required.
    } catch {
      setError("Could not read sigil metadata.");
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFileSelect(file);
  }

  return (
    <div
      className={cn(
        "relative w-full border border-dashed rounded-xl p-4 text-center transition-all duration-300",
        dragging ? "bg-teal-900/20 border-teal-400" : "border-neutral-600/40",
        className
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {attachedSigil ? (
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs truncate max-w-[70%] text-white/80 font-mono">
            🌀 {attachedSigil.name} ({attachedSigil.size} bytes)
          </div>
          <button
            className="text-red-400 hover:text-red-600"
            onClick={(e) => {
              e.stopPropagation();
              setAttachedSigil(null);
            }}
            aria-label="Remove attached sigil"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center text-neutral-400 text-xs space-y-2">
          <UploadCloud size={20} />
          <span>Click or drag a KaiSigil PNG/SVG here</span>
        </div>
      )}

      <input
        type="file"
        ref={inputRef}
        accept=".png,.svg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFileSelect(file);
        }}
      />

      {error && (
        <div className="text-red-400 text-xs mt-2 font-mono">{error}</div>
      )}
    </div>
  );
}
