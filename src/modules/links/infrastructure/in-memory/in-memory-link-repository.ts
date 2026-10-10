import type { TargetUrlLookup } from "../../application/ports.js";
import type { Link } from "../../domain/link.js";
import type { LinkRepository } from "../../domain/link.repository.js";
import type { ShortCode } from "../../domain/short-code.vo.js";

// Implements both ports over one store, like the single links table does.
export class InMemoryLinkRepository implements LinkRepository, TargetUrlLookup {
  private readonly links = new Map<string, Link>();

  public save(link: Link): Promise<void> {
    // Mirrors the UNIQUE(code) constraint: a duplicate is a bug, not user error.
    if (this.links.has(link.code.value)) {
      return Promise.reject(
        new Error(`Duplicate short code: ${link.code.value}`),
      );
    }

    this.links.set(link.code.value, link);
    return Promise.resolve();
  }

  public findTargetUrl(code: ShortCode): Promise<string | null> {
    return Promise.resolve(this.links.get(code.value)?.url ?? null);
  }

  public all(): Link[] {
    return [...this.links.values()];
  }
}
