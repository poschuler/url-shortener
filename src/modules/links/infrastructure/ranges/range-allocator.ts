export interface NumberRange {
  /** First number of the range (inclusive). */
  readonly start: bigint;
  /** End of the range (exclusive). */
  readonly end: bigint;
}

export interface RangeAllocator {
  allocate(): Promise<NumberRange>;
}
