import { assert, describe, expect, it } from "vitest";

import { Link } from "#src/modules/links/domain/link.js";
import { ShortCode } from "#src/modules/links/domain/short-code.vo.js";
import { TargetUrl } from "#src/modules/links/domain/target-url.js";

const NOW = new Date("2026-10-10T12:00:00.000Z");

function shortCode(): ShortCode {
  const result = ShortCode.parse("aZ09bY8");
  assert(result.ok);
  return result.value;
}

function targetUrl(raw: string): TargetUrl {
  const result = TargetUrl.parse(raw, {
    maxLength: 2048,
    reservedHostname: "short.example",
  });
  assert(result.ok);
  return result.value;
}

describe("Link.create", () => {
  it("builds a link from a validated Target URL", () => {
    const code = shortCode();

    const link = Link.create({
      code,
      url: targetUrl("https://example.com/a"),
      now: NOW,
    });

    expect(link.code).toBe(code);
    expect(link.url).toBe("https://example.com/a");
    expect(link.createdAt).toEqual(NOW);
  });

  it("stores the canonical form of the Target URL", () => {
    const link = Link.create({
      code: shortCode(),
      url: targetUrl("https://EXAMPLE.com:443/a b"),
      now: NOW,
    });

    expect(link.url).toBe("https://example.com/a%20b");
  });
});
