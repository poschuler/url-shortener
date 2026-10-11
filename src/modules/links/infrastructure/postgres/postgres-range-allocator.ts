import { type QueryExecutorProvider, sql } from "kysely";

import type { NumberRange, RangeAllocator } from "../ranges/range-allocator.js";

// Each nextval() reserves a whole range: [value, value + INCREMENT BY).
// The increment is read in the same query, so the range always matches the
// sequence, even after an ALTER SEQUENCE.
export class PostgresRangeAllocator implements RangeAllocator {
  public constructor(private readonly db: QueryExecutorProvider) {}

  public async allocate(): Promise<NumberRange> {
    // pg returns int8 columns as strings.
    const { rows } = await sql<{ start: string; size: string }>`
      select
        nextval('links.short_code_numbers') as "start",
        seqincrement as "size"
      from pg_sequence
      where seqrelid = 'links.short_code_numbers'::regclass
    `.execute(this.db);

    const [{ start, size }] = rows;
    return { start: BigInt(start), end: BigInt(start) + BigInt(size) };
  }
}
