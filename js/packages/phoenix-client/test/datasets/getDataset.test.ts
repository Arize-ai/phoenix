import { createHttp, type componentsV1 } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { HttpError } from "../../src";
import { getDataset } from "../../src/datasets/getDataset";
import { createTestClient } from "../testUtils";

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

const datasetInfo: componentsV1["schemas"]["DatasetWithExampleCount"] = {
  id: "dataset-123",
  name: "Test Dataset",
  description: "A test dataset",
  metadata: { foo: "bar" },
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  example_count: 2,
};

const exampleOne: componentsV1["schemas"]["DatasetExample"] = {
  id: "ex-1",
  node_id: "ex-1",
  input: { text: "input1" },
  output: { text: "output1" },
  metadata: {},
  updated_at: "2024-01-01T00:00:00Z",
};

const exampleTwo: componentsV1["schemas"]["DatasetExample"] = {
  id: "ex-2",
  node_id: "ex-2",
  input: { text: "input2" },
  output: { text: "output2" },
  metadata: {},
  updated_at: "2024-01-02T00:00:00Z",
};

const exampleThree: componentsV1["schemas"]["DatasetExample"] = {
  id: "ex-3",
  node_id: "ex-3",
  input: { text: "input3" },
  output: { text: "output3" },
  metadata: {},
  updated_at: "2024-01-03T00:00:00Z",
};

/** Register a handler answering `GET /v1/datasets/{id}` with `datasetInfo`. */
function stubDatasetInfo() {
  server.use(
    http.get("/v1/datasets/{id}", ({ response }) =>
      response(200).json({ data: datasetInfo })
    )
  );
}

/** Register a handler answering `GET /v1/datasets` (lookup by name). */
function stubDatasetInfoByName() {
  server.use(
    http.get("/v1/datasets", ({ response }) =>
      response(200).json({ data: [datasetInfo], next_cursor: null })
    )
  );
}

type CapturedExamplesRequest = {
  datasetId: string;
  query: URLSearchParams;
};

/**
 * Register a handler for the dataset examples endpoint that captures every
 * request and answers with the given examples payload.
 */
function stubDatasetExamples(
  data: componentsV1["schemas"]["ListDatasetExamplesData"]
): CapturedExamplesRequest[] {
  const requests: CapturedExamplesRequest[] = [];
  server.use(
    http.get("/v1/datasets/{id}/examples", ({ params, request, response }) => {
      requests.push({
        datasetId: params.id,
        query: new URL(request.url).searchParams,
      });
      return response(200).json({ data });
    })
  );
  return requests;
}

describe("getDataset", () => {
  it("should return merged dataset info and examples", async () => {
    stubDatasetInfo();
    stubDatasetExamples({
      dataset_id: "dataset-123",
      version_id: "v1",
      examples: [exampleOne, exampleTwo],
    });

    const dataset = await getDataset({
      client: createTestClient(),
      dataset: { datasetId: "dataset-123" },
    });

    expect(dataset).toBeDefined();
    expect(dataset.id).toBe("dataset-123");
    expect(dataset.name).toBe("Test Dataset");
    expect(dataset.versionId).toBe("v1");
    expect(dataset.examples).toHaveLength(2);
    expect(dataset.examples[0]?.id).toBe("ex-1");
    expect(dataset.examples[1]?.id).toBe("ex-2");
  });

  it("should support getting dataset by version ID", async () => {
    stubDatasetInfo();
    const requests = stubDatasetExamples({
      dataset_id: "dataset-123",
      version_id: "v2",
      examples: [exampleThree],
    });

    const dataset = await getDataset({
      client: createTestClient(),
      dataset: { datasetId: "dataset-123", versionId: "v2" },
    });

    expect(requests[0]?.datasetId).toBe("dataset-123");
    expect(requests[0]?.query.get("version_id")).toBe("v2");
    expect(dataset.versionId).toBe("v2");
    expect(dataset.examples).toHaveLength(1);
    expect(dataset.examples[0]?.id).toBe("ex-3");
  });

  it("should work without versionId (uses latest version)", async () => {
    stubDatasetInfo();
    const requests = stubDatasetExamples({
      dataset_id: "dataset-123",
      version_id: "v1",
      examples: [exampleOne, exampleTwo],
    });

    const dataset = await getDataset({
      client: createTestClient(),
      dataset: { datasetId: "dataset-123" },
    });

    expect(requests[0]?.query.get("version_id")).toBeNull();
    expect(dataset.versionId).toBe("v1");
    expect(dataset.examples).toHaveLength(2);
  });

  it("should propagate errors from getDatasetInfo", async () => {
    server.use(
      http.get("/v1/datasets/{id}", ({ response }) =>
        response(404).text("Dataset not found")
      )
    );
    stubDatasetExamples({
      dataset_id: "dataset-123",
      version_id: "v1",
      examples: [exampleOne, exampleTwo],
    });

    await expect(
      getDataset({
        client: createTestClient(),
        dataset: { datasetId: "dataset-123" },
      })
    ).rejects.toThrow(HttpError);
  });

  it("should propagate errors from getDatasetExamples", async () => {
    stubDatasetInfo();
    server.use(
      http.get("/v1/datasets/{id}/examples", ({ response }) =>
        response(404).text("Dataset not found")
      )
    );

    await expect(
      getDataset({
        client: createTestClient(),
        dataset: { datasetId: "dataset-123" },
      })
    ).rejects.toThrow(HttpError);
  });

  it("should return merged dataset info and examples when getting by name", async () => {
    stubDatasetInfoByName();
    stubDatasetExamples({
      dataset_id: "dataset-123",
      version_id: "v1",
      examples: [exampleOne, exampleTwo],
    });

    const dataset = await getDataset({
      client: createTestClient(),
      dataset: { datasetName: "Test Dataset" },
    });

    expect(dataset).toBeDefined();
    expect(dataset.id).toBe("dataset-123");
    expect(dataset.name).toBe("Test Dataset");
    expect(dataset.versionId).toBe("v1");
    expect(dataset.examples).toHaveLength(2);
    expect(dataset.examples[0]?.id).toBe("ex-1");
    expect(dataset.examples[1]?.id).toBe("ex-2");
  });
});
