import type { ShortCode } from "../domain/short-code.vo.js";

export interface NumberSequence {
  next(): Promise<bigint>;
}

export interface TargetUrlLookup {
  findTargetUrl(code: ShortCode): Promise<string | null>;
}

export type CachedTargetUrl =
  | { readonly status: "hit"; readonly url: string }
  | { readonly status: "known-missing" }
  | { readonly status: "miss" };

export interface LinkCache {
  get(code: ShortCode): Promise<CachedTargetUrl>;
  set(code: ShortCode, url: string | null): Promise<void>;
}
