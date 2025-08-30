// scripts/kid-from-pub-raw-hex.mjs
import { webcrypto as crypto } from 'node:crypto';

const hex = (process.argv[2] || '').trim();
if (!hex) {
  console.error('Usage: node scripts/kid-from-pub-raw-hex.mjs <raw_uncompressed_pubkey_hex>');
  process.exit(1);
}

const hexToBytes = (h) => Uint8Array.from(h.match(/../g).map(b => parseInt(b, 16)));
const b64u = (u8) =>
  Buffer.from(u8).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const kidBuf = await crypto.subtle.digest('SHA-256', hexToBytes(hex));
console.log(b64u(new Uint8Array(kidBuf)));
