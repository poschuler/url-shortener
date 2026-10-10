import { assert, describe, expect, it } from "vitest";

import { LinkErrors } from "#src/modules/links/domain/link.errors.js";
import {
  TargetUrl,
  type TargetUrlRules,
} from "#src/modules/links/domain/target-url.js";
import { Result } from "#src/shared/domain/result.js";

const rules: TargetUrlRules = {
  maxLength: 2048,
  reservedHostname: "short.example",
};

const BASE = "https://example.com/";

function urlOfLength(length: number): string {
  return BASE + "a".repeat(length - BASE.length);
}

describe("TargetUrl.parse", () => {
  it("accepts an absolute URL and keeps its canonical form", () => {
    const result = TargetUrl.parse("https://example.com/a", rules);

    assert(result.ok);
    expect(result.value.value).toBe("https://example.com/a");
  });

  it.each(["/relative/path", "example.com", "", "http://"])(
    "rejects %s because it is not an absolute URL",
    (raw) => {
      expect(TargetUrl.parse(raw, rules)).toEqual(
        Result.failure(
          LinkErrors.invalidUrl("Target URL must be an absolute URL"),
        ),
      );
    },
  );

  it.each([
    "ftp://example.com/a",
    "javascript:alert(1)",
    "data:text/html,<p>hi</p>",
    "file:///etc/passwd",
    "mailto:someone@example.com",
  ])("rejects %s for its protocol", (raw) => {
    expect(TargetUrl.parse(raw, rules)).toEqual(
      Result.failure(
        LinkErrors.invalidUrl("Target URL must use http or https"),
      ),
    );
  });

  it.each([
    "https://user:pass@example.com/a",
    "https://user@example.com/a",
    "https://:pass@example.com/a",
  ])("rejects %s for carrying credentials", (raw) => {
    expect(TargetUrl.parse(raw, rules)).toEqual(
      Result.failure(
        LinkErrors.invalidUrl("Target URL must not contain credentials"),
      ),
    );
  });

  it.each([
    "https://short.example/abc1234",
    "https://short.example:8443/abc1234",
    "https://SHORT.EXAMPLE/abc1234",
    "http://short.example/",
  ])("rejects %s because it points to the shortener", (raw) => {
    expect(TargetUrl.parse(raw, rules)).toEqual(
      Result.failure(
        LinkErrors.invalidUrl("Target URL must not point to this shortener"),
      ),
    );
  });

  it("accepts a different host that merely contains the reserved hostname", () => {
    const result = TargetUrl.parse("https://not-short.example/a", rules);

    assert(result.ok);
    expect(result.value.value).toBe("https://not-short.example/a");
  });

  it("accepts a URL exactly at the maximum length", () => {
    const raw = urlOfLength(rules.maxLength);

    const result = TargetUrl.parse(raw, rules);

    assert(result.ok);
    expect(result.value.value).toHaveLength(rules.maxLength);
  });

  it("rejects a URL one character over the maximum length", () => {
    expect(TargetUrl.parse(urlOfLength(rules.maxLength + 1), rules)).toEqual(
      Result.failure(
        LinkErrors.invalidUrl(
          "Target URL must be at most 2048 characters long",
        ),
      ),
    );
  });

  it("measures the length on the canonical form, not on the raw input", () => {
    // The raw input has 23 characters; its canonical form "…/a%20b" has 25.
    const tightRules = { ...rules, maxLength: 24 };

    expect(TargetUrl.parse("https://example.com/a b", tightRules)).toEqual(
      Result.failure(
        LinkErrors.invalidUrl("Target URL must be at most 24 characters long"),
      ),
    );
  });

  it.each([
    ["https://EXAMPLE.com/a", "https://example.com/a"],
    ["https://example.com:443/a", "https://example.com/a"],
    ["http://example.com:80/a", "http://example.com/a"],
    ["https://example.com/a b", "https://example.com/a%20b"],
    ["https://example.com", "https://example.com/"],
  ])("normalizes %s to %s", (raw, canonical) => {
    const result = TargetUrl.parse(raw, rules);

    assert(result.ok);
    expect(result.value.value).toBe(canonical);
  });
});
