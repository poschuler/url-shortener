import { Registry } from "@prometheus-io/client";
import type { StartedRedisContainer } from "@testcontainers/redis";
import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
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
  createLinksMetrics,
  createLinksReadModule,
} from "#src/modules/links/index.js";
import type { LinksDatabase } from "#src/modules/links/infrastructure/postgres/links-database.js";
import { linksMigrationsFolder } from "#src/modules/links/infrastructure/postgres/migrations-folder.js";
import { PostgresLinkRepository } from "#src/modules/links/infrastructure/postgres/postgres-link-repository.js";
import { buildServer } from "#src/shared/http/build-server.js";
import { migrateToLatest } from "#src/shared/postgres/migrations.js";
import {
  createRedisClient,
  type RedisClient,
} from "#src/shared/redis/create-redis-client.js";

import { createLink } from "../../../contract/modules/links/infrastructure/link-repository.contract.js";
import { createTestDatabase, silentLogger } from "../../support/postgres.js";
import { redisConfigOf, startRedisContainer } from "../../support/redis.js";

describe("createLinksReadModule", () => {
  let container: StartedRedisContainer;
  let db: Kysely<LinksDatabase>;
  let redis: RedisClient;
  let app: FastifyInstance;
  let registry: Registry;

  beforeAll(async () => {
    container = await startRedisContainer();
  });

  afterAll(async () => {
    await container.stop();
  });

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    await migrateToLatest(testDb, linksMigrationsFolder, silentLogger);
    db = testDb.$extendTables<LinksDatabase>();
    await new PostgresLinkRepository(db).save(
      createLink("abc1234", "https://example.com/a"),
    );

    redis = createRedisClient(redisConfigOf(container), silentLogger);
    await redis.connect();
    await redis.flushDb();

    registry = new Registry();
    const links = createLinksReadModule({
      db: testDb,
      redis,
      logger: silentLogger,
      metrics: createLinksMetrics(registry),
      rateLimitMax: 100,
      cacheTtlSeconds: 86_400,
      cacheNegativeTtlSeconds: 60,
    });
    app = await buildServer({
      logger: silentLogger,
      rateLimitWindowMs: 60_000,
      readinessChecks: links.readinessChecks,
    });
    links.registerRoutes(app);
  });

  afterEach(async () => {
    await app.close();
    redis.destroy();
    await db.destroy();
  });

  it("redirects to the Target URL stored in Postgres and caches it", async () => {
    const response = await app.inject({ url: "/abc1234" });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("https://example.com/a");
    expect(await redis.get("links:target-url:abc1234")).toBe(
      "https://example.com/a",
    );
  });

  it("serves a cached Target URL without asking Postgres", async () => {
    await app.inject({ url: "/abc1234" });
    await db.deleteFrom("links.links").execute();

    const response = await app.inject({ url: "/abc1234" });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("https://example.com/a");
  });

  it("caches a code without a Link", async () => {
    const response = await app.inject({ url: "/abc1235" });

    expect(response.statusCode).toBe(404);
    expect(await redis.get("links:target-url:abc1235")).toBe("");
  });

  it("records the cache reads and the Postgres lookups", async () => {
    await app.inject({ url: "/abc1234" });
    await app.inject({ url: "/abc1234" });

    const metrics = await registry.metrics();
    expect(metrics).toContain('links_cache_lookups_total{result="miss"} 1');
    expect(metrics).toContain('links_cache_lookups_total{result="hit"} 1');
    expect(metrics).toContain(
      'links_db_query_duration_seconds_count{operation="find_target_url",outcome="ok"} 1',
    );
  });

  it("keeps resolving and stays ready while Redis is down", async () => {
    redis.destroy();

    const resolved = await app.inject({ url: "/abc1234" });
    const ready = await app.inject({ url: "/ready" });

    expect(resolved.statusCode).toBe(302);
    expect(resolved.headers.location).toBe("https://example.com/a");
    expect(ready.statusCode).toBe(200);
  });
});
