# Resolve reads through a Redis cache with negative entries

Resolve is cache-aside: `ResolveLink` asks the `LinkCache` port first and, on a miss, reads the Target URL from Postgres and stores the result. Because Links are immutable (ADR-0001), a cached Target URL never needs invalidation: its TTL (`CACHE_TTL_SECONDS`, one day by default) only lets unused codes leave the cache. A Short Code without a Link is cached too, as an empty string, for a shorter time (`CACHE_NEGATIVE_TTL_SECONDS`, 60 seconds), so repeated requests for a missing code do not all reach Postgres. A Target URL is never empty, so the empty string cannot be mistaken for one. Keys are `links:target-url:<code>`.

The cache is optional. If Redis fails, times out or is unreachable, a read becomes a miss and a write is skipped, both with a warning, and Resolve answers from Postgres. That is why the readiness check of `read-api` does not include Redis, and why `read-api` starts without waiting for it: the client connects in the background and keeps reconnecting.

The client is `@redis/client` (node-redis) without the `redis` package, which would also bring the Redis Stack modules. It has one gap: its command timeout only counts while a command waits to be sent; once the command is written to the socket the timer is removed, so a Redis that hangs with the connection open makes a `GET` wait forever. Its socket timeout does not help either: traffic keeps resetting it, and without traffic it cuts healthy connections. This was reproduced with a real Redis under `docker pause`. So `RedisLinkCache` wraps every command in its own `withTimeout` (200 ms), and an integration test pauses Redis with `CLIENT PAUSE` and checks that the cache answers a miss within a second. The client also rejects commands while disconnected (`disableOfflineQueue`) instead of queueing them.

In the local stack Redis keeps nothing on disk and has a memory limit with `allkeys-lru`, so a long scan of missing codes evicts the least recently used keys instead of filling memory with negative entries.

## Considered Options

- **ioredis**: its `commandTimeout` does reject a command that Redis never answers, but the README of ioredis 6 describes its maintenance as best-effort and recommends node-redis for new projects.
- **No negative cache**: simpler, but every request for a missing code would reach Postgres, which makes scanning cheap for the client and expensive for the service.
- **Making Redis required (readiness check, fail on errors)**: a Redis outage would take Resolve down although Postgres can answer every request.
- **An in-process cache**: no extra service, but each replica would warm up on its own and its memory would grow with the number of codes.

## Consequences

A Short Code created within 60 seconds of a 404 for that same code keeps answering 404 until the negative entry expires. That is unlikely, because codes come from a keyed permutation and nobody outside can predict the next one (ADR-0004). While Redis hangs, timed-out commands stay pending in the client's memory until Redis answers or the connection drops. Every cache failure and every failed reconnect logs a warning, so an outage is noisy. Postgres must be able to take the whole read load while Redis is down.
