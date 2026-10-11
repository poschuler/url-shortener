import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // The Short Code is the identity of a Link: no separate id column.
  // The URL length is not checked here: MAX_URL_LENGTH is configuration and
  // TargetUrl enforces it. created_at has no default: Link.create sets it.
  await sql`
    create table links.links (
      code text primary key check (code ~ '^[0-9A-Za-z]{7}$'),
      url text not null,
      created_at timestamptz not null
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop table links.links`.execute(db);
}
