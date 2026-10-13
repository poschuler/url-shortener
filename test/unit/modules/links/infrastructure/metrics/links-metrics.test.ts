import { Registry } from "@prometheus-io/client";
import { describe, expect, it } from "vitest";

import {
  createLinksMetrics,
  timeQuery,
} from "#src/modules/links/infrastructure/metrics/links-metrics.js";

describe("timeQuery", () => {
  it("times a query that succeeds and returns its result", async () => {
    const registry = new Registry();
    const { queryDuration } = createLinksMetrics(registry);

    const result = await timeQuery(queryDuration, "some_query", () =>
      Promise.resolve(42),
    );

    expect(result).toBe(42);
    expect(await registry.metrics()).toContain(
      'links_db_query_duration_seconds_count{operation="some_query",outcome="ok"} 1',
    );
  });

  it("times a query that fails and rethrows its error", async () => {
    const registry = new Registry();
    const { queryDuration } = createLinksMetrics(registry);
    const error = new Error("Postgres is down");

    await expect(
      timeQuery(queryDuration, "some_query", () => Promise.reject(error)),
    ).rejects.toBe(error);
    expect(await registry.metrics()).toContain(
      'links_db_query_duration_seconds_count{operation="some_query",outcome="error"} 1',
    );
  });
});
