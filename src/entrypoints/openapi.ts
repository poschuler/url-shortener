import { writeFile } from "node:fs/promises";

import {
  buildOpenApiDocument,
  OPENAPI_DOCUMENT_URL,
} from "./openapi-document.js";

// Regenerates docs/openapi.json from the routes: pnpm openapi
const document = await buildOpenApiDocument();
await writeFile(OPENAPI_DOCUMENT_URL, `${JSON.stringify(document, null, 2)}\n`);
