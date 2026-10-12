import { z } from "zod";

type EnvSource = Record<string, string | undefined>;

const LOG_LEVELS = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export type ApiConfig = {
  app: {
    env: "development" | "test" | "production";
    port: number;
    logLevel: LogLevel;
  };
  http: {
    trustProxy: string[];
    rateLimitWindowMs: number;
  };
  shorten: {
    publicBaseUrl: string;
    maxUrlLength: number;
    shortCodeKey: string;
    rateLimitMax: number;
  };
  db: {
    postgres: {
      host: string;
      port: number;
      user: string;
      password: string;
      dbName: string;
    };
  };
  redis: {
    host: string;
    port: number;
    password: string;
  };
  resolve: {
    rateLimitMax: number;
    cacheTtlSeconds: number;
    cacheNegativeTtlSeconds: number;
  };
};

// The write API does not read or cache Links, so it needs no Redis.
export type WriteApiConfig = Omit<ApiConfig, "redis" | "resolve">;

// The read API creates no Links: no Short Code key, no public base URL.
export type ReadApiConfig = Omit<ApiConfig, "shorten">;

type ServerConfig = Pick<ApiConfig, "app" | "http" | "db">;

export type MigrateConfig = {
  app: Pick<ApiConfig["app"], "logLevel">;
  db: ApiConfig["db"];
};

const port = z.coerce.number().int().min(1).max(65_535);
const required = z.string().trim().min(1);

// Each process validates only the variables it uses: the migrate job does
// not need the Short Code key or the Redis password.
const LoggingEnv = z.object({
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
});

const PostgresEnv = z.object({
  PG_HOST: required,
  PG_PORT: port.default(5432),
  PG_USER: required,
  PG_PASSWORD: required,
  PG_NAME: required,
});

const ShortenEnv = z.object({
  PUBLIC_BASE_URL: z.url({ protocol: /^https?$/ }),
  MAX_URL_LENGTH: z.coerce.number().int().positive().default(2048),
  SHORT_CODE_KEY: required,
  SHORTEN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
});

// What proxy-addr (used by Fastify) accepts, minus the unsafe forms: "true"
// trusts any X-Forwarded-For a client sends, and Fastify ignores hop counts.
const trustedProxy = z.union(
  [
    z.enum(["loopback", "linklocal", "uniquelocal"]),
    z.ipv4(),
    z.ipv6(),
    z.cidrv4(),
    z.cidrv6(),
  ],
  {
    error:
      "Expected an IP address, a CIDR range, loopback, linklocal or uniquelocal",
  },
);

const HttpEnv = z.object({
  TRUST_PROXY: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry !== ""),
    )
    .pipe(z.array(trustedProxy)),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
});

const RedisEnv = z.object({
  REDIS_HOST: required.default("localhost"),
  REDIS_PORT: port.default(6379),
  REDIS_PASSWORD: required,
});

const ResolveEnv = z.object({
  RESOLVE_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  CACHE_NEGATIVE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
});

// What every API process needs, whatever routes it serves.
const ServerEnv = z.object({
  ...LoggingEnv.shape,
  ...PostgresEnv.shape,
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  ...HttpEnv.shape,
});

const WriteApiEnv = z.object({
  ...ServerEnv.shape,
  PORT: port.default(3001),
  ...ShortenEnv.shape,
});

const ReadApiEnv = z.object({
  ...ServerEnv.shape,
  PORT: port.default(3002),
  ...RedisEnv.shape,
  ...ResolveEnv.shape,
});

// The all-in-one API serves both sides, so it needs everything.
const ApiEnv = z.object({
  ...WriteApiEnv.shape,
  ...ReadApiEnv.shape,
  PORT: port.default(3000),
});

const MigrateEnv = z.object({
  ...LoggingEnv.shape,
  ...PostgresEnv.shape,
});

export function loadApiConfig(env: EnvSource = process.env): ApiConfig {
  const vars = parseEnv(ApiEnv, env);

  return {
    ...toServerConfig(vars),
    shorten: toShortenConfig(vars),
    redis: toRedisConfig(vars),
    resolve: toResolveConfig(vars),
  };
}

export function loadWriteApiConfig(
  env: EnvSource = process.env,
): WriteApiConfig {
  const vars = parseEnv(WriteApiEnv, env);

  return { ...toServerConfig(vars), shorten: toShortenConfig(vars) };
}

export function loadReadApiConfig(env: EnvSource = process.env): ReadApiConfig {
  const vars = parseEnv(ReadApiEnv, env);

  return {
    ...toServerConfig(vars),
    redis: toRedisConfig(vars),
    resolve: toResolveConfig(vars),
  };
}

export function loadMigrateConfig(env: EnvSource = process.env): MigrateConfig {
  const vars = parseEnv(MigrateEnv, env);

  return {
    app: { logLevel: vars.LOG_LEVEL },
    db: toDbConfig(vars),
  };
}

function parseEnv<T extends z.ZodType>(schema: T, env: EnvSource): z.output<T> {
  const result = schema.safeParse(env);

  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}

function toServerConfig(
  vars: z.output<typeof ServerEnv> & { PORT: number },
): ServerConfig {
  return {
    app: {
      env: vars.NODE_ENV,
      port: vars.PORT,
      logLevel: vars.LOG_LEVEL,
    },
    http: {
      trustProxy: vars.TRUST_PROXY,
      rateLimitWindowMs: vars.RATE_LIMIT_WINDOW_MS,
    },
    db: toDbConfig(vars),
  };
}

function toShortenConfig(
  vars: z.output<typeof ShortenEnv>,
): ApiConfig["shorten"] {
  return {
    publicBaseUrl: vars.PUBLIC_BASE_URL,
    maxUrlLength: vars.MAX_URL_LENGTH,
    shortCodeKey: vars.SHORT_CODE_KEY,
    rateLimitMax: vars.SHORTEN_RATE_LIMIT_MAX,
  };
}

function toRedisConfig(vars: z.output<typeof RedisEnv>): ApiConfig["redis"] {
  return {
    host: vars.REDIS_HOST,
    port: vars.REDIS_PORT,
    password: vars.REDIS_PASSWORD,
  };
}

function toResolveConfig(
  vars: z.output<typeof ResolveEnv>,
): ApiConfig["resolve"] {
  return {
    rateLimitMax: vars.RESOLVE_RATE_LIMIT_MAX,
    cacheTtlSeconds: vars.CACHE_TTL_SECONDS,
    cacheNegativeTtlSeconds: vars.CACHE_NEGATIVE_TTL_SECONDS,
  };
}

function toDbConfig(vars: z.output<typeof PostgresEnv>): ApiConfig["db"] {
  return {
    postgres: {
      host: vars.PG_HOST,
      port: vars.PG_PORT,
      user: vars.PG_USER,
      password: vars.PG_PASSWORD,
      dbName: vars.PG_NAME,
    },
  };
}
