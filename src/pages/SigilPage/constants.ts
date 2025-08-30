// Sizing for exports
export const EXPORT_PX = 2000;       // SVG→PNG export side
export const POSTER_PX = 4096;       // square poster PNG side

// Social (Open Graph) image size
export const OG_W = 1200;
export const OG_H = 630;

// Claim/upgrade defaults
export const DEFAULT_UPGRADE_BREATHS = 11;

// Nice-to-have timing constant (used by live drift elsewhere)
export const BREATH_MS = 5236;

// already present:
export const ROTATE_CH = "sigil-xfer-v1";
export const rotationKey = (h: string) => `sigil:rotated:${h}`;
export type RotationMsg = { type: "rotated"; canonical: string; token: string };
