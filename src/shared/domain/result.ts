import type { ApplicationError } from "./application-error.js";

export type Success<T> = {
  readonly ok: true;
  readonly value: T;
};

export type Failure<E extends ApplicationError = ApplicationError> = {
  readonly ok: false;
  readonly error: E;
};

export type Result<
  T = undefined,
  E extends ApplicationError = ApplicationError,
> = Success<T> | Failure<E>;

function success(): Success<undefined>;
function success<T>(value: T): Success<T>;
function success<T>(value?: T): Success<T | undefined> {
  return {
    ok: true,
    value,
  };
}

function failure<E extends ApplicationError>(error: E): Failure<E> {
  return { ok: false, error };
}

export const Result = {
  success,
  failure,
};
