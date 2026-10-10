export class ApplicationError<C extends string = string> {
  readonly code: C;
  readonly message: string;
  readonly detail?: string | undefined;

  constructor(code: C, message: string, detail?: string) {
    this.code = code;
    this.message = message;
    this.detail = detail;
  }
}

export type ErrorsOf<
  T extends Record<string, (...args: never[]) => ApplicationError>,
> = ReturnType<T[keyof T]>;
