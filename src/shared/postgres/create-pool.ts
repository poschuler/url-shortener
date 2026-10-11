import { Pool } from "pg";
import type { BaseLogger } from "pino";

import type { AppConfig } from "../config/config.js";

export type PostgresConfig = AppConfig["db"]["postgres"];

export function createPool(config: PostgresConfig, logger: BaseLogger): Pool {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.dbName,
    max: 10,
    // Fail fast instead of queueing forever when Postgres is unreachable
    // or every connection is busy.
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
  });

  // An idle client that loses its connection (for example, Postgres
  // restarts) emits "error" on the pool. Without a listener, Node treats it
  // as an uncaught exception and the process dies; the pool already drops
  // the broken client and opens a new one on the next query.
  pool.on("error", (error) => {
    logger.error({ err: error }, "Idle Postgres client failed");
  });

  return pool;
}
