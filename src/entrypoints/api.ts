import { Kysely, PostgresDialect, sql } from "kysely";
import { pino } from "pino";

import { PostgresRangeAllocator } from "../modules/links/infrastructure/postgres/postgres-range-allocator.js";
import { RangedNumberSequence } from "../modules/links/infrastructure/ranges/ranged-number-sequence.js";
import { loadApiConfig } from "../shared/config/config.js";
import { buildServer } from "../shared/http/build-server.js";
import { createPool } from "../shared/postgres/create-pool.js";

// Below Docker's default stop timeout (10s), so we exit before it sends SIGKILL.
const SHUTDOWN_TIMEOUT_MS = 8_000;

// Ask for the next range once 20% of the current one is left.
const RANGE_REFILL_THRESHOLD = 0.2;
const RANGE_RETRY = { maxAttempts: 3, baseDelayMs: 50 };

const config = loadApiConfig();
const logger = pino({ level: config.app.logLevel });

const db = new Kysely<unknown>({
  dialect: new PostgresDialect({
    pool: createPool(config.db.postgres, logger),
  }),
});

const sequence = new RangedNumberSequence({
  allocator: new PostgresRangeAllocator(db),
  refillThreshold: RANGE_REFILL_THRESHOLD,
  retry: RANGE_RETRY,
  logger,
});

const app = buildServer({
  logger,
  readinessChecks: {
    postgres: async () => {
      await sql`select 1`.execute(db);
    },
    // Not ready until a range is reserved: the first check reserves it.
    sequence: () => sequence.ready(),
  },
});

// Runs after the in-flight requests finish, so none of them loses the pool.
app.addHook("onClose", () => db.destroy());

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info({ signal }, "Shutting down");

  // Last resort if close() hangs.
  const timer = setTimeout(() => {
    app.log.fatal("Shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    await app.close();
    app.log.info("Shutdown complete");
  } catch (error) {
    app.log.error({ err: error }, "Shutdown failed");
    process.exitCode = 1;
  } finally {
    clearTimeout(timer);
  }
}

// once(): a second Ctrl+C falls back to Node's default and kills the process.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => void shutdown(signal));
}

await app.listen({ port: config.app.port, host: "0.0.0.0" });
