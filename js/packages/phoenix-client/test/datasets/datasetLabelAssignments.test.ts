import { createHttp, type componentsV1 } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.unmock("../../src/utils/serverVersionUtils");

import { HttpError } from "../../src";
import {
  addLabelToDataset,
  listLabelsForDataset,
  removeLabelFromDataset,
  replaceLabelsForDataset,
} from "../../src/datasets";
import { createTestClient } from "../testUtils";

const http = createHttp();

let server: Server;

beforeAll(async () => {
  server = await createMockServer();
  server.listen({ onUnhandledRequest: "error" });
});

beforeEach(() => {
  server.use(serverVersionHandler("17.16.0"));
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

const goldenLabel: componentsV1["schemas"]["DatasetLabel"] = {
  id: "RGF0YXNldExhYmVsOjE=",
  name: "golden",
  description: "Curated evaluation datasets",
  color: "#00cc88",
};

const regressionLabel: componentsV1["schemas"]["DatasetLabel"] = {
  id: "RGF0YXNldExhYmVsOjI=",
  name: "regression",
  description: null,
  color: "#cc8800",
};

function serverVersionHandler(version: string) {
  return http.get("/arize_phoenix_version", ({ response }) =>
    response.untyped(new Response(version, { status: 200 }))
  );
}

describe("dataset label assignments", () => {
  it("lists labels using either a dataset name or GlobalID", async () => {
    const datasetIdentifiers: string[] = [];
    server.use(
      http.get(
        "/v1/datasets/{dataset_identifier}/labels",
        ({ params, response }) => {
          datasetIdentifiers.push(params.dataset_identifier);
          return response(200).json({ data: [goldenLabel] });
        }
      )
    );

    const client = createTestClient();
    const labelsByName = await listLabelsForDataset({
      client,
      dataset: { datasetName: "support-eval" },
    });
    const labelsById = await listLabelsForDataset({
      client,
      dataset: { datasetId: "RGF0YXNldDox" },
    });

    expect(datasetIdentifiers).toEqual(["support-eval", "RGF0YXNldDox"]);
    expect(labelsByName).toEqual([goldenLabel]);
    expect(labelsById).toEqual([goldenLabel]);
  });

  it("adds a label idempotently and returns the applied label", async () => {
    const requests: Array<{ datasetIdentifier: string; labelId: string }> = [];
    server.use(
      http.put(
        "/v1/datasets/{dataset_identifier}/labels/{label_id}",
        ({ params, response }) => {
          requests.push({
            datasetIdentifier: params.dataset_identifier,
            labelId: params.label_id,
          });
          return response(200).json({ data: goldenLabel });
        }
      )
    );

    const params = {
      client: createTestClient(),
      dataset: { datasetName: "support-eval" },
      labelId: goldenLabel.id,
    } as const;

    await expect(addLabelToDataset(params)).resolves.toEqual(goldenLabel);
    await expect(addLabelToDataset(params)).resolves.toEqual(goldenLabel);
    expect(requests).toEqual([
      { datasetIdentifier: "support-eval", labelId: goldenLabel.id },
      { datasetIdentifier: "support-eval", labelId: goldenLabel.id },
    ]);
  });

  it("removes a label idempotently", async () => {
    let requestCount = 0;
    server.use(
      http.delete(
        "/v1/datasets/{dataset_identifier}/labels/{label_id}",
        ({ params, response }) => {
          requestCount += 1;
          expect(params).toEqual({
            dataset_identifier: "RGF0YXNldDox",
            label_id: goldenLabel.id,
          });
          return response(204).empty();
        }
      )
    );

    const params = {
      client: createTestClient(),
      dataset: { datasetId: "RGF0YXNldDox" },
      labelId: goldenLabel.id,
    } as const;

    await expect(removeLabelFromDataset(params)).resolves.toBeUndefined();
    await expect(removeLabelFromDataset(params)).resolves.toBeUndefined();
    expect(requestCount).toBe(2);
  });

  it("replaces the complete label set", async () => {
    let requestBody: unknown;
    server.use(
      http.put(
        "/v1/datasets/{dataset_identifier}/labels",
        async ({ params, request, response }) => {
          expect(params.dataset_identifier).toBe("support-eval");
          requestBody = await request.json();
          return response(200).json({
            data: [goldenLabel, regressionLabel],
          });
        }
      )
    );

    const labels = await replaceLabelsForDataset({
      client: createTestClient(),
      dataset: { datasetName: "support-eval" },
      labelIds: [goldenLabel.id, regressionLabel.id],
    });

    expect(requestBody).toEqual({
      dataset_label_ids: [goldenLabel.id, regressionLabel.id],
    });
    expect(labels).toEqual([goldenLabel, regressionLabel]);
  });

  it("supports an empty replacement to clear all labels", async () => {
    let requestBody: unknown;
    server.use(
      http.put(
        "/v1/datasets/{dataset_identifier}/labels",
        async ({ request, response }) => {
          requestBody = await request.json();
          return response(200).json({ data: [] });
        }
      )
    );

    const labels = await replaceLabelsForDataset({
      client: createTestClient(),
      dataset: { datasetId: "RGF0YXNldDox" },
      labelIds: [],
    });

    expect(requestBody).toEqual({ dataset_label_ids: [] });
    expect(labels).toEqual([]);
  });

  it.each([
    ["list", "get", "/v1/datasets/{dataset_identifier}/labels"],
    ["add", "put", "/v1/datasets/{dataset_identifier}/labels/{label_id}"],
    ["remove", "delete", "/v1/datasets/{dataset_identifier}/labels/{label_id}"],
    ["replace", "put", "/v1/datasets/{dataset_identifier}/labels"],
  ] as const)("propagates %s errors", async (operation, method, path) => {
    server.use(
      http[method](path, ({ response }) =>
        response(404).text("Dataset not found")
      )
    );

    const client = createTestClient();
    const request =
      operation === "list"
        ? listLabelsForDataset({
            client,
            dataset: { datasetName: "missing" },
          })
        : operation === "add"
          ? addLabelToDataset({
              client,
              dataset: { datasetName: "missing" },
              labelId: goldenLabel.id,
            })
          : operation === "remove"
            ? removeLabelFromDataset({
                client,
                dataset: { datasetName: "missing" },
                labelId: goldenLabel.id,
              })
            : replaceLabelsForDataset({
                client,
                dataset: { datasetName: "missing" },
                labelIds: [goldenLabel.id],
              });

    await expect(request).rejects.toBeInstanceOf(HttpError);
  });

  it("fails before assigning labels on unsupported Phoenix servers", async () => {
    let assignmentRequestCount = 0;
    server.use(
      serverVersionHandler("17.15.0"),
      http.put(
        "/v1/datasets/{dataset_identifier}/labels/{label_id}",
        ({ response }) => {
          assignmentRequestCount += 1;
          return response(200).json({ data: goldenLabel });
        }
      )
    );

    await expect(
      addLabelToDataset({
        client: createTestClient(),
        dataset: { datasetName: "support-eval" },
        labelId: goldenLabel.id,
      })
    ).rejects.toThrow(/requires Phoenix server >= 17\.16\.0/);

    expect(assignmentRequestCount).toBe(0);
  });
});
