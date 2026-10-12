import { assert, describe, expect, it } from "vitest";

import type { LinkCache } from "#src/modules/links/application/ports.js";
import { ShortCode } from "#src/modules/links/domain/short-code.vo.js";

// The behaviour every LinkCache must have while its store is reachable.
export function describeLinkCacheContract(createCache: () => LinkCache) {
  describe("LinkCache contract", () => {
    it("misses a code that was never cached", async () => {
      const cache = createCache();

      expect(await cache.get(code("abc1234"))).toEqual({ status: "miss" });
    });

    it("hits a cached target URL", async () => {
      const cache = createCache();
      await cache.set(code("abc1234"), "https://example.com/a");

      expect(await cache.get(code("abc1234"))).toEqual({
        status: "hit",
        url: "https://example.com/a",
      });
    });

    it("remembers a code that has no link", async () => {
      const cache = createCache();
      await cache.set(code("abc1234"), null);

      expect(await cache.get(code("abc1234"))).toEqual({
        status: "known-missing",
      });
    });

    it("replaces a known missing code once it has a link", async () => {
      const cache = createCache();
      await cache.set(code("abc1234"), null);
      await cache.set(code("abc1234"), "https://example.com/a");

      expect(await cache.get(code("abc1234"))).toEqual({
        status: "hit",
        url: "https://example.com/a",
      });
    });

    it("tells apart codes that differ only in case", async () => {
      const cache = createCache();
      await cache.set(code("abc1234"), "https://example.com/a");

      expect(await cache.get(code("ABC1234"))).toEqual({ status: "miss" });
    });
  });
}

export function code(value: string): ShortCode {
  const result = ShortCode.parse(value);
  assert(result.ok);
  return result.value;
}
