import { Registry } from "@prometheus-io/client";
import { describe, expect, it } from "vitest";

import { InMemoryRangeAllocator } from "#src/modules/links/infrastructure/in-memory/in-memory-range-allocator.js";
import { InstrumentedRangeAllocator } from "#src/modules/links/infrastructure/metrics/instrumented-range-allocator.js";
import { createLinksMetrics } from "#src/modules/links/infrastructure/metrics/links-metrics.js";

describe("InstrumentedRangeAllocator", () => {
  it("times each allocation as allocate_range", async () => {
    const registry = new Registry();
    const allocator = new InstrumentedRangeAllocator(
      new InMemoryRangeAllocator(1000n),
      createLinksMetrics(registry).queryDuration,
    );

    expect(await allocator.allocate()).toEqual({ start: 1n, end: 1001n });
    await allocator.allocate();

    expect(await registry.metrics()).toContain(
      'links_db_query_duration_seconds_count{operation="allocate_range",outcome="ok"} 2',
    );
  });
});
