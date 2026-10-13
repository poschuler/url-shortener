import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import type { BaseLogger } from "pino";

import type { ReadinessCheck } from "../../shared/http/build-server.js";
import type { RedisClient } from "../../shared/redis/create-redis-client.js";
import { ResolveLink } from "./application/resolve-link.js";
import { ShortenLink } from "./application/shorten-link.js";
import { permutationKeyFromHex } from "./domain/short-code-permutation.js";
import { registerResolveLinkRoute } from "./http/resolve-link.route.js";
import { registerShortenLinkRoute } from "./http/shorten-link.route.js";
import { InstrumentedLinkCache } from "./infrastructure/metrics/instrumented-link-cache.js";
import { InstrumentedLinkRepository } from "./infrastructure/metrics/instrumented-link-repository.js";
import { InstrumentedRangeAllocator } from "./infrastructure/metrics/instrumented-range-allocator.js";
import { InstrumentedTargetUrlLookup } from "./infrastructure/metrics/instrumented-target-url-lookup.js";
import type { LinksMetrics } from "./infrastructure/metrics/links-metrics.js";
import type { LinksDatabase } from "./infrastructure/postgres/links-database.js";
import { PostgresLinkRepository } from "./infrastructure/postgres/postgres-link-repository.js";
import { PostgresRangeAllocator } from "./infrastructure/postgres/postgres-range-allocator.js";
import { PostgresTargetUrlLookup } from "./infrastructure/postgres/postgres-target-url-lookup.js";
import { RangedNumberSequence } from "./infrastructure/ranges/ranged-number-sequence.js";
import { RedisLinkCache } from "./infrastructure/redis/redis-link-cache.js";

export {
  createLinksMetrics,
  type LinksMetrics,
} from "./infrastructure/metrics/links-metrics.js";

// Fixed tuning, not configuration: the range size itself is set by the
// migration. Ask for the next range once 20% of the current one is left.
const RANGE_REFILL_THRESHOLD = 0.2;
const RANGE_RETRY = { maxAttempts: 3, baseDelayMs: 50 };
// A cache read takes about a millisecond. Past this, Postgres answers.
const CACHE_TIMEOUT_MS = 200;

export type LinksModule = {
  readinessChecks: Record<string, ReadinessCheck>;
  registerRoutes: (app: FastifyInstance) => void;
};

export type LinksWriteModuleDeps = {
  db: Kysely<unknown>;
  logger: BaseLogger;
  metrics: LinksMetrics;
  shortCodeKey: string;
  publicBaseUrl: string;
  maxUrlLength: number;
  rateLimitMax: number;
};

// Wires the Shorten side of the module. It does not know which process it
// runs in: write-api and the all-in-one api compose it the same way.
export function createLinksWriteModule(
  deps: LinksWriteModuleDeps,
): LinksModule {
  const db = deps.db.$extendTables<LinksDatabase>();

  const sequence = new RangedNumberSequence({
    allocator: new InstrumentedRangeAllocator(
      new PostgresRangeAllocator(db),
      deps.metrics.queryDuration,
    ),
    refillThreshold: RANGE_REFILL_THRESHOLD,
    retry: RANGE_RETRY,
    logger: deps.logger,
  });

  const shortenLink = new ShortenLink({
    sequence,
    repository: new InstrumentedLinkRepository(
      new PostgresLinkRepository(db),
      deps.metrics.queryDuration,
    ),
    shortCodeKey: permutationKeyFromHex(deps.shortCodeKey),
    targetUrlRules: {
      maxLength: deps.maxUrlLength,
      reservedHostname: new URL(deps.publicBaseUrl).hostname,
    },
    now: () => new Date(),
  });

  return {
    // Not ready until a range is reserved: the first check reserves it.
    readinessChecks: { sequence: () => sequence.ready() },
    registerRoutes: (app) => {
      registerShortenLinkRoute(app, {
        shortenLink,
        publicBaseUrl: deps.publicBaseUrl,
        rateLimitMax: deps.rateLimitMax,
      });
    },
  };
}

export type LinksReadModuleDeps = {
  db: Kysely<unknown>;
  redis: RedisClient;
  logger: BaseLogger;
  metrics: LinksMetrics;
  rateLimitMax: number;
  cacheTtlSeconds: number;
  cacheNegativeTtlSeconds: number;
};

// Wires the Resolve side of the module: read-api and the all-in-one api
// compose it the same way.
export function createLinksReadModule(deps: LinksReadModuleDeps): LinksModule {
  const resolveLink = new ResolveLink({
    cache: new InstrumentedLinkCache(
      new RedisLinkCache(deps.redis, deps.logger, {
        ttlSeconds: deps.cacheTtlSeconds,
        negativeTtlSeconds: deps.cacheNegativeTtlSeconds,
        timeoutMs: CACHE_TIMEOUT_MS,
      }),
      deps.metrics.cacheLookups,
    ),
    lookup: new InstrumentedTargetUrlLookup(
      new PostgresTargetUrlLookup(deps.db.$extendTables<LinksDatabase>()),
      deps.metrics.queryDuration,
    ),
  });

  return {
    // No Redis check on purpose: without the cache, Resolve still works
    // from Postgres, so the process stays ready.
    readinessChecks: {},
    registerRoutes: (app) => {
      registerResolveLinkRoute(app, {
        resolveLink,
        rateLimitMax: deps.rateLimitMax,
      });
    },
  };
}
