import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  buildOpenApiDocument,
  OPENAPI_DOCUMENT_URL,
} from "#src/entrypoints/openapi-document.js";

describe("docs/openapi.json", () => {
  it("matches the routes (run pnpm openapi to update it)", async () => {
    const saved: unknown = JSON.parse(
      await readFile(OPENAPI_DOCUMENT_URL, "utf8"),
    );

    expect(await buildOpenApiDocument()).toEqual(saved);
  });
});
