import { randomUUID } from "node:crypto";

import { Kysely, PostgresDialect, sql } from "kysely";
import { pino } from "pino";
import { inject } from "vitest";

import {
  createPool,
  type PostgresConfig,
} from "#src/shared/postgres/create-pool.js";

export const silentLogger = pino({ level: "silent" });

// Every test gets its own empty database in the shared container, so tests
// never see each other's schemas or data.
export async function createTestDatabase(): Promise<Kysely<unknown>> {
  const server = inject("postgres");
  const dbName = `test_${randomUUID().replaceAll("-", "")}`;

  const admin = connect(server);
  try {
    await sql`create database ${sql.id(dbName)}`.execute(admin);
  } finally {
    await admin.destroy();
  }

  return connect({ ...server, dbName });
}

function connect(config: PostgresConfig): Kysely<unknown> {
  return new Kysely<unknown>({
    dialect: new PostgresDialect({ pool: createPool(config, silentLogger) }),
  });
}
