import { describe, expect, it } from "vitest";

import type {
  NumberRange,
  RangeAllocator,
} from "#src/modules/links/infrastructure/ranges/range-allocator.js";

// The behaviour every RangeAllocator must have. Each implementation runs it
// from its own test file: the in-memory fake in test/unit, the Postgres
// adapter in test/integration.
export function describeRangeAllocatorContract(
  createAllocator: () => RangeAllocator,
) {
  describe("RangeAllocator contract", () => {
    it("allocates a non-empty range", async () => {
      const range = await createAllocator().allocate();

      expect(range.end).toBeGreaterThan(range.start);
    });

    it("never hands out the same number twice", async () => {
      const allocator = createAllocator();

      const first = await allocator.allocate();
      const second = await allocator.allocate();

      expect(overlapping([first, second])).toEqual([]);
    });

    it("never hands out the same number twice to concurrent callers", async () => {
      const allocator = createAllocator();

      const ranges = await Promise.all(
        Array.from({ length: 20 }, () => allocator.allocate()),
      );

      expect(overlapping(ranges)).toEqual([]);
    });
  });
}

// Ranges that share at least one number with the range before them.
function overlapping(ranges: NumberRange[]): NumberRange[] {
  const sorted = ranges.toSorted((a, b) => (a.start < b.start ? -1 : 1));
  return sorted.filter((range, i) => i > 0 && range.start < sorted[i - 1].end);
}
