import { Kysely, PostgresDialect, sql } from "kysely";
import { pino } from "pino";

import { createLinksWriteModule } from "../modules/links/index.js";
import { loadWriteApiConfig } from "../shared/config/config.js";
import { buildServer } from "../shared/http/build-server.js";
import { createPool } from "../shared/postgres/create-pool.js";
import { shutdownOnSignals } from "./shutdown.js";

// The write side in production: Shorten only, no Redis.
const config = loadWriteApiConfig();
const logger = pino({ level: config.app.logLevel });

const db = new Kysely<unknown>({
  dialect: new PostgresDialect({
    pool: createPool(config.db.postgres, logger),
  }),
});

const links = createLinksWriteModule({
  db,
  logger,
  shortCodeKey: config.app.shortCodeKey,
  publicBaseUrl: config.app.publicBaseUrl,
  maxUrlLength: config.app.maxUrlLength,
});

const app = await buildServer({
  logger,
  rateLimit: config.http.rateLimit,
  trustProxy: config.http.trustProxy,
  readinessChecks: {
    postgres: async () => {
      await sql`select 1`.execute(db);
    },
    ...links.readinessChecks,
  },
});

links.registerRoutes(app);

// Runs after the in-flight requests finish, so none of them loses the pool.
app.addHook("onClose", () => db.destroy());

shutdownOnSignals(app);

await app.listen({ port: config.app.port, host: "0.0.0.0" });
