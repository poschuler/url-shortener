import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { Type } from "typebox";

import { problemResponse } from "../../../shared/http/problem-details.js";
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
  url: Type.String({
    description: "The Target URL: an absolute http or https URL",
    examples: ["https://example.com/a/long/path?with=query"],
  }),
});

const ShortenLinkResponse = Type.Object(
  {
    code: Type.String({ description: "The Short Code" }),
    shortUrl: Type.String({ description: "The Short URL to share" }),
    url: Type.String({ description: "The Target URL, normalized" }),
    createdAt: Type.String({ format: "date-time" }),
  },
  { description: "The Link was created" },
);

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
        operationId: "shortenLink",
        summary: "Shorten a URL",
        description:
          "Creates a new Link on every call, even for a URL already shortened.",
        body: ShortenLinkBody,
        response: {
          201: ShortenLinkResponse,
          400: problemResponse("The body or the Target URL is not valid"),
          429: problemResponse("Too many requests from this client"),
        },
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
