import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { HttpError } from "../../src/errors";
import { createExperiment } from "../../src/experiments/createExperiment";
import { createTestClient } from "../testUtils";

const http = createHttp();

const experimentFixture = {
  id: "exp-123",
  dataset_id: "dataset-456",
  dataset_version_id: "version-789",
  name: "test-experiment",
  description: null,
  repetitions: 1,
  metadata: {},
  project_name: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  example_count: 10,
  successful_run_count: 0,
  failed_run_count: 0,
  missing_run_count: 10,
};

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

describe("createExperiment", () => {
  it("should create an experiment with minimal parameters", async () => {
    let receivedDatasetId: string | undefined;
    let receivedRequestBody: unknown;

    server.use(
      http.post(
        "/v1/datasets/{dataset_id}/experiments",
        async ({ params, request, response }) => {
          receivedDatasetId = params.dataset_id;
          receivedRequestBody = await request.json();
          return response(200).json({ data: experimentFixture });
        }
      )
    );

    const result = await createExperiment({
      client: createTestClient(),
      datasetId: "dataset-456",
    });

    expect(receivedDatasetId).toBe("dataset-456");
    // `name` and `description` are undefined and therefore absent from the
    // JSON body on the wire.
    expect(receivedRequestBody).toEqual({
      metadata: {},
      repetitions: 1,
    });

    expect(result).toEqual({
      id: "exp-123",
      datasetId: "dataset-456",
      datasetVersionId: "version-789",
      datasetSplits: [],
      repetitions: 1,
      metadata: {},
      projectName: null,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      exampleCount: 10,
      successfulRunCount: 0,
      failedRunCount: 0,
      missingRunCount: 10,
    });
  });

  it("should create an experiment with all optional parameters", async () => {
    let receivedDatasetId: string | undefined;
    let receivedRequestBody: unknown;

    server.use(
      http.post(
        "/v1/datasets/{dataset_id}/experiments",
        async ({ params, request, response }) => {
          receivedDatasetId = params.dataset_id;
          receivedRequestBody = await request.json();
          return response(200).json({
            data: {
              ...experimentFixture,
              dataset_version_id: "version-specific",
              repetitions: 3,
              metadata: { model: "gpt-4", temperature: 0.7 },
              project_name: "test-project",
              example_count: 5,
              missing_run_count: 15,
            },
          });
        }
      )
    );

    const result = await createExperiment({
      client: createTestClient(),
      datasetId: "dataset-456",
      datasetVersionId: "version-specific",
      experimentName: "My Experiment",
      experimentDescription: "Test experiment description",
      experimentMetadata: { model: "gpt-4", temperature: 0.7 },
      splits: ["train", "test"],
      repetitions: 3,
    });

    expect(receivedDatasetId).toBe("dataset-456");
    expect(receivedRequestBody).toEqual({
      name: "My Experiment",
      description: "Test experiment description",
      metadata: { model: "gpt-4", temperature: 0.7 },
      repetitions: 3,
      version_id: "version-specific",
      splits: ["train", "test"],
    });

    expect(result).toEqual({
      id: "exp-123",
      datasetId: "dataset-456",
      datasetVersionId: "version-specific",
      datasetSplits: ["train", "test"],
      repetitions: 3,
      metadata: { model: "gpt-4", temperature: 0.7 },
      projectName: "test-project",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      exampleCount: 5,
      successfulRunCount: 0,
      failedRunCount: 0,
      missingRunCount: 15,
    });
  });

  it("should create an experiment with splits only", async () => {
    let receivedDatasetId: string | undefined;
    let receivedRequestBody: unknown;

    server.use(
      http.post(
        "/v1/datasets/{dataset_id}/experiments",
        async ({ params, request, response }) => {
          receivedDatasetId = params.dataset_id;
          receivedRequestBody = await request.json();
          return response(200).json({
            data: {
              ...experimentFixture,
              example_count: 3,
              missing_run_count: 3,
            },
          });
        }
      )
    );

    const result = await createExperiment({
      client: createTestClient(),
      datasetId: "dataset-456",
      splits: ["train"],
    });

    expect(receivedDatasetId).toBe("dataset-456");
    expect(receivedRequestBody).toEqual({
      metadata: {},
      repetitions: 1,
      splits: ["train"],
    });

    expect(result.datasetSplits).toEqual(["train"]);
    expect(result.exampleCount).toBe(3);
  });

  it("should create an experiment with custom repetitions", async () => {
    server.use(
      http.post("/v1/datasets/{dataset_id}/experiments", ({ response }) =>
        response(200).json({
          data: {
            ...experimentFixture,
            repetitions: 5,
            missing_run_count: 50,
          },
        })
      )
    );

    const result = await createExperiment({
      client: createTestClient(),
      datasetId: "dataset-456",
      repetitions: 5,
    });

    expect(result.repetitions).toBe(5);
    expect(result.missingRunCount).toBe(50);
  });

  it("should handle null metadata in response", async () => {
    server.use(
      http.post("/v1/datasets/{dataset_id}/experiments", ({ response }) =>
        response.untyped(
          new Response(
            JSON.stringify({ data: { ...experimentFixture, metadata: null } }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          )
        )
      )
    );

    const result = await createExperiment({
      client: createTestClient(),
      datasetId: "dataset-456",
    });

    expect(result.metadata).toEqual({});
  });

  it("should throw error when dataset is not found", async () => {
    server.use(
      http.post("/v1/datasets/{dataset_id}/experiments", ({ response }) =>
        response(404).text("Dataset not found")
      )
    );

    let thrown: unknown;
    try {
      await createExperiment({
        client: createTestClient(),
        datasetId: "nonexistent-dataset",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpError);
    expect((thrown as HttpError).status).toBe(404);
  });

  it("should throw error when response data is missing", async () => {
    server.use(
      http.post("/v1/datasets/{dataset_id}/experiments", ({ response }) =>
        response.untyped(
          new Response(JSON.stringify(null), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );

    await expect(
      createExperiment({
        client: createTestClient(),
        datasetId: "dataset-456",
      })
    ).rejects.toThrow("Failed to create experiment");
  });

  it("should throw error for validation errors", async () => {
    server.use(
      http.post("/v1/datasets/{dataset_id}/experiments", ({ response }) =>
        response(422).json({
          detail: [
            {
              loc: ["body", "repetitions"],
              msg: "Validation Error",
              type: "value_error",
            },
          ],
        })
      )
    );

    let thrown: unknown;
    try {
      await createExperiment({
        client: createTestClient(),
        datasetId: "dataset-456",
        repetitions: 0, // Invalid repetitions
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpError);
    expect((thrown as HttpError).status).toBe(422);
  });

  it("should handle readonly splits array", async () => {
    let receivedDatasetId: string | undefined;
    let receivedRequestBody: unknown;

    server.use(
      http.post(
        "/v1/datasets/{dataset_id}/experiments",
        async ({ params, request, response }) => {
          receivedDatasetId = params.dataset_id;
          receivedRequestBody = await request.json();
          return response(200).json({
            data: {
              ...experimentFixture,
              example_count: 5,
              missing_run_count: 5,
            },
          });
        }
      )
    );

    const splits: readonly string[] = ["train", "validation"] as const;

    const result = await createExperiment({
      client: createTestClient(),
      datasetId: "dataset-456",
      splits,
    });

    expect(receivedDatasetId).toBe("dataset-456");
    expect(receivedRequestBody).toEqual({
      metadata: {},
      repetitions: 1,
      splits: ["train", "validation"],
    });

    expect(result.datasetSplits).toEqual(["train", "validation"]);
  });
});
