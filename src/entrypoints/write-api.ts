import { Kysely, PostgresDialect, sql } from "kysely";
import { pino } from "pino";

import {
  createLinksMetrics,
  createLinksWriteModule,
} from "../modules/links/index.js";
import { loadWriteApiConfig } from "../shared/config/config.js";
import { buildMetricsServer } from "../shared/http/build-metrics-server.js";
import { buildServer } from "../shared/http/build-server.js";
import { createMetricsRegistry } from "../shared/metrics/create-metrics-registry.js";
import { createPool } from "../shared/postgres/create-pool.js";
import { shutdownOnSignals } from "./shutdown.js";

// The write side in production: Shorten only, no Redis.
const config = loadWriteApiConfig();
const logger = pino({ level: config.app.logLevel });
const metricsRegistry = createMetricsRegistry();

const db = new Kysely<unknown>({
  dialect: new PostgresDialect({
    pool: createPool(config.db.postgres, logger),
  }),
});

const links = createLinksWriteModule({
  db,
  logger,
  metrics: createLinksMetrics(metricsRegistry),
  ...config.shorten,
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

// Runs after the in-flight requests finish, so none of them loses the pool.
// Metrics stay up until then, so the shutdown can still be scraped.
app.addHook("onClose", async () => {
  await db.destroy();
  await metricsApp.close();
});

shutdownOnSignals(app);

await app.listen({ port: config.app.port, host: "0.0.0.0" });
await metricsApp.listen({ port: config.metrics.port, host: "0.0.0.0" });
