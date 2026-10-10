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

const port = z.coerce.number().int().min(1).max(65_535);
const required = z.string().trim().min(1);

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: port.default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  PUBLIC_BASE_URL: z.url({ protocol: /^https?$/ }),
  MAX_URL_LENGTH: z.coerce.number().int().positive().default(2048),
  SHORT_CODE_KEY: required,

  PG_HOST: required,
  PG_PORT: port.default(5432),
  PG_USER: required,
  PG_PASSWORD: required,
  PG_NAME: required,

  REDIS_HOST: required.default("localhost"),
  REDIS_PORT: port.default(6379),
  REDIS_PASSWORD: required,
});

export function loadConfig(env: EnvSource = process.env): AppConfig {
  const result = EnvSchema.safeParse(env);

  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }

  const vars = result.data;

  return {
    app: {
      env: vars.NODE_ENV,
      port: vars.PORT,
      logLevel: vars.LOG_LEVEL,
      publicBaseUrl: vars.PUBLIC_BASE_URL,
      maxUrlLength: vars.MAX_URL_LENGTH,
      shortCodeKey: vars.SHORT_CODE_KEY,
    },
    db: {
      postgres: {
        host: vars.PG_HOST,
        port: vars.PG_PORT,
        user: vars.PG_USER,
        password: vars.PG_PASSWORD,
        dbName: vars.PG_NAME,
      },
    },
    redis: {
      host: vars.REDIS_HOST,
      port: vars.REDIS_PORT,
      password: vars.REDIS_PASSWORD,
    },
  };
}
