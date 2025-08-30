// src/lib/qr.ts
/**
 * QR code helper for embedding the canonical Sigil Page URL into exports.
 * Supports both PNG (data URL) and SVG output using the `qrcode` package.
 */

import { toDataURL, toString as toQRString } from "qrcode";

export type QRErrorCorrection = "L" | "M" | "Q" | "H";

export type QROpts = {
  /** Pixel width/height of the QR image (square). Default 160. */
  size?: number;
  /** Quiet zone (modules) around the QR. Default 2 for better scan reliability. */
  margin?: number;
  /** Error correction level. Default "Q" for long URLs with embedded payloads. */
  ecc?: QRErrorCorrection;
};

/**
 * Generate a PNG data URL containing a QR code for `text`.
 * Overloads:
 *  - qrDataURL(text, size?)
 *  - qrDataURL(text, { size?, margin?, ecc? })
 */
export async function qrDataURL(text: string, opts?: number | QROpts): Promise<string> {
  const size = typeof opts === "number" ? opts : opts?.size ?? 160;
  const margin = typeof opts === "number" ? 2 : opts?.margin ?? 2;
  const ecc: QRErrorCorrection = typeof opts === "number" ? "Q" : opts?.ecc ?? "Q";

  // Ensure we always pass a string
  const payload = String(text);

  return toDataURL(payload, {
    width: Math.max(16, Math.floor(size)),
    margin,
    errorCorrectionLevel: ecc,
  });
}

/**
 * Generate a QR code as an SVG string (vector, infinitely scalable).
 * Ideal for embedding directly into SVG exports like KaiSigil.
 */
export async function qrSvgString(text: string, opts?: QROpts): Promise<string> {
  const margin = opts?.margin ?? 2;
  const ecc: QRErrorCorrection = opts?.ecc ?? "Q";

  const payload = String(text);

  return toQRString(payload, {
    type: "svg",
    margin,
    errorCorrectionLevel: ecc,
  });
}

// Optional default export
export default qrDataURL;
