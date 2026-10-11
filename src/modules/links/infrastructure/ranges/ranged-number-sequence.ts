import { setTimeout as delay } from "node:timers/promises";

import type { BaseLogger } from "pino";

import type { NumberSequence } from "../../application/ports.js";
import type { NumberRange, RangeAllocator } from "./range-allocator.js";

export type RetryOptions = {
  maxAttempts: number;
  baseDelayMs: number;
};

export type RangedNumberSequenceOptions = {
  allocator: RangeAllocator;
  /** Fraction of the current range left (0 to 1) that triggers an early refill. */
  refillThreshold: number;
  retry: RetryOptions;
  logger: BaseLogger;
  sleep?: (ms: number) => Promise<void>;
};

type CurrentRange = {
  next: bigint;
  readonly end: bigint;
  readonly size: bigint;
};

export class RangedNumberSequence implements NumberSequence {
  private readonly allocator: RangeAllocator;
  private readonly refillThreshold: number;
  private readonly retry: RetryOptions;
  private readonly logger: BaseLogger;
  private readonly sleep: (ms: number) => Promise<void>;

  private current: CurrentRange | null = null;
  private spare: NumberRange | null = null;
  private inFlight: Promise<void> | null = null;

  public constructor(options: RangedNumberSequenceOptions) {
    if (!(options.refillThreshold > 0 && options.refillThreshold < 1)) {
      throw new RangeError("refillThreshold must be between 0 and 1");
    }

    if (
      !Number.isInteger(options.retry.maxAttempts) ||
      options.retry.maxAttempts < 1
    ) {
      throw new RangeError("retry.maxAttempts must be a positive integer");
    }

    this.allocator = options.allocator;
    this.refillThreshold = options.refillThreshold;
    this.retry = options.retry;
    this.logger = options.logger;
    this.sleep = options.sleep ?? ((ms) => delay(ms));
  }

  public async next(): Promise<bigint> {
    // Loop: when many callers wait for the same refill, the new range
    // can run out before every one of them gets a number.
    for (;;) {
      const number = this.take();

      if (number !== null) {
        this.refillIfLow();
        return number;
      }

      await this.refill();
    }
  }

  public async ready(): Promise<void> {
    if (!this.hasNumbers()) {
      await this.refill();
    }
  }

  private take(): bigint | null {
    if (this.current === null || this.current.next >= this.current.end) {
      if (this.spare === null) {
        return null;
      }

      this.current = {
        next: this.spare.start,
        end: this.spare.end,
        size: this.spare.end - this.spare.start,
      };
      this.spare = null;
    }

    const number = this.current.next;
    this.current.next += 1n;
    return number;
  }

  private hasNumbers(): boolean {
    return (
      this.spare !== null ||
      (this.current !== null && this.current.next < this.current.end)
    );
  }

  private refillIfLow(): void {
    if (
      this.current === null ||
      this.spare !== null ||
      this.inFlight !== null
    ) {
      return;
    }

    const left = Number(this.current.end - this.current.next);

    if (left <= this.refillThreshold * Number(this.current.size)) {
      // Only logged: the current range still has numbers, and if it runs
      // out, next() refills again and gets the error itself.
      this.refill().catch((error: unknown) => {
        this.logger.warn({ err: error }, "Background range refill failed");
      });
    }
  }

  private refill(): Promise<void> {
    // Single-flight: every caller shares the same pending refill.
    this.inFlight ??= this.allocateWithRetry()
      .then((range) => {
        if (range.end <= range.start) {
          throw new Error(
            `Allocator returned an empty range [${range.start}, ${range.end})`,
          );
        }

        this.spare = range;
      })
      .finally(() => {
        this.inFlight = null;
      });

    return this.inFlight;
  }

  private async allocateWithRetry(): Promise<NumberRange> {
    const { maxAttempts, baseDelayMs } = this.retry;

    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.allocator.allocate();
      } catch (error) {
        if (attempt >= maxAttempts) {
          throw error;
        }

        await this.sleep(baseDelayMs * 2 ** (attempt - 1));
      }
    }
  }
}
