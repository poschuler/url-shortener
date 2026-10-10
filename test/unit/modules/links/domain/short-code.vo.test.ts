import { assert, describe, expect, it } from "vitest";

import { permutationKeyFromHex } from "#src/modules/links/domain/short-code-permutation.js";
import { ShortCodeErrors } from "#src/modules/links/domain/short-code.errors.js";
import { ShortCode } from "#src/modules/links/domain/short-code.vo.js";
import { Result } from "#src/shared/domain/result.js";

const SPACE = 62n ** 7n;
const KEY = permutationKeyFromHex("000102030405060708090a0b0c0d0e0f");

describe("ShortCode.parse", () => {
  it("accepts seven base62 characters", () => {
    const result = ShortCode.parse("aZ09bY8");

    assert(result.ok);
    expect(result.value.value).toBe("aZ09bY8");
  });

  it("rejects an empty string", () => {
    expect(ShortCode.parse("")).toEqual(
      Result.failure(ShortCodeErrors.invalid("Short code cannot be empty")),
    );
  });

  it.each(["aZ09bY", "aZ09bY8c"])("rejects %s for its length", (raw) => {
    expect(ShortCode.parse(raw)).toEqual(
      Result.failure(
        ShortCodeErrors.invalid("Short code must be 7 characters long"),
      ),
    );
  });

  it.each(["aZ09bY-", "aZ0 bY8", "aZ09bYñ", "../etc/"])(
    "rejects %s for its characters",
    (raw) => {
      expect(ShortCode.parse(raw)).toEqual(
        Result.failure(
          ShortCodeErrors.invalid(
            "Only base62 characters (0-9, A-Z, a-z) are allowed",
          ),
        ),
      );
    },
  );
});

describe("ShortCode.fromNumber", () => {
  it("maps known numbers to known short codes", () => {
    // Short URLs already handed out depend on these exact values (ADR-0004).
    // If this test fails, do not update the expected values, revert the change.
    expect(ShortCode.fromNumber(0n, KEY).value).toBe("2jVFYtX");
    expect(ShortCode.fromNumber(1n, KEY).value).toBe("qlVysEW");
    expect(ShortCode.fromNumber(2n, KEY).value).toBe("I3KzFcS");
    expect(ShortCode.fromNumber(SPACE - 1n, KEY).value).toBe("5HwZWPM");
  });

  it("pads short codes to seven characters", () => {
    expect(ShortCode.fromNumber(21n, KEY).value).toBe("0LRVjdT");
  });

  it("produces unique short codes that parse back", () => {
    const seen = new Set<string>();
    for (let n = 0n; n < 10_000n; n++) {
      const { value } = ShortCode.fromNumber(n, KEY);
      expect(ShortCode.parse(value).ok).toBe(true);
      seen.add(value);
    }

    expect(seen.size).toBe(10_000);
  });

  it.each([-1n, SPACE])("rejects %s", (n) => {
    expect(() => ShortCode.fromNumber(n, KEY)).toThrow(RangeError);
  });
});
