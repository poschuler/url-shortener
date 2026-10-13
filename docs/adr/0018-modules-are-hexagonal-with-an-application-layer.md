# Modules are hexagonal, with an application layer

Each module lives in `src/modules/<module>/` and has four layers. `domain/` holds the entities, the value objects and the rules. `application/` holds the use cases, one class each, and the ports they need. `infrastructure/` holds the adapters that implement those ports against Postgres and Redis, plus in-memory fakes for tests. `http/` holds the Fastify routes that drive the use cases. The domain and the use cases do no I/O and know no framework: everything outside reaches them, or is reached by them, through a port.

A port lives where it is needed. `domain/` only declares the ports the domain itself calls for: `LinkRepository`, which saves the domain's own entity. Ports that only the use cases need live in `application/ports.ts`: `NumberSequence` hands out numbers to Shorten, and `LinkCache` and `TargetUrlLookup` return plain data to Resolve, which reads without rebuilding a Link (ADR-0008). A port that only one adapter needs stays inside `infrastructure/`, like `RangeAllocator` behind `RangedNumberSequence`.

The wiring is written by hand. A module exposes it in its `index.ts`, as functions that take configuration and clients and return routes and readiness checks; the entrypoints are the composition roots that create the clients and call those functions. dependency-cruiser enforces the layers and the module boundary (ADR-0009). [`docs/architecture.md`](../architecture.md) draws the components of the `links` module.

## Considered Options

- **Classic layers** (routes, services, repositories): fewer files, but services end up importing the query builder, so their tests need a database and storage choices leak into business code.
- **Clean Architecture with every ring** (entities, use cases, interface adapters, frameworks, with request and response models at each boundary): the same direction of dependencies with more mapping than a module this size needs.
- **Every port in `domain/`**: the domain would declare interfaces it never uses, such as the cache.
- **A dependency injection container** (awilix, tsyringe, or NestJS's own): it hides the wiring that `index.ts` shows in one place, and adds decorators or registration by name for no gain at this size.

## Consequences

A module has more files and interfaces than a CRUD service would. In exchange, the use cases are tested against in-memory fakes with no database, and an adapter can change without touching the core. A new module copies the structure of `links`, and other modules can use it only through its `index.ts`.
