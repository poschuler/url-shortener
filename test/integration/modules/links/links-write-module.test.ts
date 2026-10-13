import { Registry } from "@prometheus-io/client";
import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createLinksMetrics,
  createLinksWriteModule,
} from "#src/modules/links/index.js";
import type { LinksDatabase } from "#src/modules/links/infrastructure/postgres/links-database.js";
import { linksMigrationsFolder } from "#src/modules/links/infrastructure/postgres/migrations-folder.js";
import { buildServer } from "#src/shared/http/build-server.js";
import { migrateToLatest } from "#src/shared/postgres/migrations.js";

import { createTestDatabase, silentLogger } from "../../support/postgres.js";

describe("createLinksWriteModule", () => {
  let db: Kysely<unknown>;
  let app: FastifyInstance;
  let registry: Registry;

  beforeEach(async () => {
    db = await createTestDatabase();
    await migrateToLatest(db, linksMigrationsFolder, silentLogger);

    registry = new Registry();
    const links = createLinksWriteModule({
      db,
      logger: silentLogger,
      metrics: createLinksMetrics(registry),
      shortCodeKey: "000102030405060708090a0b0c0d0e0f",
      publicBaseUrl: "https://short.example",
      maxUrlLength: 2048,
      rateLimitMax: 100,
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
    await db.destroy();
  });

  it("is ready once the sequence has reserved a range", async () => {
    const response = await app.inject({ method: "GET", url: "/ready" });

    expect(response.statusCode).toBe(200);
  });

  it("shortens a URL and stores the Link in Postgres", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/links",
      body: { url: "https://example.com/a" },
    });

    expect(response.statusCode).toBe(201);
    const { code } = response.json<{ code: string }>();
    expect(
      await db
        .$extendTables<LinksDatabase>()
        .selectFrom("links.links")
        .select(["code", "url"])
        .execute(),
    ).toEqual([{ code, url: "https://example.com/a" }]);
  });

  it("records the range allocation and the save", async () => {
    await app.inject({
      method: "POST",
      url: "/links",
      body: { url: "https://example.com/a" },
    });

    const metrics = await registry.metrics();
    expect(metrics).toContain(
      'links_db_query_duration_seconds_count{operation="allocate_range",outcome="ok"} 1',
    );
    expect(metrics).toContain(
      'links_db_query_duration_seconds_count{operation="save_link",outcome="ok"} 1',
    );
  });

  it("rejects a URL that points to the shortener itself", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/links",
      body: { url: "https://short.example/abc1234" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      detail: "Target URL must not point to this shortener",
    });
  });
});
