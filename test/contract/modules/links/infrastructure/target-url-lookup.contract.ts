import { assert, describe, expect, it } from "vitest";

import type { TargetUrlLookup } from "#src/modules/links/application/ports.js";
import type { LinkRepository } from "#src/modules/links/domain/link.repository.js";
import { ShortCode } from "#src/modules/links/domain/short-code.vo.js";

import { createLink } from "./link-repository.contract.js";

// The lookup reads what the repository saved, so each implementation hands
// over a pair that shares one store.
export type TargetUrlLookupFixture = {
  repository: LinkRepository;
  lookup: TargetUrlLookup;
};

export function describeTargetUrlLookupContract(
  createFixture: () => TargetUrlLookupFixture,
) {
  describe("TargetUrlLookup contract", () => {
    it("finds the target URL of a saved link", async () => {
      const { repository, lookup } = createFixture();
      await repository.save(createLink("abc1234", "https://example.com/a"));
      await repository.save(createLink("abc1235", "https://example.com/b"));

      expect(await lookup.findTargetUrl(code("abc1235"))).toBe(
        "https://example.com/b",
      );
    });

    it("returns null for a code that was never saved", async () => {
      const { repository, lookup } = createFixture();
      await repository.save(createLink("abc1234", "https://example.com/a"));

      expect(await lookup.findTargetUrl(code("abc1235"))).toBeNull();
    });

    it("tells apart codes that differ only in case", async () => {
      const { repository, lookup } = createFixture();
      await repository.save(createLink("abc1234", "https://example.com/a"));

      expect(await lookup.findTargetUrl(code("ABC1234"))).toBeNull();
    });
  });
}

function code(value: string): ShortCode {
  const result = ShortCode.parse(value);
  assert(result.ok);
  return result.value;
}
