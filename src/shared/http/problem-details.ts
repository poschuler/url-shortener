import { STATUS_CODES } from "node:http";

import type { FastifyInstance, FastifyReply } from "fastify";

// RFC 9457. "about:blank" means the status code says it all: the title is
// the standard reason phrase and the detail explains this occurrence.
export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
};

export function sendProblem(
  reply: FastifyReply,
  status: number,
  detail?: string,
): FastifyReply {
  const problem: ProblemDetails = {
    type: "about:blank",
    title: STATUS_CODES[status] ?? "Unknown Error",
    status,
    ...(detail === undefined ? {} : { detail }),
  };

  return reply.code(status).type("application/problem+json").send(problem);
}

export function registerProblemDetails(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const status = clientErrorStatus(error);

    if (status !== undefined && error instanceof Error) {
      return sendProblem(reply, status, error.message);
    }

    request.log.error({ err: error }, "Unhandled error");
    return sendProblem(reply, 500);
  });

  app.setNotFoundHandler((request, reply) =>
    sendProblem(reply, 404, `Route ${request.method} ${request.url} not found`),
  );
}

// Fastify's own errors (bad JSON, schema validation, body too large...) carry a
// 4xx statusCode and a message that is safe to show. Anything else is a bug.
function clientErrorStatus(error: unknown): number | undefined {
  if (
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  ) {
    return error.statusCode;
  }

  return undefined;
}
