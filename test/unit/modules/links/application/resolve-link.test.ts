import { assert, describe, expect, it, vi } from "vitest";

import { ResolveLink } from "#src/modules/links/application/resolve-link.js";
import { LinkErrors } from "#src/modules/links/domain/link.errors.js";
import { Link } from "#src/modules/links/domain/link.js";
import { ShortCodeErrors } from "#src/modules/links/domain/short-code.errors.js";
import { ShortCode } from "#src/modules/links/domain/short-code.vo.js";
import { TargetUrl } from "#src/modules/links/domain/target-url.js";
import { InMemoryLinkCache } from "#src/modules/links/infrastructure/in-memory/in-memory-link-cache.js";
import { InMemoryLinkRepository } from "#src/modules/links/infrastructure/in-memory/in-memory-link-repository.js";
import { Result } from "#src/shared/domain/result.js";

const CODE = "aZ09bY8";
const TARGET_URL = "https://example.com/a";

function shortCode(raw: string): ShortCode {
  const result = ShortCode.parse(raw);
  assert(result.ok);
  return result.value;
}

async function setup() {
  const repository = new InMemoryLinkRepository();
  const cache = new InMemoryLinkCache();

  const url = TargetUrl.parse(TARGET_URL, {
    maxLength: 2048,
    reservedHostname: "short.example",
  });
  assert(url.ok);
  await repository.save(
    Link.create({ code: shortCode(CODE), url: url.value, now: new Date() }),
  );

  const lookup = vi.spyOn(repository, "findTargetUrl");
  const resolveLink = new ResolveLink({ cache, lookup: repository });

  return { cache, lookup, resolveLink };
}

describe("ResolveLink", () => {
  it("rejects an invalid short code without looking it up", async () => {
    const { lookup, resolveLink } = await setup();

    const result = await resolveLink.execute({ code: "abc" });

    expect(result).toEqual(
      Result.failure(
        ShortCodeErrors.invalid("Short code must be 7 characters long"),
      ),
    );
    expect(lookup).not.toHaveBeenCalled();
  });

  it("looks up a cache miss and caches the Target URL", async () => {
    const { cache, lookup, resolveLink } = await setup();

    const result = await resolveLink.execute({ code: CODE });

    expect(result).toEqual(Result.success(TARGET_URL));
    expect(lookup).toHaveBeenCalledOnce();
    expect(await cache.get(shortCode(CODE))).toEqual({
      status: "hit",
      url: TARGET_URL,
    });
  });

  it("looks up a cache miss for an unknown code and caches its absence", async () => {
    const { cache, lookup, resolveLink } = await setup();

    const result = await resolveLink.execute({ code: "0000000" });

    expect(result).toEqual(Result.failure(LinkErrors.notFound()));
    expect(lookup).toHaveBeenCalledOnce();
    expect(await cache.get(shortCode("0000000"))).toEqual({
      status: "known-missing",
    });
  });

  it("serves a cache hit without looking it up", async () => {
    const { cache, lookup, resolveLink } = await setup();
    await cache.set(shortCode(CODE), TARGET_URL);

    const result = await resolveLink.execute({ code: CODE });

    expect(result).toEqual(Result.success(TARGET_URL));
    expect(lookup).not.toHaveBeenCalled();
  });

  it("answers a known-missing code without looking it up", async () => {
    const { cache, lookup, resolveLink } = await setup();
    await cache.set(shortCode("0000000"), null);

    const result = await resolveLink.execute({ code: "0000000" });

    expect(result).toEqual(Result.failure(LinkErrors.notFound()));
    expect(lookup).not.toHaveBeenCalled();
  });

  it("looks up each code only once across repeated resolves", async () => {
    const { lookup, resolveLink } = await setup();

    await resolveLink.execute({ code: CODE });
    await resolveLink.execute({ code: CODE });
    await resolveLink.execute({ code: "0000000" });
    await resolveLink.execute({ code: "0000000" });

    expect(lookup).toHaveBeenCalledTimes(2);
  });
});
