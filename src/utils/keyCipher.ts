/**
 * Small authenticated stream cipher for the API key at rest (F6).
 * Keystream = SHA-256(key ‖ nonce ‖ counter); tag = SHA-256(key ‖ "mac" ‖ nonce ‖ ciphertext)[0..16].
 * The 32-byte master key lives in Android Keystore via expo-secure-store; only the
 * ciphertext is written to the SQLite settings table. Pure functions — the digest
 * implementation is injected so the logic is unit-testable in Node.
 */

export type DigestFn = (data: Uint8Array) => Promise<Uint8Array>;

export function utf8Encode(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const cp = s.codePointAt(i)!;
    if (cp > 0xffff) i++; // surrogate pair consumed
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else {
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    }
  }
  return Uint8Array.from(out);
}

export function utf8Decode(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; ) {
    const c = b[i++];
    let cp: number;
    if (c < 0x80) cp = c;
    else if (c < 0xe0) cp = ((c & 31) << 6) | (b[i++] & 63);
    else if (c < 0xf0) cp = ((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    s += String.fromCodePoint(cp);
  }
  return s;
}

export const toHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) throw new Error('Invalid hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

async function keystream(key: Uint8Array, nonce: Uint8Array, length: number, digest: DigestFn) {
  const out = new Uint8Array(length);
  for (let block = 0, o = 0; o < length; block++) {
    const ctr = Uint8Array.from([(block >>> 24) & 255, (block >>> 16) & 255, (block >>> 8) & 255, block & 255]);
    const ks = await digest(concat(key, nonce, ctr));
    for (let i = 0; i < ks.length && o < length; i++, o++) out[o] = ks[i];
  }
  return out;
}

async function tag(key: Uint8Array, nonce: Uint8Array, ct: Uint8Array, digest: DigestFn) {
  return (await digest(concat(key, utf8Encode('mac'), nonce, ct))).slice(0, 16);
}

export async function encryptString(plain: string, key: Uint8Array, nonce: Uint8Array, digest: DigestFn) {
  const pt = utf8Encode(plain);
  const ks = await keystream(key, nonce, pt.length, digest);
  const ct = pt.map((b, i) => b ^ ks[i]);
  const t = await tag(key, nonce, ct, digest);
  return `v1:${toHex(nonce)}:${toHex(ct)}:${toHex(t)}`;
}

export async function decryptString(blob: string, key: Uint8Array, digest: DigestFn): Promise<string> {
  const [v, nonceHex, ctHex, tagHex] = blob.split(':');
  if (v !== 'v1' || !nonceHex || ctHex === undefined || !tagHex) throw new Error('Unrecognised ciphertext');
  const nonce = fromHex(nonceHex);
  const ct = fromHex(ctHex);
  const expected = toHex(await tag(key, nonce, ct, digest));
  if (expected !== tagHex.toLowerCase()) throw new Error('Ciphertext integrity check failed');
  const ks = await keystream(key, nonce, ct.length, digest);
  return utf8Decode(ct.map((b, i) => b ^ ks[i]));
}
