import type { TargetUrlLookup } from "../../application/ports.js";
import type { ShortCode } from "../../domain/short-code.vo.js";
import { type LinksMetrics, timeQuery } from "./links-metrics.js";

export class InstrumentedTargetUrlLookup implements TargetUrlLookup {
  public constructor(
    private readonly lookup: TargetUrlLookup,
    private readonly queryDuration: LinksMetrics["queryDuration"],
  ) {}

  public findTargetUrl(code: ShortCode): Promise<string | null> {
    return timeQuery(this.queryDuration, "find_target_url", () =>
      this.lookup.findTargetUrl(code),
    );
  }
}
