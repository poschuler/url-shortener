import {
  RedisContainer,
  type StartedRedisContainer,
} from "@testcontainers/redis";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  RedisLinkCache,
  type RedisLinkCacheOptions,
} from "#src/modules/links/infrastructure/redis/redis-link-cache.js";
import {
  createRedisClient,
  type RedisClient,
} from "#src/shared/redis/create-redis-client.js";

import {
  code,
  describeLinkCacheContract,
} from "../../../../../contract/modules/links/infrastructure/link-cache.contract.js";
import { silentLogger } from "../../../../support/postgres.js";

const options: RedisLinkCacheOptions = {
  ttlSeconds: 86_400,
  negativeTtlSeconds: 60,
  timeoutMs: 100,
};

describe("RedisLinkCache", () => {
  let container: StartedRedisContainer;
  let redis: RedisClient;

  // One container for this file. Every test starts with an empty database.
  beforeAll(async () => {
    container = await new RedisContainer("redis:7-alpine")
      .withPassword("test")
      .start();
  });

  afterAll(async () => {
    await container.stop();
  });

  beforeEach(async () => {
    redis = createRedisClient(
      {
        host: container.getHost(),
        port: container.getPort(),
        password: container.getPassword(),
      },
      silentLogger,
    );
    await redis.connect();
    await redis.flushDb();
  });

  afterEach(() => {
    redis.destroy();
  });

  describeLinkCacheContract(
    () => new RedisLinkCache(redis, silentLogger, options),
  );

  it("keeps target URLs for a day and missing codes for a minute", async () => {
    const cache = new RedisLinkCache(redis, silentLogger, options);

    await cache.set(code("abc1234"), "https://example.com/a");
    await cache.set(code("abc1235"), null);

    expect(await redis.get("links:target-url:abc1234")).toBe(
      "https://example.com/a",
    );
    expect(await redis.ttl("links:target-url:abc1234")).toBe(86_400);
    expect(await redis.get("links:target-url:abc1235")).toBe("");
    expect(await redis.ttl("links:target-url:abc1235")).toBe(60);
  });

  it("misses and skips writes while Redis is unreachable", async () => {
    redis.destroy();
    const cache = new RedisLinkCache(redis, silentLogger, options);

    await expect(cache.set(code("abc1234"), null)).resolves.toBeUndefined();
    expect(await cache.get(code("abc1234"))).toEqual({ status: "miss" });
  });

  it("misses and skips writes when Redis does not answer in time", async () => {
    const cache = new RedisLinkCache(redis, silentLogger, options);
    await cache.set(code("abc1234"), "https://example.com/a");
    // Redis stops answering every client, as if it hung.
    await redisCli(container, "client", "pause", "2000", "all");

    try {
      const started = performance.now();

      await expect(cache.set(code("abc1235"), null)).resolves.toBeUndefined();
      expect(await cache.get(code("abc1234"))).toEqual({ status: "miss" });
      expect(performance.now() - started).toBeLessThan(1_000);
    } finally {
      await redisCli(container, "client", "unpause");
    }
  });
});

async function redisCli(container: StartedRedisContainer, ...args: string[]) {
  const result = await container.exec([
    "redis-cli",
    "--no-auth-warning",
    "-a",
    container.getPassword(),
    ...args,
  ]);
  expect(result.output.trim()).toBe("OK");
}
