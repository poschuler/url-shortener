import type { NumberRange, RangeAllocator } from "../ranges/range-allocator.js";

// Behaves like a Postgres SEQUENCE with INCREMENT BY `size`.
export class InMemoryRangeAllocator implements RangeAllocator {
  private nextStart: bigint;

  public constructor(
    private readonly size = 1000n,
    first = 1n,
  ) {
    this.nextStart = first;
  }

  public allocate(): Promise<NumberRange> {
    const start = this.nextStart;
    this.nextStart += this.size;
    return Promise.resolve({ start, end: start + this.size });
  }
}
