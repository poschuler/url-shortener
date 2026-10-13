import type { CachedTargetUrl, LinkCache } from "../../application/ports.js";
import type { ShortCode } from "../../domain/short-code.vo.js";
import type { LinksMetrics } from "./links-metrics.js";

// A Redis failure counts as a miss: RedisLinkCache already turns it into one.
export class InstrumentedLinkCache implements LinkCache {
  public constructor(
    private readonly cache: LinkCache,
    private readonly lookups: LinksMetrics["cacheLookups"],
  ) {}

  public async get(code: ShortCode): Promise<CachedTargetUrl> {
    const cached = await this.cache.get(code);
    this.lookups.inc({ result: cached.status });
    return cached;
  }

  public set(code: ShortCode, url: string | null): Promise<void> {
    return this.cache.set(code, url);
  }
}
