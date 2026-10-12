import { describe, expect, it } from "vitest";

// Runs against the compose stack, which must be up already.
const writeApiUrl = "http://localhost:3001";

function shorten(body: unknown): Promise<Response> {
  return fetch(new URL("/links", writeApiUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /links", () => {
  it("shortens a Target URL", async () => {
    const url = `https://example.com/e2e/${crypto.randomUUID()}`;

    const response = await shorten({ url });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      code: expect.stringMatching(/^[0-9A-Za-z]{7}$/),
      shortUrl: expect.stringMatching(/\/[0-9A-Za-z]{7}$/),
      url,
      createdAt: expect.any(String),
    });
  });

  it("rejects an invalid Target URL as Problem Details", async () => {
    const response = await shorten({ url: "ftp://example.com" });

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toMatch(
      /^application\/problem\+json/,
    );
    expect(await response.json()).toMatchObject({
      status: 400,
      detail: "Target URL must use http or https",
    });
  });
});
