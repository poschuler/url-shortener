import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { Type } from "typebox";

import { problemResponse } from "../../../shared/http/problem-details.js";
import type { ResolveLink } from "../application/resolve-link.js";
import { sendLinkProblem } from "./link-problems.js";

export type ResolveLinkRouteDeps = {
  resolveLink: ResolveLink;
  // Requests per client IP in the server's rate limit window.
  rateLimitMax: number;
};

// Any string: whether it is a valid Short Code is a domain rule (ShortCode).
const ResolveLinkParams = Type.Object({
  code: Type.String({ description: "The Short Code", examples: ["abc1234"] }),
});

export function registerResolveLinkRoute(
  app: FastifyInstance,
  { resolveLink, rateLimitMax }: ResolveLinkRouteDeps,
): void {
  // Static routes (/health, /ready, /links) win over this parametric one.
  app.withTypeProvider<TypeBoxTypeProvider>().get(
    "/:code",
    {
      // Generous: Resolve creates nothing, and many Visitors can share one
      // IP (NAT, link previews).
      config: { rateLimit: { max: rateLimitMax } },
      schema: {
        operationId: "resolveLink",
        summary: "Resolve a Short Code",
        description: "Redirects the Visitor to the Target URL of the Link.",
        params: ResolveLinkParams,
        response: {
          302: Type.Null({
            description: "Redirects to the Target URL",
            headers: {
              Location: Type.String({ description: "The Target URL" }),
            },
          }),
          400: problemResponse("The Short Code is not valid"),
          404: problemResponse("No Link has this Short Code"),
          429: problemResponse("Too many requests from this client"),
        },
      },
    },
    async (request, reply) => {
      const result = await resolveLink.execute({ code: request.params.code });

      if (!result.ok) {
        return sendLinkProblem(reply, result.error);
      }

      return reply.redirect(result.value, 302);
    },
  );
}
