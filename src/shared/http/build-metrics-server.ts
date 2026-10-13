import type { Registry } from "@prometheus-io/client";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import type { Logger } from "pino";

export type MetricsServerOptions = {
  logger: Logger;
  registry: Registry;
};

// Serves GET /metrics on a port of its own, for Prometheus inside the
// network: the public one only reaches the API. No rate limit and no docs.
export function buildMetricsServer({
  logger,
  registry,
}: MetricsServerOptions): FastifyInstance {
  // Widened so Fastify keeps its default logger type in FastifyInstance.
  const loggerInstance: FastifyBaseLogger = logger;
  const app = Fastify({ loggerInstance });

  // Scraped every few seconds: logged only when something is wrong, like
  // the probes. A route's logLevel replaces the server's.
  const quiet = logger.isLevelEnabled("warn")
    ? ({ logLevel: "warn" } as const)
    : {};

  app.get("/metrics", quiet, async (_request, reply) => {
    void reply.type(registry.contentType);
    return registry.metrics();
  });

  return app;
}
