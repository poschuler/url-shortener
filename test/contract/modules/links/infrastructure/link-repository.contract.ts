import { assert, describe, expect, it } from "vitest";

import { Link } from "#src/modules/links/domain/link.js";
import type { LinkRepository } from "#src/modules/links/domain/link.repository.js";
import { ShortCode } from "#src/modules/links/domain/short-code.vo.js";
import { TargetUrl } from "#src/modules/links/domain/target-url.js";

const NOW = new Date("2026-10-11T12:00:00.000Z");

// The behaviour every LinkRepository must have. Each implementation runs it
// from its own test file: the in-memory fake in test/unit, the Postgres
// adapter in test/integration.
export function describeLinkRepositoryContract(
  createRepository: () => LinkRepository,
) {
  describe("LinkRepository contract", () => {
    it("saves links with different codes", async () => {
      const repository = createRepository();

      await repository.save(createLink("abc1234", "https://example.com/a"));

      await expect(
        repository.save(createLink("abc1235", "https://example.com/b")),
      ).resolves.toBeUndefined();
    });

    it("rejects a link whose code is already saved", async () => {
      const repository = createRepository();
      await repository.save(createLink("abc1234", "https://example.com/a"));

      await expect(
        repository.save(createLink("abc1234", "https://example.com/b")),
      ).rejects.toThrow(/duplicate/i);
    });
  });
}

export function createLink(code: string, url: string): Link {
  const shortCode = ShortCode.parse(code);
  const targetUrl = TargetUrl.parse(url, {
    maxLength: 2048,
    reservedHostname: "short.example",
  });
  assert(shortCode.ok && targetUrl.ok);

  return Link.create({ code: shortCode.value, url: targetUrl.value, now: NOW });
}
