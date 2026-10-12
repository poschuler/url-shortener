import { STATUS_CODES } from "node:http";

import type { FastifyInstance, FastifyReply } from "fastify";
import { type Static, Type } from "typebox";

// RFC 9457. "about:blank" means the status code says it all: the title is
// the standard reason phrase and the detail explains this occurrence.
// Registered with an $id, so the OpenAPI document defines it once and every
// error response refers to it.
const ProblemDetailsSchema = Type.Object(
  {
    type: Type.String(),
    title: Type.String(),
    status: Type.Integer(),
    detail: Type.Optional(Type.String()),
  },
  { $id: "ProblemDetails" },
);

export type ProblemDetails = Static<typeof ProblemDetailsSchema>;

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

// A route's response for one error status, documented as Problem Details.
export function problemResponse(description: string) {
  return {
    description,
    content: {
      "application/problem+json": { schema: Type.Ref("ProblemDetails") },
    },
  };
}

export function registerProblemDetails(app: FastifyInstance): void {
  app.addSchema(ProblemDetailsSchema);

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
