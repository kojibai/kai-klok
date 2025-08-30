// src/components/VerifierStamper/files.ts
/* helpers: filenames, downloads, payload codec */

import type { SigilPayload } from "./types";

export const isoNow = (): string => new Date().toISOString();

export const safeFilename = (prefix: string, pulse: number): string => {
  const iso = isoNow().replace(/[:.]/g, "-"); // path-safe
  return `${prefix}_${pulse}_${iso}`;
};

/* Deterministic sender/receiver export naming — strictly pulses (no ISO) */
export const pulseFilename = (
  prefix: string,
  sigilPulse: number,
  eventPulse: number
): string => `${prefix}_${sigilPulse}_${eventPulse}`;

export const download = (dataUrlOrBlob: string | Blob, fname: string): void => {
  const a = document.createElement("a");
  if (typeof dataUrlOrBlob === "string") {
    a.href = dataUrlOrBlob;
  } else {
    const url = URL.createObjectURL(dataUrlOrBlob);
    a.href = url;
    // Revoke after the click has a chance to start
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  a.download = fname;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
};

export const fileToPayload = (file: File): Promise<SigilPayload> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      // r.result is a data URL like: data:<mime>;base64,<payload>
      const s = String(r.result);
      const comma = s.indexOf(",");
      const encoded = comma >= 0 ? s.slice(comma + 1) : "";
      res({
        name: file.name,
        mime: file.type,
        size: file.size,
        encoded,
      });
    };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
