import { describe, expect, it } from "vitest";
import { z } from "zod";

// Runs against the compose stack, which must be up already.
const writeApiUrl = "http://localhost:3001";
const readApiUrl = "http://localhost:3002";

const ShortenedLink = z.object({ shortUrl: z.string() });

async function shorten(url: string): Promise<string> {
  const response = await fetch(new URL("/links", writeApiUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  expect(response.status).toBe(201);
  return ShortenedLink.parse(await response.json()).shortUrl;
}

describe("GET /:code", () => {
  it("redirects a Short URL to its Target URL", async () => {
    const url = `https://example.com/e2e/${crypto.randomUUID()}`;
    const shortUrl = await shorten(url);

    // The Short URL points to the read side.
    expect(new URL(shortUrl).origin).toBe(readApiUrl);

    const response = await fetch(shortUrl, { redirect: "manual" });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(url);
  });

  it("answers 404 as Problem Details for a Short Code without a Link", async () => {
    const response = await fetch(new URL("/0000000", readApiUrl), {
      redirect: "manual",
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toMatch(
      /^application\/problem\+json/,
    );
    expect(await response.json()).toMatchObject({
      status: 404,
      detail: "Link not found",
    });
  });
});
