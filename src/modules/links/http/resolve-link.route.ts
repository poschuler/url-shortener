import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { Type } from "typebox";

import type { ResolveLink } from "../application/resolve-link.js";
import { sendLinkProblem } from "./link-problems.js";

export type ResolveLinkRouteDeps = {
  resolveLink: ResolveLink;
  // Requests per client IP in the server's rate limit window.
  rateLimitMax: number;
};

// Any string: whether it is a valid Short Code is a domain rule (ShortCode).
const ResolveLinkParams = Type.Object({
  code: Type.String(),
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
      schema: { params: ResolveLinkParams },
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
