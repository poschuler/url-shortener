import { Registry } from "@prometheus-io/client";
import { describe, expect, it } from "vitest";

import { permutationKeyFromHex } from "#src/modules/links/domain/short-code-permutation.js";
import { ShortCode } from "#src/modules/links/domain/short-code.vo.js";
import { InMemoryLinkRepository } from "#src/modules/links/infrastructure/in-memory/in-memory-link-repository.js";
import { InstrumentedTargetUrlLookup } from "#src/modules/links/infrastructure/metrics/instrumented-target-url-lookup.js";
import { createLinksMetrics } from "#src/modules/links/infrastructure/metrics/links-metrics.js";

const KEY = permutationKeyFromHex("000102030405060708090a0b0c0d0e0f");

describe("InstrumentedTargetUrlLookup", () => {
  it("times each lookup as find_target_url", async () => {
    const registry = new Registry();
    const lookup = new InstrumentedTargetUrlLookup(
      new InMemoryLinkRepository(),
      createLinksMetrics(registry).queryDuration,
    );

    expect(await lookup.findTargetUrl(ShortCode.fromNumber(0n, KEY))).toBe(
      null,
    );

    expect(await registry.metrics()).toContain(
      'links_db_query_duration_seconds_count{operation="find_target_url",outcome="ok"} 1',
    );
  });
});
