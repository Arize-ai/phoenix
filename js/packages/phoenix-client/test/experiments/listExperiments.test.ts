import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { components } from "../../src/__generated__/api/v1";
import { listExperiments } from "../../src/experiments/listExperiments";
import { createTestClient } from "../testUtils";

const http = createHttp();

type Experiment = components["schemas"]["Experiment"];

const experimentOne: Experiment = {
  id: "exp-1",
  dataset_id: "dataset-123",
  dataset_version_id: "v1",
  name: "experiment-one",
  description: null,
  repetitions: 1,
  metadata: { model: "gpt-4" },
  project_name: "test-project",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
  example_count: 10,
  successful_run_count: 8,
  failed_run_count: 2,
  missing_run_count: 0,
};

const experimentTwo: Experiment = {
  id: "exp-2",
  dataset_id: "dataset-123",
  dataset_version_id: "v2",
  name: "experiment-two",
  description: null,
  repetitions: 2,
  metadata: {},
  project_name: null,
  created_at: "2025-01-02T00:00:00.000Z",
  updated_at: "2025-01-02T00:00:00.000Z",
  example_count: 5,
  successful_run_count: 5,
  failed_run_count: 0,
  missing_run_count: 0,
};

const mockExperiments = [experimentOne, experimentTwo];

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

describe("listExperiments", () => {
  it("should list experiments without pagination if no next_cursor", async () => {
    let requestCount = 0;
    let receivedDatasetId: string | undefined;
    let receivedCursor: string | null = null;
    let receivedLimit: string | null = null;

    server.use(
      http.get(
        "/v1/datasets/{dataset_id}/experiments",
        ({ params, request, response }) => {
          requestCount += 1;
          receivedDatasetId = params.dataset_id;
          const searchParams = new URL(request.url).searchParams;
          receivedCursor = searchParams.get("cursor");
          receivedLimit = searchParams.get("limit");
          // Respond without a next_cursor field, as older servers do.
          return response.untyped(
            new Response(JSON.stringify({ data: mockExperiments }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
      )
    );

    const experiments = await listExperiments({
      client: createTestClient(),
      datasetId: "dataset-123",
    });

    expect(requestCount).toBe(1);
    expect(receivedDatasetId).toBe("dataset-123");
    expect(receivedCursor).toBeNull();
    expect(receivedLimit).toBe("50");

    expect(experiments).toHaveLength(2);
    expect(experiments[0]).toMatchObject({
      id: "exp-1",
      datasetId: "dataset-123",
      datasetVersionId: "v1",
      repetitions: 1,
      projectName: "test-project",
      exampleCount: 10,
      successfulRunCount: 8,
      failedRunCount: 2,
      missingRunCount: 0,
    });
    expect(experiments[1]).toMatchObject({
      id: "exp-2",
      datasetId: "dataset-123",
      projectName: null,
    });
  });

  it("should paginate through records and fetch all experiments", async () => {
    const pages: components["schemas"]["ListExperimentsResponseBody"][] = [
      { data: [experimentOne], next_cursor: "cursor1" },
      { data: [experimentTwo], next_cursor: "cursor2" },
      { data: mockExperiments, next_cursor: null },
    ];
    const receivedCursors: (string | null)[] = [];

    server.use(
      http.get(
        "/v1/datasets/{dataset_id}/experiments",
        ({ request, response }) => {
          receivedCursors.push(new URL(request.url).searchParams.get("cursor"));
          const page = pages[receivedCursors.length - 1];
          if (!page) {
            throw new Error("Unexpected extra pagination request");
          }
          return response(200).json(page);
        }
      )
    );

    const experiments = await listExperiments({
      client: createTestClient(),
      datasetId: "dataset-123",
    });

    expect(receivedCursors).toHaveLength(3);
    expect(experiments).toHaveLength(4); // 1 + 1 + 2 = 4 experiments

    // Verify cursor was passed through
    expect(receivedCursors).toEqual([null, "cursor1", "cursor2"]);
  });

  it("should throw error if API returns no data", async () => {
    server.use(
      http.get("/v1/datasets/{dataset_id}/experiments", ({ response }) =>
        response.untyped(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );

    await expect(
      listExperiments({
        client: createTestClient(),
        datasetId: "dataset-123",
      })
    ).rejects.toThrow("Failed to list experiments");
  });

  it("should handle empty metadata", async () => {
    server.use(
      http.get("/v1/datasets/{dataset_id}/experiments", ({ response }) =>
        response.untyped(
          new Response(
            JSON.stringify({
              data: [{ ...experimentOne, metadata: null }],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          )
        )
      )
    );

    const experiments = await listExperiments({
      client: createTestClient(),
      datasetId: "dataset-123",
    });

    expect(experiments[0]?.metadata).toEqual({});
  });
});
