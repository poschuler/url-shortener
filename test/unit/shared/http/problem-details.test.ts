import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import {
  registerProblemDetails,
  sendProblem,
} from "#src/shared/http/problem-details.js";

function buildApp() {
  const app = Fastify();
  registerProblemDetails(app);

  app.post(
    "/validated",
    {
      schema: {
        body: {
          type: "object",
          required: ["url"],
          properties: { url: { type: "string" } },
        },
      },
    },
    async () => ({ ok: true }),
  );
  app.get("/conflict", async () => {
    throw Object.assign(new Error("Already taken"), { statusCode: 409 });
  });
  app.get("/bug", async () => {
    throw new Error("Connection string with a password");
  });
  app.get("/not-an-error", async () => {
    // oxlint-disable-next-line typescript/only-throw-error -- on purpose
    throw "boom";
  });
  app.get("/gone", async (_request, reply) => sendProblem(reply, 410));

  return app;
}

describe("problem details", () => {
  it("answers schema validation errors with 400 and the reason", async () => {
    const response = await buildApp().inject({
      method: "POST",
      url: "/validated",
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toBe(
      "application/problem+json; charset=utf-8",
    );
    expect(response.json()).toEqual({
      type: "about:blank",
      title: "Bad Request",
      status: 400,
      detail: "body must have required property 'url'",
    });
  });

  it("answers malformed JSON with 400", async () => {
    const response = await buildApp().inject({
      method: "POST",
      url: "/validated",
      headers: { "content-type": "application/json" },
      payload: "{",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      status: 400,
      title: "Bad Request",
    });
  });

  it("keeps the status and message of other client errors", async () => {
    const response = await buildApp().inject({ url: "/conflict" });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      type: "about:blank",
      title: "Conflict",
      status: 409,
      detail: "Already taken",
    });
  });

  it.each(["/bug", "/not-an-error"])(
    "hides the cause of unexpected errors (%s)",
    async (url) => {
      const response = await buildApp().inject({ url });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
      });
    },
  );

  it("answers unknown routes with 404", async () => {
    const response = await buildApp().inject({ url: "/nope?x=1" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      type: "about:blank",
      title: "Not Found",
      status: 404,
      detail: "Route GET /nope?x=1 not found",
    });
  });

  it("lets routes send a problem without detail", async () => {
    const response = await buildApp().inject({ url: "/gone" });

    expect(response.statusCode).toBe(410);
    expect(response.json()).toEqual({
      type: "about:blank",
      title: "Gone",
      status: 410,
    });
  });
});
