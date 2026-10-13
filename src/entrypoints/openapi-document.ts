import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "kysely";
import { pino } from "pino";

import {
  createLinksReadModule,
  createLinksWriteModule,
} from "../modules/links/index.js";
import { buildServer } from "../shared/http/build-server.js";
import { createRedisClient } from "../shared/redis/create-redis-client.js";

// Versioned with the code. A unit test fails when it falls behind the routes.
export const OPENAPI_DOCUMENT_URL = new URL(
  "../../docs/openapi.json",
  import.meta.url,
);

// The document of every route, composed like the all-in-one api. Nothing
// connects: no route runs, so Postgres and Redis are never reached, and the
// config values below do not show up in the document.
export async function buildOpenApiDocument(): Promise<unknown> {
  const logger = pino({ level: "silent" });

  // DummyDriver: Kysely without a database. Any query would return no rows.
  const db = new Kysely<unknown>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (kysely) => new PostgresIntrospector(kysely),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
  // Never connected.
  const redis = createRedisClient(
    { host: "localhost", port: 6379, password: "unused" },
    logger,
  );

  const write = createLinksWriteModule({
    db,
    logger,
    shortCodeKey: "0".repeat(32),
    publicBaseUrl: "http://localhost",
    maxUrlLength: 2048,
    rateLimitMax: 1,
  });
  const read = createLinksReadModule({
    db,
    redis,
    logger,
    rateLimitMax: 1,
    cacheTtlSeconds: 1,
    cacheNegativeTtlSeconds: 1,
  });

  const app = await buildServer({ logger, rateLimitWindowMs: 60_000 });
  write.registerRoutes(app);
  read.registerRoutes(app);
  await app.ready();

  const document = app.swagger();
  await app.close();
  return document;
}
