import { assert, describe, expect, it } from "vitest";

import { ShortenLink } from "#src/modules/links/application/shorten-link.js";
import { LinkErrors } from "#src/modules/links/domain/link.errors.js";
import { permutationKeyFromHex } from "#src/modules/links/domain/short-code-permutation.js";
import { ShortCode } from "#src/modules/links/domain/short-code.vo.js";
import { InMemoryIdGenerator } from "#src/modules/links/infrastructure/in-memory/in-memory-id-generator.js";
import { InMemoryLinkRepository } from "#src/modules/links/infrastructure/in-memory/in-memory-link-repository.js";
import { Result } from "#src/shared/domain/result.js";

const KEY = permutationKeyFromHex("000102030405060708090a0b0c0d0e0f");
const NOW = new Date("2026-10-10T12:00:00.000Z");

function setup() {
  const repository = new InMemoryLinkRepository();
  const shortenLink = new ShortenLink({
    idGenerator: new InMemoryIdGenerator(),
    repository,
    shortCodeKey: KEY,
    targetUrlRules: { maxLength: 2048, reservedHostname: "short.example" },
    now: () => NOW,
  });

  return { repository, shortenLink };
}

describe("ShortenLink", () => {
  it("creates and saves a link for a valid Target URL", async () => {
    const { repository, shortenLink } = setup();

    const result = await shortenLink.execute({
      url: "https://EXAMPLE.com/a",
    });

    assert(result.ok);
    expect(result.value.code).toEqual(ShortCode.fromNumber(0n, KEY));
    expect(result.value.url).toBe("https://example.com/a");
    expect(result.value.createdAt).toEqual(NOW);
    expect(repository.all()).toEqual([result.value]);
  });

  it("gives each link its own short code", async () => {
    const { repository, shortenLink } = setup();

    await shortenLink.execute({ url: "https://example.com/a" });
    await shortenLink.execute({ url: "https://example.com/a" });

    const [first, second] = repository.all();
    assert(first !== undefined && second !== undefined);
    expect(first.code).not.toEqual(second.code);
  });

  it("rejects an invalid Target URL without saving anything", async () => {
    const { repository, shortenLink } = setup();

    const result = await shortenLink.execute({ url: "javascript:alert(1)" });

    expect(result).toEqual(
      Result.failure(
        LinkErrors.invalidUrl("Target URL must use http or https"),
      ),
    );
    expect(repository.all()).toEqual([]);
  });

  it("does not use up an id when the Target URL is invalid", async () => {
    const { shortenLink } = setup();

    await shortenLink.execute({ url: "not a url" });
    const result = await shortenLink.execute({ url: "https://example.com/a" });

    assert(result.ok);
    expect(result.value.code).toEqual(ShortCode.fromNumber(0n, KEY));
  });
});
