import { Result } from "../../../shared/domain/result.js";
import { type LinkError, LinkErrors } from "./link.errors.js";

export type TargetUrlRules = {
  maxLength: number;
  reservedHostname: string;
};

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export class TargetUrl {
  private constructor(public readonly value: string) {}

  public static parse(
    raw: string,
    rules: TargetUrlRules,
  ): Result<TargetUrl, LinkError> {
    const url = URL.parse(raw);

    if (url === null) {
      return Result.failure(
        LinkErrors.invalidUrl("Target URL must be an absolute URL"),
      );
    }

    if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
      return Result.failure(
        LinkErrors.invalidUrl("Target URL must use http or https"),
      );
    }

    if (url.username !== "" || url.password !== "") {
      return Result.failure(
        LinkErrors.invalidUrl("Target URL must not contain credentials"),
      );
    }

    if (url.hostname === rules.reservedHostname) {
      return Result.failure(
        LinkErrors.invalidUrl("Target URL must not point to this shortener"),
      );
    }

    if (url.href.length > rules.maxLength) {
      return Result.failure(
        LinkErrors.invalidUrl(
          `Target URL must be at most ${rules.maxLength} characters long`,
        ),
      );
    }

    return Result.success(new TargetUrl(url.href));
  }
}
