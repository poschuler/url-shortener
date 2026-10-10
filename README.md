# url-shortener

A URL shortener built with Node.js, TypeScript and Fastify: a modular monolith with hexagonal architecture, used as a reference project for posts on [poschuler.com](https://poschuler.com).

> **Status: work in progress.** The domain layer is being built. The HTTP APIs, persistence and Docker setup are not there yet.

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

| Script                              | What it does                                                 |
| ----------------------------------- | ------------------------------------------------------------ |
| `pnpm check`                        | Format check, lint, type check and tests: everything CI runs |
| `pnpm test`                         | Runs the tests once                                          |
| `pnpm test:watch`                   | Runs the tests on every change                               |
| `pnpm test:coverage`                | Runs the tests with a coverage report in `coverage/`         |
| `pnpm lint` / `pnpm lint:fix`       | Lints with oxlint, optionally fixing what it can             |
| `pnpm format` / `pnpm format:check` | Formats with oxfmt, or only checks                           |
| `pnpm typecheck`                    | Type checks sources, tests and config files                  |
| `pnpm build`                        | Compiles `src/` to `dist/`                                   |

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
