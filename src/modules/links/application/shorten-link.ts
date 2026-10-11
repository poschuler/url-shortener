import { Result } from "../../../shared/domain/result.js";
import type { LinkError } from "../domain/link.errors.js";
import { Link } from "../domain/link.js";
import type { LinkRepository } from "../domain/link.repository.js";
import type { PermutationKey } from "../domain/short-code-permutation.js";
import { ShortCode } from "../domain/short-code.vo.js";
import { TargetUrl, type TargetUrlRules } from "../domain/target-url.js";
import type { NumberSequence } from "./ports.js";

export type ShortenLinkDeps = {
  sequence: NumberSequence;
  repository: LinkRepository;
  shortCodeKey: PermutationKey;
  targetUrlRules: TargetUrlRules;
  now: () => Date;
};

export type ShortenLinkInput = {
  url: string;
};

export class ShortenLink {
  public constructor(private readonly deps: ShortenLinkDeps) {}

  public async execute(
    input: ShortenLinkInput,
  ): Promise<Result<Link, LinkError>> {
    // Validate before taking an id, so invalid input never burns one.
    const url = TargetUrl.parse(input.url, this.deps.targetUrlRules);

    if (!url.ok) {
      return url;
    }

    const number = await this.deps.sequence.next();
    const link = Link.create({
      code: ShortCode.fromNumber(number, this.deps.shortCodeKey),
      url: url.value,
      now: this.deps.now(),
    });

    await this.deps.repository.save(link);

    return Result.success(link);
  }
}
