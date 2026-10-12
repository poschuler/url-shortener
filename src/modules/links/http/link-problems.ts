import type { FastifyReply } from "fastify";

import { sendProblem } from "../../../shared/http/problem-details.js";
import type { LinkError } from "../domain/link.errors.js";
import type { ShortCodeError } from "../domain/short-code.errors.js";

// A Record over every error code: a new error does not compile until it has
// a status here.
const STATUS_BY_CODE: Record<(LinkError | ShortCodeError)["code"], number> = {
  "Link.invalidUrl": 400,
  "Link.notFound": 404,
  "ShortCode.invalid": 400,
};

export function sendLinkProblem(
  reply: FastifyReply,
  error: LinkError | ShortCodeError,
): FastifyReply {
  return sendProblem(
    reply,
    STATUS_BY_CODE[error.code],
    error.detail ?? error.message,
  );
}
