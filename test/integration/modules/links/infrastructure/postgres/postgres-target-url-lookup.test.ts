import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe } from "vitest";

import type { LinksDatabase } from "#src/modules/links/infrastructure/postgres/links-database.js";
import { linksMigrationsFolder } from "#src/modules/links/infrastructure/postgres/migrations-folder.js";
import { PostgresLinkRepository } from "#src/modules/links/infrastructure/postgres/postgres-link-repository.js";
import { PostgresTargetUrlLookup } from "#src/modules/links/infrastructure/postgres/postgres-target-url-lookup.js";
import { migrateToLatest } from "#src/shared/postgres/migrations.js";

import { describeTargetUrlLookupContract } from "../../../../../contract/modules/links/infrastructure/target-url-lookup.contract.js";
import {
  createTestDatabase,
  silentLogger,
} from "../../../../support/postgres.js";

describe("PostgresTargetUrlLookup", () => {
  let db: Kysely<LinksDatabase>;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    await migrateToLatest(testDb, linksMigrationsFolder, silentLogger);
    db = testDb.$extendTables<LinksDatabase>();
  });

  afterEach(async () => {
    await db.destroy();
  });

  describeTargetUrlLookupContract(() => ({
    repository: new PostgresLinkRepository(db),
    lookup: new PostgresTargetUrlLookup(db),
  }));
});
