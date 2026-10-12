import { pino } from "pino";
import { describe, expect, it } from "vitest";

import { ShortenLink } from "#src/modules/links/application/shorten-link.js";
import { permutationKeyFromHex } from "#src/modules/links/domain/short-code-permutation.js";
import { ShortCode } from "#src/modules/links/domain/short-code.vo.js";
import { registerShortenLinkRoute } from "#src/modules/links/http/shorten-link.route.js";
import { InMemoryLinkRepository } from "#src/modules/links/infrastructure/in-memory/in-memory-link-repository.js";
import { InMemoryNumberSequence } from "#src/modules/links/infrastructure/in-memory/in-memory-number-sequence.js";
import { buildServer } from "#src/shared/http/build-server.js";

const KEY = permutationKeyFromHex("000102030405060708090a0b0c0d0e0f");
const NOW = new Date("2026-10-11T12:00:00.000Z");
const CODE = ShortCode.fromNumber(0n, KEY).value;

async function setup(rateLimitMax = 100) {
  const repository = new InMemoryLinkRepository();
  const app = await buildServer({
    logger: pino({ level: "silent" }),
    rateLimitWindowMs: 30_000,
  });
  registerShortenLinkRoute(app, {
    shortenLink: new ShortenLink({
      sequence: new InMemoryNumberSequence(),
      repository,
      shortCodeKey: KEY,
      targetUrlRules: { maxLength: 2048, reservedHostname: "short.example" },
      now: () => NOW,
    }),
    publicBaseUrl: "https://short.example",
    rateLimitMax,
  });

  return { app, repository };
}

describe("POST /links", () => {
  it("creates a Link and returns its Short URL", async () => {
    const { app, repository } = await setup();

    const response = await app.inject({
      method: "POST",
      url: "/links",
      body: { url: "https://EXAMPLE.com/a" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      code: CODE,
      shortUrl: `https://short.example/${CODE}`,
      url: "https://example.com/a",
      createdAt: "2026-10-11T12:00:00.000Z",
    });
    expect(repository.all()).toHaveLength(1);
  });

  it("explains which rule an invalid Target URL breaks", async () => {
    const { app, repository } = await setup();

    const response = await app.inject({
      method: "POST",
      url: "/links",
      body: { url: "ftp://example.com/a" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toBe(
      "application/problem+json; charset=utf-8",
    );
    expect(response.json()).toEqual({
      type: "about:blank",
      title: "Bad Request",
      status: 400,
      detail: "Target URL must use http or https",
    });
    expect(repository.all()).toEqual([]);
  });

  it.each([
    ["no url", {}, "body must have required properties url"],
    ["a number as url", { url: 42 }, "body/url must be string"],
    [
      "an array as url",
      { url: ["https://example.com/a"] },
      "body/url must be string",
    ],
  ])(
    "rejects a body with %s, without coercing it",
    async (_case, body, detail) => {
      const { app, repository } = await setup();

      const response = await app.inject({
        method: "POST",
        url: "/links",
        body,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ status: 400, detail });
      expect(repository.all()).toEqual([]);
    },
  );

  it("limits how many Links a client can create", async () => {
    const { app, repository } = await setup(2);
    const shorten = () =>
      app.inject({
        method: "POST",
        url: "/links",
        body: { url: "https://example.com/a" },
      });

    await shorten();
    await shorten();
    const response = await shorten();

    expect(response.statusCode).toBe(429);
    expect(response.headers["retry-after"]).toBe("30");
    expect(response.json()).toEqual({
      type: "about:blank",
      title: "Too Many Requests",
      status: 429,
      detail: "Rate limit exceeded, retry in 30 seconds",
    });
    expect(repository.all()).toHaveLength(2);
  });
});
