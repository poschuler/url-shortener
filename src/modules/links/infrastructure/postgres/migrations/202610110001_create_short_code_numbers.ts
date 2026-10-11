import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`create schema links`.execute(db);
  // Each nextval() reserves a range of 1000 numbers (RangedNumberSequence).
  await sql`
    create sequence links.short_code_numbers increment by 1000
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop sequence links.short_code_numbers`.execute(db);
  await sql`drop schema links`.execute(db);
}
