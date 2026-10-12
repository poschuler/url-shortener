import type { BaseLogger } from "pino";

import { withTimeout } from "../../../../shared/async/with-timeout.js";
import type { RedisClient } from "../../../../shared/redis/create-redis-client.js";
import type { CachedTargetUrl, LinkCache } from "../../application/ports.js";
import type { ShortCode } from "../../domain/short-code.vo.js";

// Stored for a code without a Link. A Target URL is never empty.
const KNOWN_MISSING = "";

export type RedisLinkCacheOptions = {
  ttlSeconds: number;
  negativeTtlSeconds: number;
  // The client's own timeout stops counting once a command is sent, so a
  // Redis that hangs with the connection open would hang Resolve.
  timeoutMs: number;
};

// A cache failure must not fail Resolve: reads become misses (Postgres
// answers) and writes are skipped.
export class RedisLinkCache implements LinkCache {
  public constructor(
    private readonly redis: RedisClient,
    private readonly logger: BaseLogger,
    private readonly options: RedisLinkCacheOptions,
  ) {}

  public async get(code: ShortCode): Promise<CachedTargetUrl> {
    let value: string | null;

    try {
      value = await withTimeout(
        this.redis.get(keyOf(code)),
        this.options.timeoutMs,
      );
    } catch (error) {
      this.logger.warn({ err: error }, "Link cache read failed");
      return { status: "miss" };
    }

    if (value === null) {
      return { status: "miss" };
    }

    return value === KNOWN_MISSING
      ? { status: "known-missing" }
      : { status: "hit", url: value };
  }

  public async set(code: ShortCode, url: string | null): Promise<void> {
    const ttlSeconds =
      url === null ? this.options.negativeTtlSeconds : this.options.ttlSeconds;

    try {
      await withTimeout(
        this.redis.set(keyOf(code), url ?? KNOWN_MISSING, {
          expiration: { type: "EX", value: ttlSeconds },
        }),
        this.options.timeoutMs,
      );
    } catch (error) {
      this.logger.warn({ err: error }, "Link cache write failed");
    }
  }
}

function keyOf(code: ShortCode): string {
  return `links:target-url:${code.value}`;
}
