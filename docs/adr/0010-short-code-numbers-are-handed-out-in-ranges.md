# Short Code numbers are handed out in ranges

Every Shorten needs a number that has never been used before. The Short Code is that number run through the keyed permutation (ADR-0004), which is a bijection, so unique numbers give unique Short Codes without any collision check. Asking the database for one number on every Shorten would add a round trip to each request and put the database on the hot path of every write. Instead, each process reserves a range of numbers at once (1000 today) and hands them out from memory. It asks for the next range in the background once 20% of the current one is left, sends a single request at a time however many Shortens are waiting, and retries with exponential backoff. Where the ranges come from sits behind a `RangeAllocator`, so the use case only sees a `NumberSequence`.

## Considered Options

- **Hashing the Target URL**: seven base62 characters hold about 41 bits, so a truncated hash collides, and every Shorten needs a lookup and a retry. It would also give the same Short Code to the same Target URL, which ADR-0002 rules out.
- **Random Short Codes**: the same collision check on every Shorten, with more collisions as the space fills up.
- **UUIDs or Snowflake IDs**: unique without coordination, but 128 or 64 bits do not fit in seven base62 characters (62⁷ is about 3.5 × 10¹²).
- **One number per Shorten from the database**: the simplest option, at the cost of an extra round trip on every Shorten.

## Consequences

The numbers left in a range when a process stops are lost, so the sequence has gaps: up to 1000 numbers per restart. Gaps are harmless, because no number is ever handed out twice, and at that rate the space lasts for billions of restarts. Short Codes from different processes are not created in number order, which does not matter because the permutation already hides the order. A process cannot Shorten until it holds a range, so it reports itself as not ready until it reserves the first one. A bug that repeated a number would show up as a duplicate Short Code, so the `links` table will keep a unique constraint on the Short Code as a safety net.
