import { Histogram, type Registry } from "@prometheus-io/client";
import type { FastifyInstance } from "fastify";

// In seconds. The defaults start at 5ms, slower than a cached redirect.
const DURATION_BUCKETS = [
  0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5,
];

export function registerRequestMetrics(
  app: FastifyInstance,
  registry: Registry,
): void {
  const duration = new Histogram({
    name: "http_request_duration_seconds",
    help: "Time to answer an HTTP request, by route and status code.",
    labelNames: ["method", "route", "status_code"] as const,
    buckets: DURATION_BUCKETS,
    registers: [registry],
  });

  app.addHook("onResponse", async (request, reply) => {
    duration.observe(
      {
        method: request.method,
        // The route pattern (/:code), not the URL: one series per route
        // instead of one per Short Code. Unknown URLs share a single one.
        route: request.routeOptions.url ?? "unmatched",
        status_code: reply.statusCode,
      },
      reply.elapsedTime / 1_000,
    );
  });
}
