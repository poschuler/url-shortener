import { describe, expect, it } from "vitest";

import { loadConfig, loadMigrateConfig } from "#src/shared/config/config.js";

const postgresEnv = {
  PG_HOST: "localhost",
  PG_USER: "postgres",
  PG_PASSWORD: "secret",
  PG_NAME: "url_shortener",
};

const apiEnv = {
  ...postgresEnv,
  PUBLIC_BASE_URL: "http://localhost:3000",
  SHORT_CODE_KEY: "d448594783eb62319864f9a512e1e051",
  REDIS_PASSWORD: "secret",
};

describe("loadConfig", () => {
  it("applies the defaults", () => {
    const config = loadConfig(apiEnv);

    expect(config.app).toEqual({
      env: "development",
      port: 3000,
      logLevel: "info",
      publicBaseUrl: "http://localhost:3000",
      maxUrlLength: 2048,
      shortCodeKey: "d448594783eb62319864f9a512e1e051",
    });
    expect(config.db.postgres.port).toBe(5432);
    expect(config.redis).toEqual({
      host: "localhost",
      port: 6379,
      password: "secret",
    });
  });

  it("names every invalid variable", () => {
    expect(() => loadConfig({ ...postgresEnv, PORT: "0" })).toThrow(
      /PORT[\s\S]*PUBLIC_BASE_URL[\s\S]*SHORT_CODE_KEY[\s\S]*REDIS_PASSWORD/,
    );
  });
});

describe("loadMigrateConfig", () => {
  it("needs only the Postgres variables", () => {
    expect(loadMigrateConfig({ ...postgresEnv, PG_PORT: "5433" })).toEqual({
      app: { logLevel: "info" },
      db: {
        postgres: {
          host: "localhost",
          port: 5433,
          user: "postgres",
          password: "secret",
          dbName: "url_shortener",
        },
      },
    });
  });

  it("rejects a missing Postgres variable", () => {
    const { PG_PASSWORD: _, ...env } = postgresEnv;

    expect(() => loadMigrateConfig(env)).toThrow(/PG_PASSWORD/);
  });
});
