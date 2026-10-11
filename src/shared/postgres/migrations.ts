import { promises as fs } from "node:fs";
import path from "node:path";

import type { Kysely } from "kysely";
import {
  FileMigrationProvider,
  type MigrationResultSet,
  Migrator,
} from "kysely/migration";
import type { BaseLogger } from "pino";

export async function migrateToLatest(
  db: Kysely<unknown>,
  folder: string,
  logger: BaseLogger,
): Promise<void> {
  report(await createMigrator(db, folder).migrateToLatest(), logger);
}

export async function migrateDown(
  db: Kysely<unknown>,
  folder: string,
  logger: BaseLogger,
): Promise<void> {
  report(await createMigrator(db, folder).migrateDown(), logger);
}

function createMigrator(db: Kysely<unknown>, folder: string): Migrator {
  return new Migrator({
    db,
    provider: new FileMigrationProvider({ fs, path, migrationFolder: folder }),
  });
}

function report({ error, results }: MigrationResultSet, logger: BaseLogger) {
  for (const { migrationName, direction, status } of results ?? []) {
    logger.info({ migration: migrationName, direction, status }, "Migration");
  }

  if (error !== undefined) {
    throw error instanceof Error
      ? error
      : new Error("Migration failed", { cause: error });
  }
}
