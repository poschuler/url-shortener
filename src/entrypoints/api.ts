import { Kysely, PostgresDialect, sql } from "kysely";
import { pino } from "pino";

import {
  createLinksReadModule,
  createLinksWriteModule,
} from "../modules/links/index.js";
import { loadApiConfig } from "../shared/config/config.js";
import { buildServer } from "../shared/http/build-server.js";
import { createPool } from "../shared/postgres/create-pool.js";
import { createRedisClient } from "../shared/redis/create-redis-client.js";
import { shutdownOnSignals } from "./shutdown.js";

// All-in-one process for development: Shorten and Resolve together.
const config = loadApiConfig();
const logger = pino({ level: config.app.logLevel });

const db = new Kysely<unknown>({
  dialect: new PostgresDialect({
    pool: createPool(config.db.postgres, logger),
  }),
});

const redis = createRedisClient(config.redis, logger);
// Not awaited: while Redis is down, Resolve reads from Postgres, so the
// process starts anyway. The promise stays pending while the client keeps
// retrying, and only rejects if it stops (on shutdown, for example).
redis.connect().catch((error: unknown) => {
  logger.warn({ err: error }, "Stopped connecting to Redis");
});

const write = createLinksWriteModule({
  db,
  logger,
  ...config.shorten,
});

const read = createLinksReadModule({
  db,
  redis,
  logger,
  ...config.resolve,
});

const app = await buildServer({
  logger,
  rateLimitWindowMs: config.http.rateLimitWindowMs,
  trustProxy: config.http.trustProxy,
  readinessChecks: {
    postgres: async () => {
      await sql`select 1`.execute(db);
    },
    ...write.readinessChecks,
    ...read.readinessChecks,
  },
});

write.registerRoutes(app);
read.registerRoutes(app);

// Runs after the in-flight requests finish, so none of them loses a client.
app.addHook("onClose", async () => {
  redis.destroy();
  await db.destroy();
});

shutdownOnSignals(app);

await app.listen({ port: config.app.port, host: "0.0.0.0" });
