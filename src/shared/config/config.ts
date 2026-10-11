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

export type AppConfig = {
  app: {
    env: "development" | "test" | "production";
    port: number;
    logLevel: LogLevel;
    publicBaseUrl: string;
    maxUrlLength: number;
    shortCodeKey: string;
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
};

export type MigrateConfig = {
  app: Pick<AppConfig["app"], "logLevel">;
  db: AppConfig["db"];
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

const ApiEnv = z.object({
  ...LoggingEnv.shape,
  ...PostgresEnv.shape,
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: port.default(3000),
  PUBLIC_BASE_URL: z.url({ protocol: /^https?$/ }),
  MAX_URL_LENGTH: z.coerce.number().int().positive().default(2048),
  SHORT_CODE_KEY: required,

  REDIS_HOST: required.default("localhost"),
  REDIS_PORT: port.default(6379),
  REDIS_PASSWORD: required,
});

const MigrateEnv = z.object({
  ...LoggingEnv.shape,
  ...PostgresEnv.shape,
});

export function loadConfig(env: EnvSource = process.env): AppConfig {
  const vars = parseEnv(ApiEnv, env);

  return {
    app: {
      env: vars.NODE_ENV,
      port: vars.PORT,
      logLevel: vars.LOG_LEVEL,
      publicBaseUrl: vars.PUBLIC_BASE_URL,
      maxUrlLength: vars.MAX_URL_LENGTH,
      shortCodeKey: vars.SHORT_CODE_KEY,
    },
    db: toDbConfig(vars),
    redis: {
      host: vars.REDIS_HOST,
      port: vars.REDIS_PORT,
      password: vars.REDIS_PASSWORD,
    },
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

function toDbConfig(vars: z.output<typeof PostgresEnv>): AppConfig["db"] {
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
