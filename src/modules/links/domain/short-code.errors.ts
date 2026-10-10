import {
  ApplicationError,
  type ErrorsOf,
} from "../../../shared/domain/application-error.js";

export const ShortCodeErrors = {
  invalid: (detail: string) =>
    new ApplicationError(
      "ShortCode.invalid",
      "The provided short code is invalid",
      detail,
    ),
} as const;

//export type ShortCodeError = ReturnType<typeof ShortCodeErrors[keyof typeof ShortCodeErrors]>;
export type ShortCodeError = ErrorsOf<typeof ShortCodeErrors>;
