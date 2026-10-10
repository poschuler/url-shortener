import type { ShortCode } from "./short-code.vo.js";
import type { TargetUrl } from "./target-url.js";

export class Link {
  private constructor(
    public readonly code: ShortCode,
    public readonly url: string,
    public readonly createdAt: Date,
  ) {}

  public static create(props: {
    code: ShortCode;
    url: TargetUrl;
    now: Date;
  }): Link {
    return new Link(props.code, props.url.value, props.now);
  }
}
