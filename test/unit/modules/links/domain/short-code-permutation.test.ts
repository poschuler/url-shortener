import { describe, expect, it } from "vitest";

import {
  permutationKeyFromHex,
  permute,
} from "#src/modules/links/domain/short-code-permutation.js";

const SPACE = 62 ** 7;
const KEY = permutationKeyFromHex("000102030405060708090a0b0c0d0e0f");

describe("permute", () => {
  it("maps known numbers to known values", () => {
    // Links already stored depend on these exact values (ADR-0004).
    // If this test fails, the permutation changed: do not update the
    // expected values, revert the change.
    expect(permute(0, KEY)).toBe(155_288_224_083);
    expect(permute(1, KEY)).toBe(2_997_143_068_044);
    expect(permute(2, KEY)).toBe(1_025_462_763_780);
    expect(permute(SPACE - 1, KEY)).toBe(300_440_929_612);
  });

  it("is deterministic", () => {
    expect(permute(42, KEY)).toBe(permute(42, KEY));
  });

  it("never maps two numbers to the same value", () => {
    const seen = new Set<number>();
    for (let n = 0; n < 100_000; n++) {
      seen.add(permute(n, KEY));
    }

    expect(seen.size).toBe(100_000);
  });

  it("stays within the short code space", () => {
    for (let n = 0; n < 10_000; n++) {
      const value = permute(n, KEY);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(SPACE);
    }
  });

  it("does not map consecutive numbers to evenly spaced values", () => {
    const first = permute(2, KEY) - permute(1, KEY);
    const second = permute(3, KEY) - permute(2, KEY);

    expect(first).not.toBe(second);
  });

  it("gives different values for different keys", () => {
    const otherKey = permutationKeyFromHex("ffeeddccbbaa99887766554433221100");

    expect(permute(1, otherKey)).not.toBe(permute(1, KEY));
  });

  it.each([-1, 1.5, SPACE, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects %s",
    (n) => {
      expect(() => permute(n, KEY)).toThrow(RangeError);
    },
  );
});

describe("permutationKeyFromHex", () => {
  it("splits the key into four 32-bit words", () => {
    expect(KEY).toEqual([
      0x00_01_02_03, 0x04_05_06_07, 0x08_09_0a_0b, 0x0c_0d_0e_0f,
    ]);
  });

  it("ignores letter case", () => {
    expect(permutationKeyFromHex("FFEEDDCCBBAA99887766554433221100")).toEqual(
      permutationKeyFromHex("ffeeddccbbaa99887766554433221100"),
    );
  });

  it.each([
    ["empty", ""],
    ["too short", "000102030405060708090a0b0c0d0e0"],
    ["too long", "000102030405060708090a0b0c0d0e0f0"],
    ["not hexadecimal", "g00102030405060708090a0b0c0d0e0f"],
    ["prefixed with 0x", "0x0102030405060708090a0b0c0d0e0f"],
  ])("rejects a key that is %s", (_, hex) => {
    expect(() => permutationKeyFromHex(hex)).toThrow(
      "Short code key must be 32 hexadecimal characters",
    );
  });
});
