// src/pages/sigilstream/payload/usePayload.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import type { FeedPostPayload } from "../../../utils/feedPayload";
import { decodeFeedPayload, extractPayloadToken } from "../../../utils/feedPayload";
import type { KaiMomentStrict } from "../core/types";
import { kaiMomentFromAbsolutePulse } from "../core/kai_time";
import { report } from "../core/utils";
import { prependUniqueToStorage } from "../data/storage";
import type { AttachmentManifest } from "../attachments/types";
import { isAttachmentManifest } from "../attachments/types";

type Source = { url: string };

export function usePayload(
  setSources: React.Dispatch<React.SetStateAction<Source[]>>,
): {
  payload: FeedPostPayload | null;
  payloadKai: KaiMomentStrict | null;
  payloadError: string | null;
  payloadAttachments: AttachmentManifest | null;
} {
  const [payload, setPayload] = useState<FeedPostPayload | null>(null);
  const [payloadKai, setPayloadKai] = useState<KaiMomentStrict | null>(null);
  const [payloadError, setPayloadError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const token = extractPayloadToken(window.location.pathname);
      if (!token) {
        // No payload in path — clear any previous state and exit.
        setPayload(null);
        setPayloadKai(null);
        setPayloadError(null);
        return;
      }

      const decoded = decodeFeedPayload(token);
      if (!decoded) {
        setPayload(null);
        setPayloadKai(null);
        setPayloadError("Invalid or corrupted stream payload.");
        return;
      }

      setPayload(decoded);

      // Derive Kai moment (beat/step/day/chakra) from absolute pulse
      try {
        const km = kaiMomentFromAbsolutePulse(decoded.pulse);
        setPayloadKai(km);
      } catch (e) {
        report("kaiMomentFromAbsolutePulse", e);
        setPayloadKai(null);
      }

      // Ensure payload URL is present in the list (payload-first in UI handled upstream)
      setSources((prev) => {
        const exists = prev.some((s) => s.url === decoded.url);
        if (exists) return prev;
        try {
          prependUniqueToStorage([decoded.url]);
        } catch (e) {
          report("localStorage prependUniqueToStorage", e);
        }
        return [{ url: decoded.url }, ...prev];
      });

      setPayloadError(null);
    } catch (e) {
      report("usePayload decode/init", e);
      setPayload(null);
      setPayloadKai(null);
      setPayloadError("Failed to read stream payload.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSources]);

  // Attachments surfaced from payload if present and well-formed
  const payloadAttachments = useMemo<AttachmentManifest | null>(() => {
    if (!payload) return null;
    const candidate = (payload as unknown as { attachments?: unknown }).attachments;
    return isAttachmentManifest(candidate) ? (candidate as AttachmentManifest) : null;
  }, [payload]);

  return { payload, payloadKai, payloadError, payloadAttachments };
}

export default usePayload;
