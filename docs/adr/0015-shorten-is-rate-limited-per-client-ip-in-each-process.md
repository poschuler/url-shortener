# Shorten is rate limited per client IP in each process

Shortening is open to anyone (ADR-0003), so `POST /links` is rate limited per client IP with `@fastify/rate-limit`, by default 20 requests per minute (`RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS`). The counters live in the memory of each process. Routes opt in to the limit, so the health and readiness probes are never limited, and whether Resolve is limited is decided with the read path. The client IP comes from the socket, unless the request arrives through a proxy listed in `TRUST_PROXY` (IP addresses, CIDR ranges, or the names `loopback`, `linklocal` and `uniquelocal`); only then is it taken from `X-Forwarded-For`. Trusting any proxy (`true`) was rejected because Fastify then takes the leftmost address in `X-Forwarded-For`, which the client itself can set. A hop count was rejected because, with Fastify 5.12, it never took the address from the header in our tests. A rejected request gets a 429 in Problem Details, and every limited response carries `x-ratelimit-*` headers.

## Considered Options

- **Counters in Redis**: one limit shared by every replica. It would make `write-api` depend on Redis only for this, and a Redis outage would then affect Shorten (ADR-0014).
- **Rate limiting only at a reverse proxy or CDN**: a good complement in production, but the local stack has no proxy, and the service should protect itself wherever it runs.
- **No rate limit until authentication exists**: leaves an open write endpoint with nothing to slow down a script that fills the database.

## Consequences

With N replicas, a client can make N times the limit, and the counters reset whenever a process restarts. Behind a proxy that is not listed in `TRUST_PROXY`, every client shares the proxy's address and so a single limit. A `TRUST_PROXY` that is too broad lets clients choose the address they are limited by. Moving the counters to Redis later changes the plugin's options in `buildServer`, not the routes.
