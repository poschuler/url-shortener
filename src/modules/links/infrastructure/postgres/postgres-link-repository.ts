import type { Kysely } from "kysely";

import type { Link } from "../../domain/link.js";
import type { LinkRepository } from "../../domain/link.repository.js";
import type { LinksDatabase } from "./links-database.js";

export class PostgresLinkRepository implements LinkRepository {
  public constructor(private readonly db: Kysely<LinksDatabase>) {}

  // A duplicate code violates the primary key and rejects: that is a bug,
  // not user error, so it is not turned into a Result.
  public async save(link: Link): Promise<void> {
    await this.db
      .insertInto("links.links")
      .values({
        code: link.code.value,
        url: link.url,
        created_at: link.createdAt,
      })
      .execute();
  }
}
