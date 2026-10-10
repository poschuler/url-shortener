// Scrambles sequential numbers into Short Code space so that Short Codes are
// not enumerable. See ADR-0004. Every constant, shift and round below is
// immutable once Links exist: changing any of them remaps every number.

// Number of possible Short Codes: 7 base62 characters. Tied to CODE_LENGTH in
// short-code.vo.ts and to HALF_BITS below (62^7 must fit in 2 * HALF_BITS).
const SPACE = 62 ** 7; // 3_521_614_606_208

// The Feistel network works on 42-bit values split into two 21-bit halves:
// the smallest even bit width that holds SPACE.
const HALF_BITS = 21;
const HALF = 2 ** HALF_BITS; // 2_097_152
const HALF_MASK = HALF - 1; // lowest 21 bits set

// Feistel round function: a non-linear, keyed mix of one half. It does not
// need to be reversible; the Feistel structure makes the whole permutation
// reversible. Uses the lowbias32 integer hash by Chris Wellons.
function mix(half: number, roundKey: number): number {
  let h = half ^ roundKey;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h & HALF_MASK;
}

// One 32-bit key per Feistel round.
export type PermutationKey = readonly [number, number, number, number];

// Four-round Feistel network over [0, 2^42). Each round maps
// (left, right) to (right, left XOR mix(right)), which is always reversible.
function feistel(x: number, key: PermutationKey): number {
  let left = Math.floor(x / HALF);
  let right = x % HALF;

  for (const roundKey of key) {
    const next = left ^ mix(right, roundKey);
    left = right;
    right = next;
  }

  return left * HALF + right;
}

// Bijection on [0, SPACE). The Feistel network covers 2^42 values, so results
// that land outside SPACE are fed back in (cycle-walking) until one lands
// inside. This takes about 1.25 rounds on average and keeps the mapping
// collision-free.
export function permute(n: number, key: PermutationKey): number {
  if (!Number.isSafeInteger(n) || n < 0 || n >= SPACE) {
    throw new RangeError(`Number out of short code space: ${n}`);
  }

  let x = n;
  do {
    x = feistel(x, key);
  } while (x >= SPACE);

  return x;
}

// 128-bit key as 32 hex characters, split into four 32-bit round keys.
const KEY_PATTERN = /^[0-9a-f]{32}$/i;

export function permutationKeyFromHex(hex: string): PermutationKey {
  if (!KEY_PATTERN.test(hex)) {
    throw new Error("Short code key must be 32 hexadecimal characters");
  }

  const word = (index: number) =>
    Number.parseInt(hex.slice(index * 8, index * 8 + 8), 16);

  return [word(0), word(1), word(2), word(3)];
}
