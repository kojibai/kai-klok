declare module "pako" {
    /** RFC 1952 gzip compress. Accepts Uint8Array/ArrayBufferView. */
    export function gzip(
      data: Uint8Array | ArrayBuffer | ArrayBufferView
    ): Uint8Array;
  
    /** RFC 1952 gzip decompress. Accepts Uint8Array/ArrayBufferView. */
    export function ungzip(
      data: Uint8Array | ArrayBuffer | ArrayBufferView
    ): Uint8Array;
  }
  