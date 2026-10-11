import { Kysely, PostgresDialect } from "kysely";
import { pino } from "pino";

import { linksMigrationsFolder } from "../modules/links/infrastructure/postgres/migrations-folder.js";
import { loadConfig } from "../shared/config/config.js";
import { createPool } from "../shared/postgres/create-pool.js";
import { migrateDown, migrateToLatest } from "../shared/postgres/migrations.js";

const config = loadConfig();
const logger = pino({ level: config.app.logLevel });

const command = process.argv[2] ?? "latest";

if (command !== "latest" && command !== "down") {
  logger.fatal({ command }, "Unknown command, expected latest or down");
  process.exit(1);
}

const db = new Kysely<unknown>({
  dialect: new PostgresDialect({
    pool: createPool(config.db.postgres, logger),
  }),
});

try {
  const migrate = command === "latest" ? migrateToLatest : migrateDown;
  await migrate(db, linksMigrationsFolder, logger);
  logger.info({ command }, "Migrations finished");
} catch (error) {
  logger.fatal({ err: error }, "Migrations failed");
  process.exitCode = 1;
} finally {
  await db.destroy();
}
