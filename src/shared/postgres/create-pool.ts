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
    // Enforced by the client, so it also fires when Postgres hangs and
    // cannot apply statement_timeout. Above it, so Postgres usually cancels
    // the query first.
    query_timeout: 12_000,
  });

  // An idle client that loses its connection (for example, Postgres
  // restarts) emits "error" on the pool. Without a listener, Node treats it
  // as an uncaught exception and the process dies; the pool already drops
  // the broken client and opens a new one on the next query, so a warning
  // is enough.
  pool.on("error", (error) => {
    // Not the error itself: pg attaches the whole client to it, and the
    // logger would dump its internal state (host, user, database...).
    const { message, code } = error as Error & { code?: string };
    logger.warn({ err: { message, code } }, "Idle Postgres client failed");
  });

  return pool;
}
