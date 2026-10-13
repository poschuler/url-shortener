# url-shortener

[![CI](https://github.com/poschuler/url-shortener/actions/workflows/ci.yml/badge.svg)](https://github.com/poschuler/url-shortener/actions/workflows/ci.yml)

A URL shortener built with Node.js, TypeScript and Fastify: a modular monolith with hexagonal architecture, used as a reference project for posts on [poschuler.com](https://poschuler.com).

> **Status: work in progress.** Shorten and Resolve work end to end: `POST /links` stores Links in Postgres, and `GET /:code` redirects to the Target URL through a Redis cache.

## What it does

- **Shorten**: turns a Target URL into a Short URL with a seven-character, case-sensitive Short Code.
- **Resolve**: redirects a Visitor who follows a Short URL to its Target URL.

Writes and reads run as separate processes built from the same codebase: `write-api` for Shorten and `read-api` for Resolve ([ADR-0014](docs/adr/0014-writes-and-reads-run-as-separate-processes-from-one-codebase.md)). For development, `api` runs everything in one process.

## Documentation

- [`CONTEXT.md`](CONTEXT.md): the domain language (Link, Short Code, Target URL, Short URL, Visitor).
- [`docs/adr/`](docs/adr/): architecture decision records, numbered in the order they were made.

## Requirements

- Node.js 24 or later
- pnpm 11
- Docker, for integration tests, end-to-end tests and the local stack

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm check
```

## Scripts

| Script                              | What it does                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `pnpm check`                        | Format check, lint, type check, dependency boundaries and tests with coverage thresholds |
| `pnpm test`                         | Runs the unit tests once                                                                 |
| `pnpm test:watch`                   | Runs the unit tests on every change                                                      |
| `pnpm test:coverage`                | Runs the unit tests with a coverage report in `coverage/`                                |
| `pnpm test:integration`             | Runs the integration tests against Postgres and Redis in containers (needs Docker)       |
| `pnpm test:e2e`                     | Runs the end-to-end tests against the running compose stack                              |
| `pnpm lint` / `pnpm lint:fix`       | Lints with oxlint, optionally fixing what it can                                         |
| `pnpm format` / `pnpm format:check` | Formats with oxfmt, or only checks                                                       |
| `pnpm typecheck`                    | Type checks sources, tests and config files                                              |
| `pnpm deps:check`                   | Checks module and layer boundaries with dependency-cruiser                               |
| `pnpm build`                        | Compiles `src/` to `dist/`                                                               |
| `pnpm dev`                          | Runs the all-in-one API from `src/`, restarting on every change                          |
| `pnpm start`                        | Runs the compiled all-in-one API from `dist/` (run `pnpm build` first)                   |
| `pnpm db:migrate`                   | Applies the pending database migrations to the Postgres in `.env`                        |
| `pnpm db:migrate:down`              | Reverts the last applied migration                                                       |

## Docker

`compose.yaml` runs two processes from the same image, both with health checks, plus Postgres 17 and Redis 7. It reads its values from `.env`:

- `write-api` on port 3001: Shorten only, without Redis.
- `read-api` on port 3002: Resolve only. It caches Target URLs in Redis and falls back to Postgres when Redis is down, so its readiness check does not depend on Redis.

`PUBLIC_BASE_URL` in `.env.example` points to `read-api`, so the Short URLs that `write-api` returns can be followed.

A one-off `migrate` service applies the database migrations first; the APIs start only if it succeeds:

```bash
docker compose up -d --build --wait --remove-orphans
curl -i localhost:3001/links -H 'content-type: application/json' -d '{"url":"https://example.com"}'
curl -i localhost:3002/<code>   # the code from the response: 302 to https://example.com
docker compose down
```

Each API also serves Prometheus metrics at `/metrics` on a port of its own, `METRICS_PORT` (9464 by default), never on its public port. The stack publishes them on `127.0.0.1` only: `write-api` on port 9464 and `read-api` on port 9465.

```bash
curl -s localhost:9464/metrics | grep http_request_duration_seconds_count
```

Besides the Node.js process metrics, they include:

- `http_request_duration_seconds`: every request, by `method`, `route` (the route pattern, or `unmatched`) and `status_code`.
- `links_cache_lookups_total`: cache reads in `read-api`, by `result` (`hit`, `known-missing` or `miss`). A Redis failure counts as a `miss`.
- `links_db_query_duration_seconds`: Postgres queries, by `operation` (`allocate_range`, `save_link` or `find_target_url`) and `outcome` (`ok` or `error`).

`--remove-orphans` removes containers of services that are no longer in `compose.yaml`, such as an older all-in-one `api`.

Both routes are rate limited per client IP, each with its own maximum in the same window of `RATE_LIMIT_WINDOW_MS`: `SHORTEN_RATE_LIMIT_MAX` for `POST /links` and a more generous `RESOLVE_RATE_LIMIT_MAX` for `GET /:code`. Behind a reverse proxy, list its addresses in `TRUST_PROXY` so the limit applies to the real client instead of the proxy.

Redis is a cache only: it keeps no data on disk and, once it reaches its memory limit, evicts the least recently used keys. Target URLs stay cached for `CACHE_TTL_SECONDS`, and Short Codes without a Link for `CACHE_NEGATIVE_TTL_SECONDS`.

Postgres and Redis are also published on `127.0.0.1`, so `pnpm dev` can use them from the host. The all-in-one `api` listens on port 3000, so set `PUBLIC_BASE_URL=http://localhost:3000` in `.env` to follow its Short URLs. `docker compose down -v` also deletes the Postgres volume. To revert the last migration inside the stack:

```bash
docker compose run --rm migrate node dist/entrypoints/migrate.js down
```

The `Dockerfile` builds a production image that runs as the non-root `node` user. By default it starts the all-in-one `api`; the compose stack overrides the command for `migrate`, `write-api` and `read-api`. To run it on its own:

```bash
docker build -t url-shortener .
docker run --rm -p 3000:3000 --env-file .env url-shortener
curl -i localhost:3000/health
```

`docker run --env-file` keeps quotes as part of the value, so keep the values in `.env` unquoted. The container shuts down gracefully on `SIGTERM` (`docker stop`).

## Load testing

`test/load/resolve-link.ts` is a [k6](https://grafana.com/docs/k6/) script for the read path. It runs in the `k6` service of the compose stack, from the `grafana/k6` image, so nothing has to be installed. It first creates 1000 links, then asks `read-api` for them at a fixed rate: 500 requests per second for one minute, a tenth of them for Short Codes without a Link.

The stack has to be up with raised rate limits, because every request comes from the same IP. Variables set in the shell take precedence over `.env`:

```bash
SHORTEN_RATE_LIMIT_MAX=100000 RESOLVE_RATE_LIMIT_MAX=10000000 docker compose up -d --build --wait
docker compose run --rm k6
docker compose run --rm -e RATE=1000 -e DURATION=30s k6   # another rate or duration
docker compose up -d --wait                               # back to the limits in .env
```

k6 exits with an error when more than 1% of the requests fail or when the 95th and 99th percentiles go past 100 ms and 250 ms. The thresholds are loose on purpose: they catch a broken cache or a wall of 429s, not a slower machine. After a run, the metrics of `read-api` show the cache hit ratio and the time spent in Postgres:

```bash
curl -s localhost:9465/metrics | grep -E '^links_'
```

## Continuous integration

GitHub Actions runs `pnpm check`, the integration tests, and the end-to-end tests against the compose stack on every push to `main` and on every pull request (`.github/workflows/ci.yml`).

## Project layout

```
src/
  modules/<module>/   one hexagonal module per bounded area (domain, application, infrastructure, http)
  shared/             code shared across modules; never imports from modules/
  entrypoints/        one composition root per process
test/
  unit/               mirrors src/
  integration/
  contract/
  e2e/
docs/adr/             architecture decision records
```

## License

MIT
