import type { CachedTargetUrl, LinkCache } from "../../application/ports.js";
import type { ShortCode } from "../../domain/short-code.vo.js";

export class InMemoryLinkCache implements LinkCache {
  private readonly entries = new Map<string, string | null>();

  public get(code: ShortCode): Promise<CachedTargetUrl> {
    const url = this.entries.get(code.value);

    if (url === undefined) {
      return Promise.resolve({ status: "miss" });
    }

    return Promise.resolve(
      url === null ? { status: "known-missing" } : { status: "hit", url },
    );
  }

  public set(code: ShortCode, url: string | null): Promise<void> {
    this.entries.set(code.value, url);
    return Promise.resolve();
  }
}
