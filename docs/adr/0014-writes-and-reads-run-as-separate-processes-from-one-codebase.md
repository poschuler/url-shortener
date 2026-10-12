# Writes and reads run as separate processes from one codebase

The service is a modular monolith: one codebase and one image, deployed as several processes. `write-api` runs Shorten and needs only Postgres. `read-api` will run Resolve with Postgres and Redis. `api` runs everything in one process for development, and `migrate` applies the migrations and exits. Resolve is the hot path: it is far more frequent than Shorten and needs a cache that Shorten does not use. Separate processes let each side scale on its own, keep a Redis outage away from Shorten, and let a deployment keep `write-api` off the public network (ADR-0003). Modules do not know which process runs them: `modules/links/index.ts` exposes `createLinksWriteModule`, which returns the module's readiness checks and a function that registers its routes, and each entrypoint decides which modules it composes. Moving a feature from one process to another changes an entrypoint, not a module.

## Considered Options

- **A single process for everything**: the simplest deployment, but reads and writes would scale together and every instance would need every dependency. It remains available as `api`, for development.
- **Separate services with their own repositories or databases**: there is one domain and one `links` table, so splitting them would add network calls, deployments and versioning between services without separating any data.
- **Modules that start their own server**: each module would own a port and a lifecycle, which ties a module to a process and makes the all-in-one `api` hard to build.

## Consequences

Each process validates only the configuration it uses, so `write-api` starts without any Redis settings. The entrypoints are written by hand and repeat each other, as `api.ts` and `write-api.ts` already do; that is accepted, because each composition root shows in one place what its process runs. Every process that Shortens reserves its own ranges of numbers, so more processes and restarts leave more gaps in the sequence (ADR-0010). Limits kept in memory, such as the rate limit, apply to each process separately. The public base URL in Short URLs must point to the process that resolves them, not to `write-api`. The local stack runs `api` and `write-api` side by side; how it runs once `read-api` exists is decided with the read path.
