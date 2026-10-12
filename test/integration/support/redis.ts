import {
  RedisContainer,
  type StartedRedisContainer,
} from "@testcontainers/redis";

import type { RedisConfig } from "#src/shared/redis/create-redis-client.js";

// One container per test file: Redis starts in about a second, and each
// file can empty it without breaking the others.
export function startRedisContainer(): Promise<StartedRedisContainer> {
  return new RedisContainer("redis:7-alpine").withPassword("test").start();
}

export function redisConfigOf(container: StartedRedisContainer): RedisConfig {
  return {
    host: container.getHost(),
    port: container.getPort(),
    password: container.getPassword(),
  };
}
