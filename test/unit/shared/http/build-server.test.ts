import { describe, expect, it } from "vitest";

import { buildServer } from "#src/shared/http/build-server.js";

const passing = async () => {};
const failing = async () => {
  throw new Error("Connection refused");
};

describe("buildServer", () => {
  it("answers /health with 200", async () => {
    const app = buildServer({ logLevel: "silent" });

    const response = await app.inject({ url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("is ready when there is nothing to check", async () => {
    const app = buildServer({ logLevel: "silent" });

    const response = await app.inject({ url: "/ready" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ready" });
  });

  it("is ready when every check passes", async () => {
    const app = buildServer({
      logLevel: "silent",
      readinessChecks: { postgres: passing, redis: passing },
    });

    const response = await app.inject({ url: "/ready" });

    expect(response.statusCode).toBe(200);
  });

  it("answers 503 naming the checks that fail", async () => {
    const app = buildServer({
      logLevel: "silent",
      readinessChecks: { postgres: failing, redis: passing, ids: failing },
    });

    const response = await app.inject({ url: "/ready" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      type: "about:blank",
      title: "Service Unavailable",
      status: 503,
      detail: "Not ready: postgres, ids",
    });
  });

  it("answers unknown routes with a problem", async () => {
    const app = buildServer({ logLevel: "silent" });

    const response = await app.inject({ url: "/nope" });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toBe(
      "application/problem+json; charset=utf-8",
    );
  });

  it("echoes the x-request-id it receives", async () => {
    const app = buildServer({ logLevel: "silent" });

    const response = await app.inject({
      url: "/health",
      headers: { "x-request-id": "abc-123" },
    });

    expect(response.headers["x-request-id"]).toBe("abc-123");
  });

  it("generates a UUID request id when none is sent", async () => {
    const app = buildServer({ logLevel: "silent" });

    const response = await app.inject({ url: "/health" });

    expect(response.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
