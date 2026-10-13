import { Registry } from "@prometheus-io/client";
import { assert, describe, expect, it } from "vitest";

import { Link } from "#src/modules/links/domain/link.js";
import { permutationKeyFromHex } from "#src/modules/links/domain/short-code-permutation.js";
import { ShortCode } from "#src/modules/links/domain/short-code.vo.js";
import { TargetUrl } from "#src/modules/links/domain/target-url.js";
import { InMemoryLinkRepository } from "#src/modules/links/infrastructure/in-memory/in-memory-link-repository.js";
import { InstrumentedLinkRepository } from "#src/modules/links/infrastructure/metrics/instrumented-link-repository.js";
import { createLinksMetrics } from "#src/modules/links/infrastructure/metrics/links-metrics.js";

const KEY = permutationKeyFromHex("000102030405060708090a0b0c0d0e0f");

describe("InstrumentedLinkRepository", () => {
  it("times each save as save_link", async () => {
    const registry = new Registry();
    const inner = new InMemoryLinkRepository();
    const repository = new InstrumentedLinkRepository(
      inner,
      createLinksMetrics(registry).queryDuration,
    );
    const url = TargetUrl.parse("https://example.com/a", {
      maxLength: 2048,
      reservedHostname: "short.example",
    });
    assert(url.ok);

    await repository.save(
      Link.create({
        code: ShortCode.fromNumber(0n, KEY),
        url: url.value,
        now: new Date(),
      }),
    );

    expect(inner.all()).toHaveLength(1);
    expect(await registry.metrics()).toContain(
      'links_db_query_duration_seconds_count{operation="save_link",outcome="ok"} 1',
    );
  });
});
