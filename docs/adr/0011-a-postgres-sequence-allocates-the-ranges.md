# A Postgres sequence allocates the ranges

The ranges of ADR-0010 come from a Postgres sequence, `links.short_code_numbers`, created by a migration with `INCREMENT BY 1000`. A single `nextval()` reserves a whole range, from the value it returns up to that value plus the increment. Postgres already stores the Links, so this adds no new infrastructure, and a sequence is built for exactly this: `nextval()` is atomic across every process and connection, holds no lock until the end of a transaction and is never undone by a rollback, so no two callers ever get the same value. The allocator reads the increment in the same query as `nextval()`, so the size of a range is defined only by the sequence and cannot drift from a setting in the application.

## Considered Options

- **A counter table updated with `UPDATE ... RETURNING`**: works, but every allocation locks the same row until its transaction ends, and the sequence already does the job without that lock.
- **Redis `INCRBY`**: fast, but Redis is a cache here, with no persistence (see `compose.yaml`). Losing the counter would start it again from zero and hand out numbers that are already in use.
- **A coordination service such as ZooKeeper or etcd**: one more system to run for a single counter.
- **The range size as an application setting**: two sources of truth. If the setting were larger than the sequence's increment, two processes would hand out the same numbers.

## Consequences

Besides the gaps of ADR-0010, Postgres logs a sequence 32 calls ahead of the last one, so a Postgres crash can make it skip up to 32 ranges. Gaps are harmless. Changing the range size takes a migration with `ALTER SEQUENCE ... INCREMENT BY`, which running processes pick up on their next allocation. A sequence only moves backwards if someone resets it, restores an old backup or fails over to a replica that is behind. In those cases numbers could repeat, and the unique constraint on the Short Code rejects the duplicate Links instead of storing them.
