# Fastify with TypeBox for HTTP

The HTTP layer runs on Fastify 5, and route schemas are written with TypeBox. Fastify validates requests and serializes responses from JSON Schema, logs through pino, and can answer requests in memory with `inject()`, so route tests need no open port. TypeBox builds those JSON Schemas as TypeScript values, and Fastify's TypeBox type provider turns each schema into the type of the request body, so the schema and the type cannot drift apart. The same schemas will feed the OpenAPI document later. Requests are validated with the TypeBox validator instead of Fastify's default Ajv setup, which coerces types: with Ajv, `{ "url": 42 }` reached the handler as the string `"42"`. A route schema only checks the shape of the request; whether a Target URL is acceptable is a domain rule (ADR-0005), so that answer names the rule that failed. Fastify stays in `http/` and `shared/http/`: the domain and application layers do not know it exists.

## Considered Options

- **Express**: the most familiar choice, but it has no schema-based validation or serialization, and its types are maintained apart from it.
- **NestJS**: brings decorators, a dependency injection container and its own module system, which overlap with the hexagonal modules and the hand-written composition here.
- **Hono**: small, fast and portable across runtimes, but this project only targets Node, and Fastify already has the plugins it needs (rate limiting, OpenAPI) and built-in pino logging.
- **zod for route schemas**: zod already validates the configuration, so it would mean one library fewer. It is not JSON Schema, though, so it needs a conversion step for Fastify and for OpenAPI. TypeBox is JSON Schema from the start.
- **Ajv with coercion turned off**: would also stop the coercion, but the TypeBox validator ships with the type provider and checks exactly what the TypeBox types describe.

## Consequences

There are two validation libraries: zod for environment variables and TypeBox for HTTP. Fastify reports a body that does not match its schema as a 400 in Problem Details, with Fastify's own message. Response schemas also drive serialization, so a field missing from a response schema is left out of the response. TypeBox 1.x is published as `typebox` and replaces `@sinclair/typebox`; most examples online still use the old package. Plugins that add routes or hooks must finish loading before routes are added, so `buildServer` is async.
