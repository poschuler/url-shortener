# Kysely for SQL and migrations

Database access goes through Kysely, a type-safe SQL query builder with no runtime dependencies, on top of the `pg` driver. It is not an ORM: the code reads like the SQL it sends, the result types follow from the query, and there is no mapping layer between rows and objects. That fits ADR-0008, where Kysely lives only in the infrastructure adapters, Shorten saves the `Link` through a repository that does its own mapping, and Resolve reads plain values through a query port. Each module declares the types of its own tables (`links` will have a `LinksDatabase`), so no shared type knows every module. Queries the builder does not cover, such as `nextval()` and the `pg_sequence` catalog, use Kysely's `sql` template, which still binds parameters. The schema changes through Kysely's Migrator: one TypeScript file per migration, with `up` and `down` written in raw SQL, run by a `migrate` entrypoint before the API starts.

## Considered Options

- **Prisma**: a schema language, a generation step and its own client API, all for a handful of tables and queries.
- **Drizzle**: also a typed query builder, but the tables are defined as TypeScript objects and the migrations are generated from them. Here the migrations are written by hand in SQL.
- **TypeORM or MikroORM**: map rows to classes, which either puts persistence concerns into the domain entities or duplicates them as separate entity classes.
- **Plain `pg` with hand-written SQL**: no extra dependency, but every row is untyped.

## Consequences

The table types are written by hand and are not generated from the database, so they can drift from the migrations. The integration tests run every adapter against a real Postgres to catch that drift. Migrations receive `Kysely<unknown>` instead of the application's table types, so an old migration still compiles after the schema changes. Kysely is still in 0.x and breaks its API between minor versions (0.29 moved the Migrator to `kysely/migration`), so upgrades need care. Raw `sql` queries are typed only by the type the caller declares, and `pg` returns `int8` columns as strings, so those queries convert their values explicitly.
