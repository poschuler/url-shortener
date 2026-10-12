# url-shortener

[![CI](https://github.com/poschuler/url-shortener/actions/workflows/ci.yml/badge.svg)](https://github.com/poschuler/url-shortener/actions/workflows/ci.yml)

A URL shortener built with Node.js, TypeScript and Fastify: a modular monolith with hexagonal architecture, used as a reference project for posts on [poschuler.com](https://poschuler.com).

> **Status: work in progress.** Shorten works end to end: `POST /links` stores Links in Postgres. Resolve and its Redis cache are not there yet.

## What it does

- **Shorten**: turns a Target URL into a Short URL with a seven-character, case-sensitive Short Code.
- **Resolve**: redirects a Visitor who follows a Short URL to its Target URL.

Writes and reads run as separate processes (`write-api` and `read-api`) built from the same codebase.

## Documentation

- [`CONTEXT.md`](CONTEXT.md): the domain language (Link, Short Code, Target URL, Short URL, Visitor).
- [`docs/adr/`](docs/adr/): architecture decision records, numbered in the order they were made.

## Requirements

- Node.js 24 or later
- pnpm 11
- Docker, for integration tests and the local stack

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
| `pnpm test:integration`             | Runs the integration tests against Postgres in a container (needs Docker)                |
| `pnpm test:e2e`                     | Runs the end-to-end tests against the running compose stack                              |
| `pnpm lint` / `pnpm lint:fix`       | Lints with oxlint, optionally fixing what it can                                         |
| `pnpm format` / `pnpm format:check` | Formats with oxfmt, or only checks                                                       |
| `pnpm typecheck`                    | Type checks sources, tests and config files                                              |
| `pnpm deps:check`                   | Checks module and layer boundaries with dependency-cruiser                               |
| `pnpm build`                        | Compiles `src/` to `dist/`                                                               |
| `pnpm dev`                          | Runs the API from `src/`, restarting on every change                                     |
| `pnpm start`                        | Runs the compiled API from `dist/` (run `pnpm build` first)                              |
| `pnpm db:migrate`                   | Applies the pending database migrations to the Postgres in `.env`                        |
| `pnpm db:migrate:down`              | Reverts the last applied migration                                                       |

## Docker

`compose.yaml` runs two processes from the same image, both with health checks, plus Postgres 17 and Redis 7. It reads its values from `.env`:

- `api` on port 3000: every route in one process.
- `write-api` on port 3001: Shorten only, without Redis.

A one-off `migrate` service applies the database migrations first; the APIs start only if it succeeds:

```bash
docker compose up -d --build --wait
curl -i localhost:3001/ready
curl -i localhost:3001/links -H 'content-type: application/json' -d '{"url":"https://example.com"}'
docker compose down
```

`POST /links` is rate limited per client IP (`RATE_LIMIT_MAX` requests every `RATE_LIMIT_WINDOW_MS`). Behind a reverse proxy, list its addresses in `TRUST_PROXY` so the limit applies to the real client instead of the proxy.

Postgres and Redis are also published on `127.0.0.1`, so `pnpm dev` can use them from the host. `docker compose down -v` also deletes the Postgres volume. To revert the last migration inside the stack:

```bash
docker compose run --rm migrate node dist/entrypoints/migrate.js down
```

The `Dockerfile` builds a production image that runs the API as the non-root `node` user. To run it on its own:

```bash
docker build -t url-shortener .
docker run --rm -p 3000:3000 --env-file .env url-shortener
curl -i localhost:3000/health
```

`docker run --env-file` keeps quotes as part of the value, so keep the values in `.env` unquoted. The container shuts down gracefully on `SIGTERM` (`docker stop`).

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
