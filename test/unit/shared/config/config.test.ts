import { describe, expect, it } from "vitest";

import {
  loadApiConfig,
  loadMigrateConfig,
  loadWriteApiConfig,
} from "#src/shared/config/config.js";

const postgresEnv = {
  PG_HOST: "localhost",
  PG_USER: "postgres",
  PG_PASSWORD: "secret",
  PG_NAME: "url_shortener",
};

const writeApiEnv = {
  ...postgresEnv,
  PUBLIC_BASE_URL: "http://localhost:3000",
  SHORT_CODE_KEY: "d448594783eb62319864f9a512e1e051",
};

const apiEnv = {
  ...writeApiEnv,
  REDIS_PASSWORD: "secret",
};

describe("loadApiConfig", () => {
  it("applies the defaults", () => {
    const config = loadApiConfig(apiEnv);

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
    expect(() => loadApiConfig({ ...postgresEnv, PORT: "0" })).toThrow(
      /PORT[\s\S]*PUBLIC_BASE_URL[\s\S]*SHORT_CODE_KEY[\s\S]*REDIS_PASSWORD/,
    );
  });
});

describe("loadWriteApiConfig", () => {
  it("needs no Redis variables and listens on 3001 by default", () => {
    expect(loadWriteApiConfig(writeApiEnv)).toEqual({
      app: {
        env: "development",
        port: 3001,
        logLevel: "info",
        publicBaseUrl: "http://localhost:3000",
        maxUrlLength: 2048,
        shortCodeKey: "d448594783eb62319864f9a512e1e051",
      },
      http: {
        trustProxy: [],
        rateLimit: { max: 20, timeWindowMs: 60_000 },
      },
      db: {
        postgres: {
          host: "localhost",
          port: 5432,
          user: "postgres",
          password: "secret",
          dbName: "url_shortener",
        },
      },
    });
  });

  it("names every invalid variable", () => {
    expect(() => loadWriteApiConfig({ ...postgresEnv, PORT: "0" })).toThrow(
      /PORT[\s\S]*PUBLIC_BASE_URL[\s\S]*SHORT_CODE_KEY/,
    );
  });

  it("reads the trusted proxies as a comma-separated list", () => {
    const config = loadWriteApiConfig({
      ...writeApiEnv,
      TRUST_PROXY: "loopback, 10.0.0.0/8,192.168.1.10",
    });

    expect(config.http.trustProxy).toEqual([
      "loopback",
      "10.0.0.0/8",
      "192.168.1.10",
    ]);
  });

  it.each(["true", "1", "proxy.internal"])(
    "rejects %s as a trusted proxy",
    (trustProxy) => {
      expect(() =>
        loadWriteApiConfig({ ...writeApiEnv, TRUST_PROXY: trustProxy }),
      ).toThrow(/TRUST_PROXY/);
    },
  );
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
