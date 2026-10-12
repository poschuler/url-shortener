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
  // as an uncaught exception and the process dies.
  client.on("error", (error: Error) => {
    logger.warn({ err: { message: error.message } }, "Redis client error");
  });

  return client;
}
