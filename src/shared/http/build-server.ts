import { randomUUID } from "node:crypto";

import { TypeBoxValidatorCompiler } from "@fastify/type-provider-typebox";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import type { Logger } from "pino";

import { registerProblemDetails, sendProblem } from "./problem-details.js";

// Below the 3s timeout of the compose healthcheck, so /ready always answers.
const READINESS_TIMEOUT_MS = 2_000;

// Resolves when the dependency is usable and rejects with the reason when not.
export type ReadinessCheck = () => Promise<void>;

export type ServerOptions = {
  logger: Logger;
  readinessChecks?: Record<string, ReadinessCheck>;
  readinessTimeoutMs?: number;
};

export function buildServer({
  logger,
  readinessChecks = {},
  readinessTimeoutMs = READINESS_TIMEOUT_MS,
}: ServerOptions): FastifyInstance {
  // Widened so Fastify keeps its default logger type in FastifyInstance.
  const loggerInstance: FastifyBaseLogger = logger;
  const app = Fastify({
    loggerInstance,
    requestIdHeader: "x-request-id",
    genReqId: () => randomUUID(),
  });

  // TypeBox checks bodies as they are. Fastify's default (Ajv) coerces them:
  // { "url": 42 } would become "42" and { "url": ["..."] } a plain string.
  app.setValidatorCompiler(TypeBoxValidatorCompiler);
  registerProblemDetails(app);

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  // Probes hit these every few seconds: log them only when something is wrong.
  // A route's logLevel replaces the server's, so never make it chattier.
  const probe = logger.isLevelEnabled("warn")
    ? ({ logLevel: "warn" } as const)
    : {};

  // Liveness: the process is up and serving requests.
  app.get("/health", probe, async () => ({ status: "ok" }));

  // Readiness: the dependencies are up, so the process can take traffic.
  app.get("/ready", probe, async (request, reply) => {
    const results = await Promise.all(
      Object.entries(readinessChecks).map(async ([name, check]) => {
        try {
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

// A hung dependency must fail the check instead of hanging the probe.
// The check itself keeps running: Promise.race cannot cancel it.
async function withTimeout(promise: Promise<void>, ms: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timed out after ${ms} ms`));
    }, ms);
  });

  try {
    await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
