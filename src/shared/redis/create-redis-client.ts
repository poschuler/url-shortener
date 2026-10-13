import { createClient } from "@redis/client";
import type { BaseLogger } from "pino";

import type { ApiConfig } from "../config/config.js";

export type RedisConfig = ApiConfig["redis"];

export type RedisClient = ReturnType<typeof createRedisClient>;

// Does not connect: the caller starts connect() without awaiting it, so the
// process can start while Redis is down. The client reconnects on its own
// (backing off up to 2 s between attempts).
export function createRedisClient(config: RedisConfig, logger: BaseLogger) {
  const client = createClient({
    socket: { host: config.host, port: config.port },
    password: config.password,
    // Reject commands while disconnected instead of queueing them until
    // Redis comes back.
    disableOfflineQueue: true,
  });

  // Every failed reconnect emits "error". Without a listener, Node treats it
  // as an uncaught exception and the process dies. While Redis stays down
  // the client keeps failing, so only the first error of an outage is logged,
  // and "ready" (connected again) closes it.
  let failing = false;

  client.on("error", (error: Error) => {
    if (failing) {
      return;
    }
    failing = true;
    logger.warn({ err: { message: error.message } }, "Redis connection failed");
  });

  client.on("ready", () => {
    if (!failing) {
      return;
    }
    failing = false;
    logger.info("Redis connection restored");
  });

  return client;
}
