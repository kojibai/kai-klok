declare module "jsqr" {
    export interface QRCode {
      data: string;
      // (jsQR returns more fields, but we only need .data)
    }
    export default function jsQR(
      data: Uint8ClampedArray,
      width: number,
      height: number
    ): QRCode | null;
  }
  