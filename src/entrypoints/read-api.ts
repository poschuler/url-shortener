import { Kysely, PostgresDialect, sql } from "kysely";
import { pino } from "pino";

import {
  createLinksMetrics,
  createLinksReadModule,
} from "../modules/links/index.js";
import { loadReadApiConfig } from "../shared/config/config.js";
import { buildMetricsServer } from "../shared/http/build-metrics-server.js";
import { buildServer } from "../shared/http/build-server.js";
import { createMetricsRegistry } from "../shared/metrics/create-metrics-registry.js";
import { createPool } from "../shared/postgres/create-pool.js";
import { createRedisClient } from "../shared/redis/create-redis-client.js";
import { shutdownOnSignals } from "./shutdown.js";

// The read side in production: Resolve only, no Short Code key.
const config = loadReadApiConfig();
const logger = pino({ level: config.app.logLevel });
const metricsRegistry = createMetricsRegistry();

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

const links = createLinksReadModule({
  db,
  redis,
  logger,
  metrics: createLinksMetrics(metricsRegistry),
  ...config.resolve,
});

const app = await buildServer({
  logger,
  rateLimitWindowMs: config.http.rateLimitWindowMs,
  trustProxy: config.http.trustProxy,
  docsEnabled: config.http.docsEnabled,
  metricsRegistry,
  readinessChecks: {
    postgres: async () => {
      await sql`select 1`.execute(db);
    },
    ...links.readinessChecks,
  },
});

links.registerRoutes(app);

const metricsApp = buildMetricsServer({ logger, registry: metricsRegistry });

// Runs after the in-flight requests finish, so none of them loses a client.
// Metrics stay up until then, so the shutdown can still be scraped.
app.addHook("onClose", async () => {
  redis.destroy();
  await db.destroy();
  await metricsApp.close();
});

shutdownOnSignals(app);

await app.listen({ port: config.app.port, host: "0.0.0.0" });
await metricsApp.listen({ port: config.metrics.port, host: "0.0.0.0" });
