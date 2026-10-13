import { check, fail } from "k6";
import http from "k6/http";
import type { Options } from "k6/options";

// Load test of the read path. It runs in k6, not Node.js, inside the compose
// network: see "Load testing" in the README.
const writeApiUrl = __ENV.WRITE_API_URL ?? "http://localhost:3001";
const readApiUrl = __ENV.READ_API_URL ?? "http://localhost:3002";

const LINK_COUNT = 1000;
// Short Codes without a Link, drawn from a fixed set so the cache learns
// them: after the first request each, they are known-missing.
const MISSING_COUNT = 100;
const MISSING_SHARE = 0.1;
const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export const options: Options = {
  scenarios: {
    // A fixed rate, not a fixed number of users: when the API slows down,
    // requests queue up and the latency shows it.
    resolve: {
      executor: "constant-arrival-rate",
      exec: "resolve",
      rate: Number(__ENV.RATE ?? "500"),
      timeUnit: "1s",
      duration: __ENV.DURATION ?? "1m",
      preAllocatedVUs: 50,
      maxVUs: 500,
    },
  },
  // Loose on purpose: they catch a broken cache or a wall of 429s, they do
  // not measure the machine.
  thresholds: {
    "http_req_failed{scenario:resolve}": ["rate<0.01"],
    "http_req_duration{scenario:resolve}": ["p(95)<100", "p(99)<250"],
    checks: ["rate>0.99"],
  },
  setupTimeout: "2m",
};

// A 404 for a Short Code without a Link is an answer, not a failure.
http.setResponseCallback(http.expectedStatuses(201, 302, 404));

type SetupData = { codes: string[]; missingCodes: string[] };

export function setup(): SetupData {
  const codes: string[] = [];

  while (codes.length < LINK_COUNT) {
    const responses = http.batch(
      Array.from({ length: 50 }, (_, i) => ({
        method: "POST",
        url: `${writeApiUrl}/links`,
        body: JSON.stringify({
          url: `https://example.com/load/${codes.length + i}`,
        }),
        params: { headers: { "content-type": "application/json" } },
      })),
    );

    for (const response of responses) {
      const code = response.json("code");
      if (response.status !== 201 || typeof code !== "string") {
        fail(`POST /links answered ${response.status}: is the rate limit up?`);
      }
      codes.push(code);
    }
  }

  // Almost never a Short Code with a Link: 1000 among 62^7.
  const missingCodes = Array.from({ length: MISSING_COUNT }, randomCode);

  return { codes, missingCodes };
}

export function resolve({ codes, missingCodes }: SetupData): void {
  if (Math.random() < MISSING_SHARE) {
    const response = http.get(`${readApiUrl}/${pick(missingCodes)}`, {
      redirects: 0,
      tags: { name: "missing" },
    });
    check(response, { "is 404": (r) => r.status === 404 });
    return;
  }

  const response = http.get(`${readApiUrl}/${pick(codes)}`, {
    redirects: 0,
    tags: { name: "existing" },
  });
  check(response, { "is 302": (r) => r.status === 302 });
}

function pick(codes: string[]): string {
  return codes[Math.floor(Math.random() * codes.length)] ?? "";
}

function randomCode(): string {
  return Array.from(
    { length: 7 },
    () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)],
  ).join("");
}
