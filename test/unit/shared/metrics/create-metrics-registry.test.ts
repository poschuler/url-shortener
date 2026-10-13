import { describe, expect, it } from "vitest";

import { createMetricsRegistry } from "#src/shared/metrics/create-metrics-registry.js";

describe("createMetricsRegistry", () => {
  it("collects the default Node.js metrics", async () => {
    const metrics = await createMetricsRegistry().metrics();

    expect(metrics).toContain("process_cpu_seconds_total");
    expect(metrics).toContain("nodejs_eventloop_lag_seconds");
  });

  it("gives each process a registry of its own", () => {
    expect(createMetricsRegistry()).not.toBe(createMetricsRegistry());
  });
});
