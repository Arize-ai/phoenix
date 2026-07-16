import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createPhoenixHttp } from "../src/index.js";
import { createMockServer, type Server } from "../src/node.js";

const BASE_URL = "http://localhost:6006";

const http = createPhoenixHttp();

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

    const body = (await response.json()) as {
      data: Array<{ id: string; name: string }>;
    };
    expect(Array.isArray(body.data)).toBe(true);
    for (const project of body.data) {
      expect(typeof project.id).toBe("string");
      expect(typeof project.name).toBe("string");
    }
  });

  it("answers endpoints with path parameters", async () => {
    const response = await fetch(`${BASE_URL}/v1/datasets/RGF0YXNldDox`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      data: { id: string; name: string; example_count: number };
    };
    expect(typeof body.data.id).toBe("string");
    expect(typeof body.data.name).toBe("string");
    expect(typeof body.data.example_count).toBe("number");
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
    const body = (await response.json()) as {
      data: { id: string; name: string; example_count: number };
    };
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
