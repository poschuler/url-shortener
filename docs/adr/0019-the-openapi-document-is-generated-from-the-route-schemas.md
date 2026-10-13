# The OpenAPI document is generated from the route schemas

The API is described code-first. The TypeBox schemas of each route, which already validate requests and serialize responses (ADR-0013), also feed `@fastify/swagger`, which builds an OpenAPI 3.1 document from them. Version 3.1 is plain JSON Schema, like TypeBox, so the schemas go into the document as they are. Summaries, descriptions and examples are written in the route schemas, and every error response refers to one shared Problem Details schema.

The document is versioned as `docs/openapi.json`, so a change to the contract shows up in the diff of the change that made it. `pnpm openapi` regenerates it without a database or Redis, and a unit test fails when it no longer matches the routes, so `pnpm check` and the CI catch a stale document. Each API also serves it, with a Scalar reference at `/docs`, only when `DOCS_ENABLED` is `true`; it is off by default, so production does not publish its API reference. `/health` and `/ready` are left out of the document: they are for the orchestrator, not for API clients.

## Considered Options

- **Design-first**, writing the document by hand and generating or checking the code from it: two sources to keep in step, and TypeBox already gives the types and the validation from the schemas.
- **A hand-written document next to the code**: it goes stale as soon as a route changes, and nothing notices.
- **Generating the document in CI without versioning it**: contract changes would not show up in reviews.
- **Swagger UI** (`@fastify/swagger-ui`) instead of Scalar: it works the same way. Scalar was preferred for a reference that reads better, and either can replace the other without touching a route.

## Consequences

The document cannot drift from the routes, but every change to a route schema means running `pnpm openapi` and committing the result. Building the document composes the modules with a Kysely instance that has no database and a Redis client that never connects. Scalar adds about 4.5 MB to the dependencies, because it ships its bundled JavaScript instead of loading it from a CDN.
