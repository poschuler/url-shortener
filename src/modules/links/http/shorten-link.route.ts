import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { Type } from "typebox";

import type { ShortenLink } from "../application/shorten-link.js";
import { sendLinkProblem } from "./link-problems.js";

export type ShortenLinkRouteDeps = {
  shortenLink: ShortenLink;
  publicBaseUrl: string;
  // Requests per client IP in the server's rate limit window.
  rateLimitMax: number;
};

// Only the shape is checked here. Whether the URL is acceptable is a domain
// rule (TargetUrl), so the error explains which rule failed.
const ShortenLinkBody = Type.Object({
  url: Type.String(),
});

const ShortenLinkResponse = Type.Object({
  code: Type.String(),
  shortUrl: Type.String(),
  url: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
});

export function registerShortenLinkRoute(
  app: FastifyInstance,
  { shortenLink, publicBaseUrl, rateLimitMax }: ShortenLinkRouteDeps,
): void {
  app.withTypeProvider<TypeBoxTypeProvider>().post(
    "/links",
    {
      // Strict: each call creates a permanent Link.
      config: { rateLimit: { max: rateLimitMax } },
      schema: {
        body: ShortenLinkBody,
        response: { 201: ShortenLinkResponse },
      },
    },
    async (request, reply) => {
      const result = await shortenLink.execute({ url: request.body.url });

      if (!result.ok) {
        return sendLinkProblem(reply, result.error);
      }

      const link = result.value;
      return reply.code(201).send({
        code: link.code.value,
        shortUrl: new URL(link.code.value, publicBaseUrl).href,
        url: link.url,
        createdAt: link.createdAt.toISOString(),
      });
    },
  );
}
