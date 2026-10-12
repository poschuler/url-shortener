import type { FastifyInstance } from "fastify";
import type { Kysely } from "kysely";
import type { BaseLogger } from "pino";

import type { ReadinessCheck } from "../../shared/http/build-server.js";
import { ShortenLink } from "./application/shorten-link.js";
import { permutationKeyFromHex } from "./domain/short-code-permutation.js";
import { registerShortenLinkRoute } from "./http/shorten-link.route.js";
import type { LinksDatabase } from "./infrastructure/postgres/links-database.js";
import { PostgresLinkRepository } from "./infrastructure/postgres/postgres-link-repository.js";
import { PostgresRangeAllocator } from "./infrastructure/postgres/postgres-range-allocator.js";
import { RangedNumberSequence } from "./infrastructure/ranges/ranged-number-sequence.js";

// Fixed tuning, not configuration: the range size itself is set by the
// migration. Ask for the next range once 20% of the current one is left.
const RANGE_REFILL_THRESHOLD = 0.2;
const RANGE_RETRY = { maxAttempts: 3, baseDelayMs: 50 };

export type LinksWriteModuleDeps = {
  db: Kysely<unknown>;
  logger: BaseLogger;
  shortCodeKey: string;
  publicBaseUrl: string;
  maxUrlLength: number;
  rateLimitMax: number;
};

export type LinksWriteModule = {
  readinessChecks: Record<string, ReadinessCheck>;
  registerRoutes: (app: FastifyInstance) => void;
};

// Wires the Shorten side of the module. It does not know which process it
// runs in: write-api and the all-in-one api compose it the same way.
export function createLinksWriteModule(
  deps: LinksWriteModuleDeps,
): LinksWriteModule {
  const db = deps.db.$extendTables<LinksDatabase>();

  const sequence = new RangedNumberSequence({
    allocator: new PostgresRangeAllocator(db),
    refillThreshold: RANGE_REFILL_THRESHOLD,
    retry: RANGE_RETRY,
    logger: deps.logger,
  });

  const shortenLink = new ShortenLink({
    sequence,
    repository: new PostgresLinkRepository(db),
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
