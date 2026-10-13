import { describe, expect, it } from "vitest";

// Runs against the compose stack, which must be up already. Other tests
// share it, so the counts are only checked to be there, not their values.
const writeApiUrl = "http://localhost:3001";
const readApiUrl = "http://localhost:3002";
const writeMetricsUrl = "http://localhost:9464/metrics";
const readMetricsUrl = "http://localhost:9465/metrics";

async function scrape(url: string): Promise<string> {
  const response = await fetch(url);
  expect(response.status).toBe(200);
  return response.text();
}

describe("GET /metrics", () => {
  it("shows the requests and the queries of write-api", async () => {
    await fetch(new URL("/links", writeApiUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/e2e/metrics" }),
    });

    const metrics = await scrape(writeMetricsUrl);

    expect(metrics).toContain(
      'http_request_duration_seconds_count{method="POST",route="/links",status_code="201"}',
    );
    expect(metrics).toContain(
      'links_db_query_duration_seconds_count{operation="save_link",outcome="ok"}',
    );
  });

  it("shows the requests and the cache reads of read-api", async () => {
    await fetch(new URL("/0000000", readApiUrl), { redirect: "manual" });

    const metrics = await scrape(readMetricsUrl);

    expect(metrics).toContain(
      'http_request_duration_seconds_count{method="GET",route="/:code",status_code="404"}',
    );
    expect(metrics).toContain("links_cache_lookups_total{result=");
  });

  it("is not served on the public ports", async () => {
    const write = await fetch(new URL("/metrics", writeApiUrl));
    const read = await fetch(new URL("/metrics", readApiUrl));

    expect(write.status).toBe(404);
    expect(read.status).toBe(404);
  });
});
