import type { Link } from "../../domain/link.js";
import type { LinkRepository } from "../../domain/link.repository.js";
import { type LinksMetrics, timeQuery } from "./links-metrics.js";

export class InstrumentedLinkRepository implements LinkRepository {
  public constructor(
    private readonly repository: LinkRepository,
    private readonly queryDuration: LinksMetrics["queryDuration"],
  ) {}

  public save(link: Link): Promise<void> {
    return timeQuery(this.queryDuration, "save_link", () =>
      this.repository.save(link),
    );
  }
}
