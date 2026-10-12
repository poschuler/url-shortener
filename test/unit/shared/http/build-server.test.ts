import { pino } from "pino";
import { describe, expect, it } from "vitest";

import { buildServer } from "#src/shared/http/build-server.js";

const logger = pino({ level: "silent" });
const options = { logger, rateLimitWindowMs: 60_000 };
const passing = async () => {};
const failing = async () => {
  throw new Error("Connection refused");
};
const hanging = () => new Promise<void>(() => {});

describe("buildServer", () => {
  it("answers /health with 200", async () => {
    const app = await buildServer(options);

    const response = await app.inject({ url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("is ready when there is nothing to check", async () => {
    const app = await buildServer(options);

    const response = await app.inject({ url: "/ready" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ready" });
  });

  it("is ready when every check passes", async () => {
    const app = await buildServer({
      ...options,
      readinessChecks: { postgres: passing, redis: passing },
    });

    const response = await app.inject({ url: "/ready" });

    expect(response.statusCode).toBe(200);
  });

  it("answers 503 naming the checks that fail", async () => {
    const app = await buildServer({
      ...options,
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

  it("fails a check that takes longer than the timeout", async () => {
    const app = await buildServer({
      ...options,
      readinessChecks: { postgres: hanging, redis: passing },
      readinessTimeoutMs: 10,
    });

    const response = await app.inject({ url: "/ready" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ detail: "Not ready: postgres" });
  });

  it("answers unknown routes with a problem", async () => {
    const app = await buildServer(options);

    const response = await app.inject({ url: "/nope" });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toBe(
      "application/problem+json; charset=utf-8",
    );
  });

  it("echoes the x-request-id it receives", async () => {
    const app = await buildServer(options);

    const response = await app.inject({
      url: "/health",
      headers: { "x-request-id": "abc-123" },
    });

    expect(response.headers["x-request-id"]).toBe("abc-123");
  });

  it("generates a UUID request id when none is sent", async () => {
    const app = await buildServer(options);

    const response = await app.inject({ url: "/health" });

    expect(response.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("rate limits only the routes that opt in", async () => {
    const app = await buildServer(options);
    app.get("/limited", { config: { rateLimit: { max: 1 } } }, (_, reply) =>
      reply.send("ok"),
    );

    await app.inject({ url: "/limited" });
    const limited = await app.inject({ url: "/limited" });
    await app.inject({ url: "/health" });
    const health = await app.inject({ url: "/health" });

    expect(limited.statusCode).toBe(429);
    expect(health.statusCode).toBe(200);
    expect(health.headers).not.toHaveProperty("x-ratelimit-limit");
  });

  it("ignores X-Forwarded-For when no proxy is trusted", async () => {
    const app = await buildServer(options);
    app.get("/ip", (request, reply) => reply.send(request.ip));

    const response = await app.inject({
      url: "/ip",
      headers: { "x-forwarded-for": "203.0.113.7" },
    });

    expect(response.body).toBe("127.0.0.1");
  });

  it("takes the client IP from X-Forwarded-For sent by a trusted proxy", async () => {
    const app = await buildServer({ ...options, trustProxy: ["127.0.0.1"] });
    app.get("/ip", (request, reply) => reply.send(request.ip));

    const response = await app.inject({
      url: "/ip",
      headers: { "x-forwarded-for": "203.0.113.7" },
    });

    expect(response.body).toBe("203.0.113.7");
  });
});
