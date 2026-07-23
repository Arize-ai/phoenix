import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createHttp } from "../src/index.js";
import { createMockServer, type Server } from "../src/node.js";

const BASE_URL = "http://localhost:6006";

const http = createHttp();

let server: Server;

beforeAll(async () => {
  server = await createMockServer();
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe("createMockServer", () => {
  it("answers spec'd endpoints with schema-conformant generated data", async () => {
    const response = await fetch(`${BASE_URL}/v1/projects`);
    expect(response.status).toBe(200);

    const body: {
      data: Array<{ id: string; name: string }>;
    } = await response.json();
    expect(Array.isArray(body.data)).toBe(true);
    for (const project of body.data) {
      expect(typeof project.id).toBe("string");
      expect(typeof project.name).toBe("string");
    }
  });

  it("answers endpoints with path parameters", async () => {
    const response = await fetch(`${BASE_URL}/v1/datasets/RGF0YXNldDox`);
    expect(response.status).toBe(200);

    const body: {
      data: { id: string; name: string; example_count: number };
    } = await response.json();
    expect(typeof body.data.id).toBe("string");
    expect(typeof body.data.name).toBe("string");
    expect(typeof body.data.example_count).toBe("number");
  });

  it("generates single objects for schemas that declare array-form `examples`", async () => {
    // The `Span` schema carries a JSON Schema `examples: [<span>]` array; the
    // generator must emit one span per item, not the whole array per item.
    const response = await fetch(`${BASE_URL}/v1/projects/test-project/spans`);
    expect(response.status).toBe(200);

    const body: {
      data: Array<{ context: { trace_id: string; span_id: string } }>;
    } = await response.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    for (const span of body.data) {
      expect(Array.isArray(span)).toBe(false);
      expect(typeof span.context.trace_id).toBe("string");
      expect(typeof span.context.span_id).toBe("string");
    }
  });

  it("lets type-safe custom handlers take precedence over generated ones", async () => {
    server.use(
      http.get("/v1/datasets/{id}", ({ params, response }) =>
        response(200).json({
          data: {
            id: params.id,
            name: "my dataset",
            description: null,
            metadata: {},
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
            example_count: 7,
          },
        })
      )
    );

    const response = await fetch(`${BASE_URL}/v1/datasets/RGF0YXNldDox`);
    const body: {
      data: { id: string; name: string; example_count: number };
    } = await response.json();
    expect(body.data).toMatchObject({
      id: "RGF0YXNldDox",
      name: "my dataset",
      example_count: 7,
    });
  });

  it("rejects requests to endpoints outside the OpenAPI definition", async () => {
    await expect(fetch(`${BASE_URL}/v1/not-a-real-endpoint`)).rejects.toThrow();
  });
});
