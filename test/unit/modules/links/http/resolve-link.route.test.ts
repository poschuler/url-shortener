import { pino } from "pino";
import { describe, expect, it } from "vitest";

import { ResolveLink } from "#src/modules/links/application/resolve-link.js";
import { registerResolveLinkRoute } from "#src/modules/links/http/resolve-link.route.js";
import { InMemoryLinkCache } from "#src/modules/links/infrastructure/in-memory/in-memory-link-cache.js";
import { InMemoryLinkRepository } from "#src/modules/links/infrastructure/in-memory/in-memory-link-repository.js";
import { buildServer } from "#src/shared/http/build-server.js";

import { createLink } from "../../../../contract/modules/links/infrastructure/link-repository.contract.js";

async function setup(rateLimitMax = 100) {
  const repository = new InMemoryLinkRepository();
  await repository.save(createLink("abc1234", "https://example.com/a?b=c"));

  const app = await buildServer({
    logger: pino({ level: "silent" }),
    rateLimitWindowMs: 30_000,
  });
  registerResolveLinkRoute(app, {
    resolveLink: new ResolveLink({
      cache: new InMemoryLinkCache(),
      lookup: repository,
    }),
    rateLimitMax,
  });

  return app;
}

describe("GET /:code", () => {
  it("redirects to the Target URL", async () => {
    const app = await setup();

    const response = await app.inject({ url: "/abc1234" });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("https://example.com/a?b=c");
    expect(response.body).toBe("");
  });

  it("answers 404 for a code without a Link", async () => {
    const app = await setup();

    const response = await app.inject({ url: "/abc1235" });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toBe(
      "application/problem+json; charset=utf-8",
    );
    expect(response.json()).toEqual({
      type: "about:blank",
      title: "Not Found",
      status: 404,
      detail: "Link not found",
    });
  });

  it.each([
    ["too short", "abc123", "Short code must be 7 characters long"],
    [
      "not base62",
      "abc-123",
      "Only base62 characters (0-9, A-Z, a-z) are allowed",
    ],
  ])("answers 400 for a code that is %s", async (_case, code, detail) => {
    const app = await setup();

    const response = await app.inject({ url: `/${code}` });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      type: "about:blank",
      title: "Bad Request",
      status: 400,
      detail,
    });
  });

  it("limits how many codes a client can resolve", async () => {
    const app = await setup(2);
    const resolve = () => app.inject({ url: "/abc1234" });

    await resolve();
    await resolve();
    const response = await resolve();

    expect(response.statusCode).toBe(429);
    expect(response.headers["retry-after"]).toBe("30");
  });
});
