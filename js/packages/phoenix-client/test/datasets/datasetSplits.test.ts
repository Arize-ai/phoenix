import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.unmock("../../src/utils/serverVersionUtils");

import {
  createDatasetSplit,
  deleteDatasetSplit,
  updateDatasetSplit,
} from "../../src/datasets";
import { HttpError } from "../../src/errors";
import { createTestClient } from "../testUtils";

const http = createHttp();
const DATASET_SPLIT = {
  id: "RGF0YXNldFNwbGl0OjE=",
  name: "train",
  description: "Training examples",
  color: "#33c5e8",
  metadata: { purpose: "training" },
  example_count: 2,
  created_at: "2026-08-29T00:00:00Z",
  updated_at: "2026-08-29T00:00:00Z",
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

function serverVersionHandler(version = "19.20.0") {
  return http.get("/arize_phoenix_version", ({ response }) =>
    response.untyped(new Response(version, { status: 200 }))
  );
}

describe("createDatasetSplit", () => {
  it("creates a seeded split and returns the generated response type", async () => {
    const captured: { body?: unknown; datasetIdentifier?: string } = {};
    server.use(
      serverVersionHandler(),
      http.post(
        "/v1/datasets/{dataset_identifier}/splits",
        async ({ params, request, response }) => {
          captured.datasetIdentifier = params.dataset_identifier;
          captured.body = await request.json();
          return response(201).json({ data: DATASET_SPLIT });
        }
      )
    );

    const split = await createDatasetSplit({
      client: createTestClient(),
      dataset: { datasetName: "support-eval" },
      name: "train",
      description: "Training examples",
      color: "#33c5e8",
      metadata: { purpose: "training" },
      exampleIds: ["RGF0YXNldEV4YW1wbGU6MQ=="],
    });

    expect(captured.datasetIdentifier).toBe("support-eval");
    expect(captured.body).toEqual({
      name: "train",
      description: "Training examples",
      color: "#33c5e8",
      metadata: { purpose: "training" },
      example_ids: ["RGF0YXNldEV4YW1wbGU6MQ=="],
    });
    expect(split).toEqual(DATASET_SPLIT);
  });

  it("surfaces duplicate names as an HttpError", async () => {
    server.use(
      serverVersionHandler(),
      http.post("/v1/datasets/{dataset_identifier}/splits", ({ response }) =>
        response.untyped(
          new Response("A dataset split named 'train' already exists", {
            status: 409,
          })
        )
      )
    );

    const error = await createDatasetSplit({
      client: createTestClient(),
      dataset: { datasetName: "support-eval" },
      name: "train",
    }).catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(409);
  });
});

describe("updateDatasetSplit", () => {
  it("sends only fields supplied for a partial update", async () => {
    const captured: { body?: unknown; splitId?: string } = {};
    server.use(
      serverVersionHandler(),
      http.patch(
        "/v1/datasets/{dataset_identifier}/splits/{split_id}",
        async ({ params, request, response }) => {
          captured.splitId = params.split_id;
          captured.body = await request.json();
          return response(200).json({
            data: { ...DATASET_SPLIT, description: null, metadata: {} },
          });
        }
      )
    );

    const split = await updateDatasetSplit({
      client: createTestClient(),
      dataset: { datasetName: "support-eval" },
      splitId: DATASET_SPLIT.id,
      description: null,
      metadata: {},
    });

    expect(captured.splitId).toBe(DATASET_SPLIT.id);
    expect(captured.body).toEqual({ description: null, metadata: {} });
    expect(split.description).toBeNull();
  });

  it("keeps repeated membership additions and removals idempotent", async () => {
    const existingExampleId = "RGF0YXNldEV4YW1wbGU6MQ==";
    const newExampleId = "RGF0YXNldEV4YW1wbGU6Mg==";
    const missingExampleId = "RGF0YXNldEV4YW1wbGU6OTk=";
    const memberIds = new Set([existingExampleId]);
    const capturedBodies: unknown[] = [];
    server.use(
      serverVersionHandler(),
      http.patch(
        "/v1/datasets/{dataset_identifier}/splits/{split_id}",
        async ({ request, response }) => {
          const body = (await request.json()) as {
            add_example_ids?: string[];
            remove_example_ids?: string[];
          };
          capturedBodies.push(body);
          body.add_example_ids?.forEach((exampleId) =>
            memberIds.add(exampleId)
          );
          body.remove_example_ids?.forEach((exampleId) =>
            memberIds.delete(exampleId)
          );
          return response(200).json({
            data: { ...DATASET_SPLIT, example_count: memberIds.size },
          });
        }
      )
    );
    const params = {
      client: createTestClient(),
      dataset: { datasetName: "support-eval" },
      splitId: DATASET_SPLIT.id,
      addExampleIds: [existingExampleId, newExampleId],
      removeExampleIds: [missingExampleId],
    };

    const firstResult = await updateDatasetSplit(params);
    const secondResult = await updateDatasetSplit(params);

    expect(firstResult.example_count).toBe(2);
    expect(secondResult.example_count).toBe(2);
    expect(capturedBodies).toEqual([
      {
        add_example_ids: [existingExampleId, newExampleId],
        remove_example_ids: [missingExampleId],
      },
      {
        add_example_ids: [existingExampleId, newExampleId],
        remove_example_ids: [missingExampleId],
      },
    ]);
  });

  it("surfaces update errors", async () => {
    server.use(
      serverVersionHandler(),
      http.patch(
        "/v1/datasets/{dataset_identifier}/splits/{split_id}",
        ({ response }) =>
          response.untyped(
            new Response("Dataset split not found", { status: 404 })
          )
      )
    );

    await expect(
      updateDatasetSplit({
        client: createTestClient(),
        dataset: { datasetName: "support-eval" },
        splitId: "missing",
        name: "validation",
      })
    ).rejects.toMatchObject({ status: 404 });
  });

  it("surfaces a duplicate name during a partial update", async () => {
    server.use(
      serverVersionHandler(),
      http.patch(
        "/v1/datasets/{dataset_identifier}/splits/{split_id}",
        ({ response }) =>
          response.untyped(
            new Response("A dataset split with this name already exists", {
              status: 409,
            })
          )
      )
    );

    await expect(
      updateDatasetSplit({
        client: createTestClient(),
        dataset: { datasetName: "support-eval" },
        splitId: DATASET_SPLIT.id,
        name: "validation",
      })
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("deleteDatasetSplit", () => {
  it("deletes the split selected by dataset and split identifiers", async () => {
    const captured: { datasetIdentifier?: string; splitId?: string } = {};
    server.use(
      serverVersionHandler(),
      http.delete(
        "/v1/datasets/{dataset_identifier}/splits/{split_id}",
        ({ params, response }) => {
          captured.datasetIdentifier = params.dataset_identifier;
          captured.splitId = params.split_id;
          return response(204).empty();
        }
      )
    );

    await expect(
      deleteDatasetSplit({
        client: createTestClient(),
        dataset: { datasetId: "RGF0YXNldDox" },
        splitId: DATASET_SPLIT.id,
      })
    ).resolves.toBeUndefined();
    expect(captured).toEqual({
      datasetIdentifier: "RGF0YXNldDox",
      splitId: DATASET_SPLIT.id,
    });
  });

  it("surfaces delete errors", async () => {
    server.use(
      serverVersionHandler(),
      http.delete(
        "/v1/datasets/{dataset_identifier}/splits/{split_id}",
        ({ response }) =>
          response.untyped(
            new Response("Invalid dataset split ID", { status: 422 })
          )
      )
    );

    await expect(
      deleteDatasetSplit({
        client: createTestClient(),
        dataset: { datasetName: "support-eval" },
        splitId: "invalid",
      })
    ).rejects.toMatchObject({ status: 422 });
  });

  it("fails before deleting against an older Phoenix server", async () => {
    let deleteRequestCount = 0;
    server.use(
      serverVersionHandler("19.19.0"),
      http.delete(
        "/v1/datasets/{dataset_identifier}/splits/{split_id}",
        ({ response }) => {
          deleteRequestCount += 1;
          return response(204).empty();
        }
      )
    );

    await expect(
      deleteDatasetSplit({
        client: createTestClient(),
        dataset: { datasetName: "support-eval" },
        splitId: DATASET_SPLIT.id,
      })
    ).rejects.toThrow(/requires Phoenix server >= 19\.20\.0/);
    expect(deleteRequestCount).toBe(0);
  });
});
