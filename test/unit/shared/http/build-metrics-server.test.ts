import { Counter, Registry } from "@prometheus-io/client";
import { pino } from "pino";
import { describe, expect, it } from "vitest";

import { buildMetricsServer } from "#src/shared/http/build-metrics-server.js";

const logger = pino({ level: "silent" });

describe("buildMetricsServer", () => {
  it("serves the registry in the Prometheus text format", async () => {
    const registry = new Registry();
    new Counter({
      name: "things_total",
      help: "Things.",
      registers: [registry],
    }).inc(3);
    const app = buildMetricsServer({ logger, registry });

    const response = await app.inject({ url: "/metrics" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe(registry.contentType);
    expect(response.body).toContain("things_total 3");
  });

  it("serves nothing else", async () => {
    const app = buildMetricsServer({ logger, registry: new Registry() });

    const response = await app.inject({ url: "/health" });

    expect(response.statusCode).toBe(404);
  });
});
