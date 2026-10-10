import { Result } from "../../../shared/domain/result.js";
import { type PermutationKey, permute } from "./short-code-permutation.js";
import { type ShortCodeError, ShortCodeErrors } from "./short-code.errors.js";

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SHORT_CODE_PATTERN = new RegExp(`^[${ALPHABET}]+$`);
const BASE = ALPHABET.length; // 62
const CODE_LENGTH = 7;

export class ShortCode {
  private constructor(public readonly value: string) {}

  public static parse(raw: string): Result<ShortCode, ShortCodeError> {
    if (raw.length === 0) {
      return Result.failure(
        ShortCodeErrors.invalid("Short code cannot be empty"),
      );
    }

    if (raw.length !== CODE_LENGTH) {
      return Result.failure(
        ShortCodeErrors.invalid(
          `Short code must be ${CODE_LENGTH} characters long`,
        ),
      );
    }

    if (!SHORT_CODE_PATTERN.test(raw)) {
      return Result.failure(
        ShortCodeErrors.invalid(
          "Only base62 characters (0-9, A-Z, a-z) are allowed",
        ),
      );
    }

    return Result.success(new ShortCode(raw));
  }

  public static fromNumber(n: bigint, key: PermutationKey): ShortCode {
    let x = permute(Number(n), key);
    let code = "";

    while (x > 0) {
      code = ALPHABET[x % BASE] + code;
      x = Math.floor(x / BASE);
    }

    return new ShortCode(code.padStart(CODE_LENGTH, ALPHABET[0]));
  }
}
