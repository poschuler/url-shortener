import { type Kysely, sql } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { LinksDatabase } from "#src/modules/links/infrastructure/postgres/links-database.js";
import { linksMigrationsFolder } from "#src/modules/links/infrastructure/postgres/migrations-folder.js";
import { PostgresLinkRepository } from "#src/modules/links/infrastructure/postgres/postgres-link-repository.js";
import { migrateToLatest } from "#src/shared/postgres/migrations.js";

import {
  createLink,
  describeLinkRepositoryContract,
} from "../../../../../contract/modules/links/infrastructure/link-repository.contract.js";
import {
  createTestDatabase,
  silentLogger,
} from "../../../../support/postgres.js";

describe("PostgresLinkRepository", () => {
  let db: Kysely<LinksDatabase>;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    await migrateToLatest(testDb, linksMigrationsFolder, silentLogger);
    db = testDb.$extendTables<LinksDatabase>();
  });

  afterEach(async () => {
    await db.destroy();
  });

  describeLinkRepositoryContract(() => new PostgresLinkRepository(db));

  it("stores the code, the URL and the creation time", async () => {
    const link = createLink("abc1234", "https://example.com/a");

    await new PostgresLinkRepository(db).save(link);

    expect(await db.selectFrom("links.links").selectAll().execute()).toEqual([
      {
        code: "abc1234",
        url: "https://example.com/a",
        created_at: link.createdAt,
      },
    ]);
  });

  it.each(["abc123", "abc12345", "abc-123"])(
    "rejects the malformed code %s",
    async (code) => {
      await expect(
        sql`
          insert into links.links (code, url, created_at)
          values (${code}, 'https://example.com/', now())
        `.execute(db),
      ).rejects.toThrow(/links_code_check/);
    },
  );
});
