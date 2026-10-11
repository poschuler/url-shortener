import { type Kysely, sql } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { linksMigrationsFolder } from "#src/modules/links/infrastructure/postgres/migrations-folder.js";
import {
  migrateDown,
  migrateToLatest,
} from "#src/shared/postgres/migrations.js";

import { createTestDatabase, silentLogger } from "../../support/postgres.js";

describe("links migrations", () => {
  let db: Kysely<unknown>;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await db.destroy();
  });

  it("creates the short_code_numbers sequence with an increment of 1000", async () => {
    await migrateToLatest(db, linksMigrationsFolder, silentLogger);

    // pg returns int8 columns as strings.
    expect(await linksSequences(db)).toEqual([
      { name: "short_code_numbers", incrementBy: "1000" },
    ]);
    expect(await appliedMigrations(db)).toEqual([
      "202610110001_create_short_code_numbers",
    ]);
  });

  it("does nothing when the migrations are already applied", async () => {
    await migrateToLatest(db, linksMigrationsFolder, silentLogger);
    await migrateToLatest(db, linksMigrationsFolder, silentLogger);

    expect(await linksSequences(db)).toHaveLength(1);
    expect(await appliedMigrations(db)).toHaveLength(1);
  });

  it("removes the sequence and the links schema when migrating down", async () => {
    await migrateToLatest(db, linksMigrationsFolder, silentLogger);
    await migrateDown(db, linksMigrationsFolder, silentLogger);

    expect(await linksSequences(db)).toEqual([]);
    expect(await schemaExists(db, "links")).toBe(false);
    expect(await appliedMigrations(db)).toEqual([]);
  });
});

async function linksSequences(db: Kysely<unknown>) {
  const { rows } = await sql<{ name: string; incrementBy: string }>`
    select sequencename as "name", increment_by as "incrementBy"
    from pg_sequences
    where schemaname = 'links'
  `.execute(db);
  return rows;
}

async function appliedMigrations(db: Kysely<unknown>) {
  const { rows } = await sql<{ name: string }>`
    select name from kysely_migration order by name
  `.execute(db);
  return rows.map((row) => row.name);
}

async function schemaExists(db: Kysely<unknown>, schema: string) {
  const { rows } = await sql`
    select 1 from pg_namespace where nspname = ${schema}
  `.execute(db);
  return rows.length > 0;
}
