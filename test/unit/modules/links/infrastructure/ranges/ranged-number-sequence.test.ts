import { describe, expect, it, vi } from "vitest";

import { InMemoryRangeAllocator } from "#src/modules/links/infrastructure/in-memory/in-memory-range-allocator.js";
import type {
  NumberRange,
  RangeAllocator,
} from "#src/modules/links/infrastructure/ranges/range-allocator.js";
import { RangedNumberSequence } from "#src/modules/links/infrastructure/ranges/ranged-number-sequence.js";

const RETRY = { maxAttempts: 3, baseDelayMs: 50 };

function setup(allocator: RangeAllocator = new InMemoryRangeAllocator(10n)) {
  const allocate = vi.spyOn(allocator, "allocate");
  const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());
  const sequence = new RangedNumberSequence({
    allocator,
    refillThreshold: 0.2,
    retry: RETRY,
    sleep,
  });

  return { allocate, sequence, sleep };
}

// Rejects while `down` is true; otherwise behaves like the in-memory SEQUENCE.
function flakyAllocator(size: bigint) {
  const inner = new InMemoryRangeAllocator(size);
  const database = { down: false };
  const allocator: RangeAllocator = {
    allocate: () =>
      database.down
        ? Promise.reject(new Error("database is down"))
        : inner.allocate(),
  };

  return { allocator, database };
}

// Lets pending background work (promise callbacks) run to the end.
function settle(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function numbersFrom(first: number, count: number): bigint[] {
  return Array.from({ length: count }, (_, i) => BigInt(first + i));
}

async function take(
  sequence: RangedNumberSequence,
  count: number,
): Promise<bigint[]> {
  const numbers: bigint[] = [];

  for (let i = 0; i < count; i += 1) {
    numbers.push(await sequence.next());
  }

  return numbers;
}

describe("RangedNumberSequence", () => {
  it("hands out consecutive numbers from the allocated range", async () => {
    const { sequence } = setup();

    expect(await take(sequence, 3)).toEqual([1n, 2n, 3n]);
  });

  it("moves on to the next range when the current one runs out", async () => {
    const { sequence } = setup();

    expect(await take(sequence, 25)).toEqual(numbersFrom(1, 25));
  });

  it("refills early once the threshold is reached", async () => {
    const { allocate, sequence } = setup();

    await take(sequence, 7);
    expect(allocate).toHaveBeenCalledTimes(1);

    // 8 of 10 used: the 2 left are 20% of the range.
    await sequence.next();
    expect(allocate).toHaveBeenCalledTimes(2);
  });

  it("does not refill again while a spare range is waiting", async () => {
    const { allocate, sequence } = setup();

    await take(sequence, 10);

    expect(allocate).toHaveBeenCalledTimes(2);
  });

  it("makes a single allocation for many concurrent callers", async () => {
    const { allocate, sequence } = setup(new InMemoryRangeAllocator(1000n));

    const numbers = await Promise.all(
      Array.from({ length: 100 }, () => sequence.next()),
    );

    expect(new Set(numbers).size).toBe(100);
    expect(allocate).toHaveBeenCalledTimes(1);
  });

  it("never repeats a number when concurrent callers outrun a range", async () => {
    const { sequence } = setup(new InMemoryRangeAllocator(4n));

    const numbers = await Promise.all(
      Array.from({ length: 10 }, () => sequence.next()),
    );

    expect(numbers.toSorted((a, b) => Number(a - b))).toEqual(
      numbersFrom(1, 10),
    );
  });

  it("retries with exponential backoff", async () => {
    const failure = new Error("database is down");
    const { allocate, sequence, sleep } = setup();
    allocate.mockRejectedValueOnce(failure).mockRejectedValueOnce(failure);

    expect(await sequence.next()).toBe(1n);
    expect(allocate).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[50], [100]]);
  });

  it("fails after the last attempt and recovers on the next call", async () => {
    const { allocator, database } = flakyAllocator(10n);
    const { allocate, sequence } = setup(allocator);

    database.down = true;
    await expect(sequence.next()).rejects.toThrow("database is down");
    expect(allocate).toHaveBeenCalledTimes(RETRY.maxAttempts);

    database.down = false;
    expect(await sequence.next()).toBe(1n);
  });

  it("keeps serving the current range when a background refill fails", async () => {
    const { allocator, database } = flakyAllocator(10n);
    const { sequence } = setup(allocator);

    await sequence.next();
    database.down = true;

    expect(await take(sequence, 9)).toEqual(numbersFrom(2, 9));

    await settle();
    database.down = false;
    expect(await sequence.next()).toBe(11n);
  });

  it("allocates the first range when asked whether it is ready", async () => {
    const { allocate, sequence } = setup();

    await sequence.ready();
    await sequence.ready();

    expect(allocate).toHaveBeenCalledTimes(1);
    expect(await sequence.next()).toBe(1n);
    expect(allocate).toHaveBeenCalledTimes(1);
  });

  it("is not ready while the allocator keeps failing", async () => {
    const { allocator, database } = flakyAllocator(10n);
    const { sequence } = setup(allocator);
    database.down = true;

    await expect(sequence.ready()).rejects.toThrow("database is down");
  });

  it.each<NumberRange>([
    { start: 5n, end: 5n },
    { start: 5n, end: 4n },
  ])("throws when the allocator returns an empty range %o", async (range) => {
    const { allocate, sequence } = setup();
    allocate.mockResolvedValue(range);

    await expect(sequence.next()).rejects.toThrow("empty range");
    expect(allocate).toHaveBeenCalledTimes(1);
  });

  it.each([0, 1, -0.5, 1.5, Number.NaN])(
    "rejects a refill threshold of %d",
    (refillThreshold) => {
      expect(
        () =>
          new RangedNumberSequence({
            allocator: new InMemoryRangeAllocator(),
            refillThreshold,
            retry: RETRY,
          }),
      ).toThrow(RangeError);
    },
  );

  it.each([0, 1.5])("rejects %d retry attempts", (maxAttempts) => {
    expect(
      () =>
        new RangedNumberSequence({
          allocator: new InMemoryRangeAllocator(),
          refillThreshold: 0.2,
          retry: { maxAttempts, baseDelayMs: 50 },
        }),
    ).toThrow(RangeError);
  });
});
