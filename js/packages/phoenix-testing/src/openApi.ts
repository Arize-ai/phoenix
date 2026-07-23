import { readFileSync } from "node:fs";
import { fromOpenApi } from "@mswjs/source/open-api";
import type { RequestHandler } from "msw";

import { DEFAULT_MOCK_BASE_URL } from "./constants.js";

// This is an internal workspace package, so the repository schema is available
// both when Vitest loads src/ and when Node loads dist/ after `pnpm -r build`.
const openApiDocument: Record<string, unknown> = JSON.parse(
  readFileSync(
    new URL("../../../../schemas/openapi.json", import.meta.url),
    "utf8"
  )
);

/**
 * Get a copy of the Phoenix OpenAPI document with its `servers` entry pointed
 * at the given base URL, so that generated handlers match absolute request
 * URLs issued by clients under test.
 *
 * @param params - configuration
 * @param params.baseUrl - the Phoenix server base URL requests are sent to
 */
export function getOpenApiDocument({
  baseUrl = DEFAULT_MOCK_BASE_URL,
}: {
  baseUrl?: string;
} = {}): Record<string, unknown> {
  return {
    ...openApiDocument,
    servers: [{ url: baseUrl }],
  };
}

/**
 * `@mswjs/source` understands the OpenAPI `example` keyword but treats the
 * JSON Schema `examples` keyword (an array of candidate values) as the value
 * itself, generating an array wherever a schema declares one — e.g. a `Span`
 * with `examples: [{...}]` yields `Span[]` in place of every `Span`. Rewrite
 * array-form `examples` to a single `example` so generated responses conform
 * to the schema. Map-form `examples` (OpenAPI media-type examples) are not
 * arrays and pass through untouched.
 */
function normalizeSchemaExamples(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(normalizeSchemaExamples);
  }
  if (node === null || typeof node !== "object") {
    return node;
  }
  const record: Record<string, unknown> = { ...node };
  if (Array.isArray(record.examples)) {
    const [firstExample] = record.examples;
    delete record.examples;
    if (record.example === undefined && firstExample !== undefined) {
      record.example = firstExample;
    }
  }
  for (const [key, value] of Object.entries(record)) {
    record[key] = normalizeSchemaExamples(value);
  }
  return record;
}

/**
 * Create MSW request handlers for every operation in the Phoenix OpenAPI
 * definition. Responses are derived from the response schemas and examples
 * declared in the definition, so they are spec-conformant but contain
 * placeholder data. Compose these after your own handlers so that explicit
 * mocks take precedence:
 *
 * ```ts
 * const handlers = await createOpenApiHandlers();
 * setupServer(...customHandlers, ...handlers);
 * ```
 *
 * @param params - configuration
 * @param params.baseUrl - the Phoenix server base URL requests are sent to
 */
export async function createOpenApiHandlers({
  baseUrl = DEFAULT_MOCK_BASE_URL,
}: {
  baseUrl?: string;
} = {}): Promise<RequestHandler[]> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- normalizeSchemaExamples preserves the document's object shape
  const document = normalizeSchemaExamples(
    getOpenApiDocument({ baseUrl })
  ) as Record<string, unknown>;
  // The document is a runtime-validated JSON value; fromOpenApi's parameter
  // type is the openapi-types Document union, which structural typing of a
  // Record<string, unknown> cannot satisfy without a cast.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see comment above
  return fromOpenApi(document as Parameters<typeof fromOpenApi>[0]);
}
