/**
 * Demonstrates testing client functions against a mock Phoenix server from
 * `@arizeai/phoenix-testing`. Every endpoint in the Phoenix OpenAPI
 * definition responds with schema-conformant generated data, and individual
 * responses can be pinned down with type-safe handler overrides.
 */
import { createPhoenixHttp } from "@arizeai/phoenix-testing";
import { createPhoenixMockServer } from "@arizeai/phoenix-testing/node";
import type { SetupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createClient } from "../../src";
import { getDatasetInfo } from "../../src/datasets/getDatasetInfo";

const BASE_URL = "http://localhost:6006";

const http = createPhoenixHttp();

function createTestClient() {
  return createClient({
    getEnvironmentOptions: () => ({}),
    options: { baseUrl: BASE_URL },
  });
}

let server: SetupServer;

beforeAll(async () => {
  server = await createPhoenixMockServer();
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe("client against the mock Phoenix server", () => {
  it("receives schema-conformant generated data with no hand-written mocks", async () => {
    const client = createTestClient();

    const response = await client.GET("/v1/projects");

    expect(response.response.status).toBe(200);
    const projects = response.data?.data;
    expect(Array.isArray(projects)).toBe(true);
    for (const project of projects ?? []) {
      expect(typeof project.id).toBe("string");
      expect(typeof project.name).toBe("string");
    }
  });

  it("supports pinning responses with type-safe handler overrides", async () => {
    server.use(
      http.get("/v1/datasets/{id}", ({ params, response }) =>
        response(200).json({
          data: {
            id: params.id,
            name: "my dataset",
            description: "a dataset pinned by this test",
            metadata: { split: "test" },
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
            example_count: 3,
          },
        })
      )
    );

    const dataset = await getDatasetInfo({
      client: createTestClient(),
      dataset: { datasetId: "RGF0YXNldDox" },
    });

    expect(dataset).toEqual({
      id: "RGF0YXNldDox",
      name: "my dataset",
      description: "a dataset pinned by this test",
      metadata: { split: "test" },
    });
  });
});
