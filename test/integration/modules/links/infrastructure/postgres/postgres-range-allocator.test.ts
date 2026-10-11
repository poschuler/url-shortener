import { type Kysely, sql } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { linksMigrationsFolder } from "#src/modules/links/infrastructure/postgres/migrations-folder.js";
import { PostgresRangeAllocator } from "#src/modules/links/infrastructure/postgres/postgres-range-allocator.js";
import { migrateToLatest } from "#src/shared/postgres/migrations.js";

import { describeRangeAllocatorContract } from "../../../../../contract/modules/links/infrastructure/range-allocator.contract.js";
import {
  createTestDatabase,
  silentLogger,
} from "../../../../support/postgres.js";

describe("PostgresRangeAllocator", () => {
  let db: Kysely<unknown>;

  beforeEach(async () => {
    db = await createTestDatabase();
    await migrateToLatest(db, linksMigrationsFolder, silentLogger);
  });

  afterEach(async () => {
    await db.destroy();
  });

  describeRangeAllocatorContract(() => new PostgresRangeAllocator(db));

  it("allocates consecutive ranges of the sequence increment", async () => {
    const allocator = new PostgresRangeAllocator(db);

    expect(await allocator.allocate()).toEqual({ start: 1n, end: 1001n });
    expect(await allocator.allocate()).toEqual({ start: 1001n, end: 2001n });
  });

  it("follows a change of the sequence increment", async () => {
    const allocator = new PostgresRangeAllocator(db);
    await sql`
      alter sequence links.short_code_numbers increment by 50
    `.execute(db);

    expect(await allocator.allocate()).toEqual({ start: 1n, end: 51n });
  });
});
