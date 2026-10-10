import {
  ApplicationError,
  type ErrorsOf,
} from "../../../shared/domain/application-error.js";

export const LinkErrors = {
  invalidUrl: (detail: string) =>
    new ApplicationError(
      "Link.invalidUrl",
      "The provided URL is invalid",
      detail,
    ),
  notFound: () => new ApplicationError("Link.notFound", "Link not found"),
} as const;

//export type LinkError = ReturnType<(typeof LinkErrors)[keyof typeof LinkErrors]>;
export type LinkError = ErrorsOf<typeof LinkErrors>;
