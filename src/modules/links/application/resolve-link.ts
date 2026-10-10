import { Result } from "../../../shared/domain/result.js";
import { type LinkError, LinkErrors } from "../domain/link.errors.js";
import type { ShortCodeError } from "../domain/short-code.errors.js";
import { ShortCode } from "../domain/short-code.vo.js";
import type { LinkCache, TargetUrlLookup } from "./ports.js";

export type ResolveLinkDeps = {
  cache: LinkCache;
  lookup: TargetUrlLookup;
};

export type ResolveLinkInput = {
  code: string;
};

export class ResolveLink {
  public constructor(private readonly deps: ResolveLinkDeps) {}

  public async execute(
    input: ResolveLinkInput,
  ): Promise<Result<string, ShortCodeError | LinkError>> {
    const code = ShortCode.parse(input.code);

    if (!code.ok) {
      return code;
    }

    const cached = await this.deps.cache.get(code.value);

    switch (cached.status) {
      case "hit":
        return Result.success(cached.url);
      case "known-missing":
        return Result.failure(LinkErrors.notFound());
      case "miss":
        break;
    }

    const url = await this.deps.lookup.findTargetUrl(code.value);
    await this.deps.cache.set(code.value, url);

    return url === null
      ? Result.failure(LinkErrors.notFound())
      : Result.success(url);
  }
}
