import { randomUUID } from "node:crypto";

import Fastify, { type FastifyInstance } from "fastify";

import type { LogLevel } from "../config/config.js";
import { registerProblemDetails, sendProblem } from "./problem-details.js";

const QUIETER_THAN_WARN: ReadonlySet<LogLevel> = new Set([
  "fatal",
  "error",
  "silent",
]);

// Resolves when the dependency is usable and rejects with the reason when not.
export type ReadinessCheck = () => Promise<void>;

export type ServerOptions = {
  logLevel: LogLevel;
  readinessChecks?: Record<string, ReadinessCheck>;
};

export function buildServer({
  logLevel,
  readinessChecks = {},
}: ServerOptions): FastifyInstance {
  const app = Fastify({
    logger: { level: logLevel },
    requestIdHeader: "x-request-id",
    genReqId: () => randomUUID(),
  });

  registerProblemDetails(app);

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  // Probes hit these every few seconds: log them only when something is wrong.
  // A route's logLevel replaces the server's, so never make it chattier.
  const probe = {
    logLevel: QUIETER_THAN_WARN.has(logLevel) ? logLevel : "warn",
  } as const;

  // Liveness: the process is up and serving requests.
  app.get("/health", probe, async () => ({ status: "ok" }));

  // Readiness: the dependencies are up, so the process can take traffic.
  app.get("/ready", probe, async (request, reply) => {
    const results = await Promise.all(
      Object.entries(readinessChecks).map(async ([name, check]) => {
        try {
          await check();
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
