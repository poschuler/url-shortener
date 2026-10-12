import { randomUUID } from "node:crypto";

import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import { TypeBoxValidatorCompiler } from "@fastify/type-provider-typebox";
import scalar from "@scalar/fastify-api-reference";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import type { Logger } from "pino";

import { withTimeout } from "../async/with-timeout.js";
import { registerProblemDetails, sendProblem } from "./problem-details.js";

// Below the 3s timeout of the compose healthcheck, so /ready always answers.
const READINESS_TIMEOUT_MS = 2_000;

// Resolves when the dependency is usable and rejects with the reason when not.
export type ReadinessCheck = () => Promise<void>;

export type ServerOptions = {
  logger: Logger;
  // Shared by every rate limited route; each route sets its own max.
  rateLimitWindowMs: number;
  // Addresses of the proxies allowed to set X-Forwarded-For. Empty: trust none.
  trustProxy?: string[];
  // Serves the API reference (Scalar) and the OpenAPI document under /docs.
  docsEnabled?: boolean;
  readinessChecks?: Record<string, ReadinessCheck>;
  readinessTimeoutMs?: number;
};

// Async because plugins must finish loading before routes are added: a route
// added earlier is silently left without a rate limit.
export async function buildServer({
  logger,
  rateLimitWindowMs,
  trustProxy = [],
  docsEnabled = false,
  readinessChecks = {},
  readinessTimeoutMs = READINESS_TIMEOUT_MS,
}: ServerOptions): Promise<FastifyInstance> {
  // Widened so Fastify keeps its default logger type in FastifyInstance.
  const loggerInstance: FastifyBaseLogger = logger;
  const app = Fastify({
    loggerInstance,
    requestIdHeader: "x-request-id",
    genReqId: () => randomUUID(),
    // request.ip, and so the rate limit key, comes from X-Forwarded-For only
    // when the request arrives through one of these proxies.
    trustProxy: trustProxy.length > 0 ? trustProxy : false,
  });

  // TypeBox checks bodies as they are. Fastify's default (Ajv) coerces them:
  // { "url": 42 } would become "42" and { "url": ["..."] } a plain string.
  app.setValidatorCompiler(TypeBoxValidatorCompiler);
  registerProblemDetails(app);

  // In memory, per process: with N replicas a client gets N times the limit.
  // Off by default; a route opts in with config: { rateLimit: { max } }.
  await app.register(rateLimit, {
    global: false,
    timeWindow: rateLimitWindowMs,
  });

  // Collects the schema of every route added from here on. Always on, so the
  // OpenAPI document can be built even where /docs is not served.
  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: { title: "URL Shortener", version: "1.0.0" },
    },
    // Names each shared schema after its $id instead of def-0, def-1...
    refResolver: {
      buildLocalReference: (json, _baseUri, _fragment, i) =>
        typeof json.$id === "string" ? json.$id : `def-${i}`,
    },
  });

  if (docsEnabled) {
    await app.register(scalar, { routePrefix: "/docs" });
  }

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  // Probes hit these every few seconds: log them only when something is wrong.
  // A route's logLevel replaces the server's, so never make it chattier.
  // They are for the orchestrator, not for API clients: left out of the docs.
  const probe = {
    schema: { hide: true },
    ...(logger.isLevelEnabled("warn") ? ({ logLevel: "warn" } as const) : {}),
  };

  // Liveness: the process is up and serving requests.
  app.get("/health", probe, async () => ({ status: "ok" }));

  // Readiness: the dependencies are up, so the process can take traffic.
  app.get("/ready", probe, async (request, reply) => {
    const results = await Promise.all(
      Object.entries(readinessChecks).map(async ([name, check]) => {
        try {
          // A hung dependency must fail the check, not hang the probe.
          await withTimeout(check(), readinessTimeoutMs);
          return null;
        } catch (error) {
          request.log.warn(
            { err: error, check: name },
            "Readiness check failed",
          );
          return name;
        }
      }),
    );
    const failed = results.filter((name) => name !== null);

    if (failed.length > 0) {
      return sendProblem(reply, 503, `Not ready: ${failed.join(", ")}`);
    }

    return { status: "ready" };
  });

  return app;
}
