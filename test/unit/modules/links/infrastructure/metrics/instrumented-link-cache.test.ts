import { Registry } from "@prometheus-io/client";
import { describe, expect, it } from "vitest";

import { permutationKeyFromHex } from "#src/modules/links/domain/short-code-permutation.js";
import { ShortCode } from "#src/modules/links/domain/short-code.vo.js";
import { InMemoryLinkCache } from "#src/modules/links/infrastructure/in-memory/in-memory-link-cache.js";
import { InstrumentedLinkCache } from "#src/modules/links/infrastructure/metrics/instrumented-link-cache.js";
import { createLinksMetrics } from "#src/modules/links/infrastructure/metrics/links-metrics.js";

const KEY = permutationKeyFromHex("000102030405060708090a0b0c0d0e0f");
const HIT = ShortCode.fromNumber(0n, KEY);
const KNOWN_MISSING = ShortCode.fromNumber(1n, KEY);
const MISS = ShortCode.fromNumber(2n, KEY);

describe("InstrumentedLinkCache", () => {
  it("counts each read by its result and returns it unchanged", async () => {
    const registry = new Registry();
    const inner = new InMemoryLinkCache();
    await inner.set(HIT, "https://example.com/a");
    await inner.set(KNOWN_MISSING, null);
    const cache = new InstrumentedLinkCache(
      inner,
      createLinksMetrics(registry).cacheLookups,
    );

    expect(await cache.get(HIT)).toEqual({
      status: "hit",
      url: "https://example.com/a",
    });
    await cache.get(HIT);
    await cache.get(KNOWN_MISSING);
    await cache.get(MISS);

    const metrics = await registry.metrics();
    expect(metrics).toContain('links_cache_lookups_total{result="hit"} 2');
    expect(metrics).toContain(
      'links_cache_lookups_total{result="known-missing"} 1',
    );
    expect(metrics).toContain('links_cache_lookups_total{result="miss"} 1');
  });

  it("passes writes through", async () => {
    const inner = new InMemoryLinkCache();
    const cache = new InstrumentedLinkCache(
      inner,
      createLinksMetrics(new Registry()).cacheLookups,
    );

    await cache.set(HIT, "https://example.com/a");

    expect(await inner.get(HIT)).toEqual({
      status: "hit",
      url: "https://example.com/a",
    });
  });
});
