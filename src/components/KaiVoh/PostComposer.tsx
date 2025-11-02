"use client";

import React, { useRef, useState } from "react";

export interface ComposedPost {
  mediaType: "image" | "video";
  file: File;
  caption?: string;
}

interface PostComposerProps {
  onReady: (post: ComposedPost) => void;
}

export default function PostComposer({ onReady }: PostComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [caption, setCaption] = useState<string>("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const type = file.type.startsWith("video") ? "video" : "image";

    setPreviewUrl(url);
    setMediaType(type);
  };

  const handleProceed = () => {
    if (!previewUrl || !mediaType || !fileInputRef.current?.files?.[0]) return;

    onReady({
      mediaType,
      file: fileInputRef.current.files[0],
      caption: caption.trim() || undefined,
    });
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6 w-full">
      <div
        className="w-48 h-48 border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer hover:scale-105 transition"
        onClick={() => fileInputRef.current?.click()}
      >
        <span className="text-xl">{previewUrl ? "🔄" : "📁"}</span>
      </div>

      {previewUrl && (
        <div className="w-full max-w-md mt-4">
          {mediaType === "image" && (
            <img src={previewUrl} alt="preview" className="rounded-xl w-full" />
          )}
          {mediaType === "video" && (
            <video src={previewUrl} controls className="rounded-xl w-full" />
          )}
          <textarea
            placeholder="Optional caption..."
            className="w-full mt-4 p-2 rounded bg-black/10 text-white text-sm resize-none"
            rows={3}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>
      )}

      {previewUrl && (
        <button
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded mt-2"
          onClick={handleProceed}
        >
          Seal with Breath
        </button>
      )}

      <input
        type="file"
        accept="image/*,video/*"
        ref={fileInputRef}
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
