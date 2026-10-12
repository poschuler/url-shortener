# Routes are rate limited per client IP in each process

Shortening is open to anyone (ADR-0003), so `POST /links` is rate limited per client IP with `@fastify/rate-limit`, by default 20 requests per minute (`SHORTEN_RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS`). The counters live in the memory of each process. Routes opt in to the limit with their own maximum and share the window, so the health and readiness probes are never limited. Resolve is limited too, more generously: 300 requests per window by default (`RESOLVE_RATE_LIMIT_MAX`). A well-formed code without a Link skips the cache the first time and costs a Postgres query and a Redis key (ADR-0017), and the limit slows down scanning from a single IP. It is generous because Resolve creates nothing permanent, and many Visitors can share one address (NAT, carrier-grade NAT, link preview bots); distributed scanning is for the edge (CDN, WAF) to stop. The client IP comes from the socket, unless the request arrives through a proxy listed in `TRUST_PROXY` (IP addresses, CIDR ranges, or the names `loopback`, `linklocal` and `uniquelocal`); only then is it taken from `X-Forwarded-For`. Trusting any proxy (`true`) was rejected because Fastify then takes the leftmost address in `X-Forwarded-For`, which the client itself can set. A hop count was rejected because, with Fastify 5.12, it never took the address from the header in our tests. A rejected request gets a 429 in Problem Details, and every limited response carries `x-ratelimit-*` headers.

## Considered Options

- **Counters in Redis**: one limit shared by every replica. It would make `write-api` depend on Redis only for this, and a Redis outage would then affect Shorten (ADR-0014).
- **Rate limiting only at a reverse proxy or CDN**: a good complement in production, but the local stack has no proxy, and the service should protect itself wherever it runs.
- **No rate limit until authentication exists**: leaves an open write endpoint with nothing to slow down a script that fills the database.
- **Limiting only the 404s of Resolve**: aims at scanning without touching real visits, but needs custom code around the plugin, and a scan of existing codes would still pass.

## Consequences

With N replicas, a client can make N times the limit, and the counters reset whenever a process restarts. Behind a proxy that is not listed in `TRUST_PROXY`, every client shares the proxy's address and so a single limit. A `TRUST_PROXY` that is too broad lets clients choose the address they are limited by. Moving the counters to Redis later changes the plugin's options in `buildServer`, not the routes.
