# Shorten goes through the domain, Resolve reads through a query port

Shorten is a command: it builds the Short Code and the Target URL through their value objects, creates a Link and saves it through a repository port. Resolve is a query: it only needs the Target URL for a Short Code, so it reads through a dedicated port that returns plain data (the Target URL as a string, or nothing) instead of rehydrating a Link. The domain model exists to enforce rules, and Resolve enforces none: a stored Link was valid when it was created and stays resolvable even if the rules change later (ADR-0001). Rehydrating it would add a mapping step on the hot path, make the cache serialize whole Links, and need a `Link.restore` factory whose only caller throws away everything but the URL.

Skipping the entity does not mean skipping the port. Query builders such as Kysely live only in `infrastructure/` adapters, never in `application/`. That keeps the cache-aside logic of Resolve apart from storage, lets its tests run against in-memory fakes, and keeps the rule that the application layer depends only on the domain.

## Considered Options

- **A repository that returns Links on both paths**: the orthodox hexagonal shape. It costs a rehydration factory, a serialized form of Link in the cache and a mapping on every Resolve, with no rule to enforce in return.
- **Queries written in the use case** (Kysely in `application/`): a common pragmatic choice, and the read here is a single key lookup. Rejected because it mixes caching with SQL, needs a database to test Resolve and breaks the dependency boundary.

## Consequences

The cache stores Target URLs as strings, for positive and negative entries alike. `Link` has no rehydration factory; one is added when a use case first needs to read a whole Link, for example listing a user's Links once authentication exists (ADR-0003). There is still one table and one shape of the data: this splits reads and writes at the port level, not into separate stores.
