import type { NumberRange, RangeAllocator } from "../ranges/range-allocator.js";
import { type LinksMetrics, timeQuery } from "./links-metrics.js";

// Every allocate() is a range refill, retries included: the count of
// allocate_range tells how often the sequence reserves numbers.
export class InstrumentedRangeAllocator implements RangeAllocator {
  public constructor(
    private readonly allocator: RangeAllocator,
    private readonly queryDuration: LinksMetrics["queryDuration"],
  ) {}

  public allocate(): Promise<NumberRange> {
    return timeQuery(this.queryDuration, "allocate_range", () =>
      this.allocator.allocate(),
    );
  }
}
