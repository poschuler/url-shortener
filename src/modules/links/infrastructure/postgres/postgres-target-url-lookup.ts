import type { Kysely } from "kysely";

import type { TargetUrlLookup } from "../../application/ports.js";
import type { ShortCode } from "../../domain/short-code.vo.js";
import type { LinksDatabase } from "./links-database.js";

// Reads plain data for Resolve; it never rebuilds the Link (ADR-0008).
export class PostgresTargetUrlLookup implements TargetUrlLookup {
  public constructor(private readonly db: Kysely<LinksDatabase>) {}

  public async findTargetUrl(code: ShortCode): Promise<string | null> {
    const row = await this.db
      .selectFrom("links.links")
      .select("url")
      .where("code", "=", code.value)
      .executeTakeFirst();

    return row?.url ?? null;
  }
}
