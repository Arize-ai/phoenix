import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  createDatasetEvaluator,
  deleteDatasetEvaluator,
  deleteDatasetEvaluators,
  getDatasetEvaluator,
  getDatasetEvaluators,
  updateDatasetEvaluator,
} from "../../src/evaluators";
import type { DatasetEvaluator } from "../../src/types/evaluators";
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

const BINDING_ID = "RGF0YXNldEV2YWx1YXRvcjox";
const INPUT_MAPPING = {
  literal_mapping: {},
  path_mapping: { output: "output" },
};

const binding: DatasetEvaluator = {
  id: BINDING_ID,
  dataset_id: "RGF0YXNldDox",
  evaluator_id: "RXZhbHVhdG9yOjI=",
  evaluator_type: "code",
  trace_project_id: "UHJvamVjdDo5",
  name: "exact-match",
  input_mapping: INPUT_MAPPING,
  description: null,
  output_configs: null,
};

describe("createDatasetEvaluator", () => {
  it("POSTs to the dataset selected by name and omits absent overrides", async () => {
    let receivedIdentifier: string | undefined;
    let receivedBody: unknown;
    server.use(
      http.post(
        "/v1/datasets/{dataset_identifier}/evaluators",
        async ({ params, request, response }) => {
          receivedIdentifier = params.dataset_identifier;
          receivedBody = await request.json();
          return response(201).json({ data: binding });
        }
      )
    );

    const created = await createDatasetEvaluator({
      client: createTestClient(),
      dataset: { datasetName: "golden-questions" },
      name: "exact-match",
      inputMapping: INPUT_MAPPING,
      evaluator: { type: "reference", evaluator_id: "RXZhbHVhdG9yOjI=" },
    });

    expect(receivedIdentifier).toBe("golden-questions");
    expect(receivedBody).toEqual({
      name: "exact-match",
      input_mapping: INPUT_MAPPING,
      evaluator: { type: "reference", evaluator_id: "RXZhbHVhdG9yOjI=" },
    });
    expect(created).toEqual(binding);
  });

  it("sends description and output config overrides when given", async () => {
    let receivedBody: Record<string, unknown> | undefined;
    server.use(
      http.post(
        "/v1/datasets/{dataset_identifier}/evaluators",
        async ({ request, response }) => {
          receivedBody = (await request.json()) as Record<string, unknown>;
          return response(201).json({ data: binding });
        }
      )
    );

    await createDatasetEvaluator({
      client: createTestClient(),
      dataset: { datasetId: "RGF0YXNldDox" },
      name: "notes",
      inputMapping: INPUT_MAPPING,
      evaluator: { type: "reference", evaluator_id: "RXZhbHVhdG9yOjI=" },
      description: "override",
      outputConfigs: [{ type: "FREEFORM", name: "notes" }],
    });

    expect(receivedBody?.description).toBe("override");
    expect(receivedBody?.output_configs).toEqual([
      { type: "FREEFORM", name: "notes" },
    ]);
  });
});

describe("getDatasetEvaluators", () => {
  it("follows pagination until next_cursor is null", async () => {
    const receivedCursors: Array<string | null> = [];
    server.use(
      http.get(
        "/v1/datasets/{dataset_identifier}/evaluators",
        ({ request, response }) => {
          const cursor = new URL(request.url).searchParams.get("cursor");
          receivedCursors.push(cursor);
          if (cursor === null) {
            return response(200).json({
              data: [{ ...binding, id: "a" }],
              next_cursor: "c1",
            });
          }
          return response(200).json({
            data: [{ ...binding, id: "b" }],
            next_cursor: null,
          });
        }
      )
    );

    const bindings = await getDatasetEvaluators({
      client: createTestClient(),
      dataset: { datasetName: "golden-questions" },
    });

    expect(receivedCursors).toEqual([null, "c1"]);
    expect(bindings.map((b) => b.id)).toEqual(["a", "b"]);
  });
});

describe("getDatasetEvaluators with a limit", () => {
  it("stops after the limit without a second page", async () => {
    let calls = 0;
    server.use(
      http.get(
        "/v1/datasets/{dataset_identifier}/evaluators",
        ({ request, response }) => {
          calls += 1;
          expect(new URL(request.url).searchParams.get("limit")).toBe("1");
          return response(200).json({ data: [binding], next_cursor: "c1" });
        }
      )
    );

    const bindings = await getDatasetEvaluators({
      client: createTestClient(),
      dataset: { datasetName: "golden-questions" },
      limit: 1,
    });

    expect(bindings).toEqual([binding]);
    expect(calls).toBe(1);
  });
});

describe("getDatasetEvaluator and updateDatasetEvaluator", () => {
  it("GETs the binding by id", async () => {
    let receivedId: string | undefined;
    server.use(
      http.get(
        "/v1/dataset_evaluators/{dataset_evaluator_id}",
        ({ params, response }) => {
          receivedId = params.dataset_evaluator_id;
          return response(200).json({ data: binding });
        }
      )
    );

    const result = await getDatasetEvaluator({
      client: createTestClient(),
      datasetEvaluatorId: BINDING_ID,
    });

    expect(receivedId).toBe(BINDING_ID);
    expect(result).toEqual(binding);
  });

  it("PATCHes the patch body as-is, including explicit nulls", async () => {
    let receivedBody: unknown;
    server.use(
      http.patch(
        "/v1/dataset_evaluators/{dataset_evaluator_id}",
        async ({ request, response }) => {
          receivedBody = await request.json();
          return response(200).json({ data: { ...binding, name: "renamed" } });
        }
      )
    );

    const result = await updateDatasetEvaluator({
      client: createTestClient(),
      datasetEvaluatorId: BINDING_ID,
      patch: { name: "renamed", output_configs: null },
    });

    expect(receivedBody).toEqual({ name: "renamed", output_configs: null });
    expect(result.name).toBe("renamed");
  });

  it("refuses an empty patch without calling the server", async () => {
    await expect(
      updateDatasetEvaluator({
        client: createTestClient(),
        datasetEvaluatorId: BINDING_ID,
        patch: {},
      })
    ).rejects.toThrow("At least one field to update must be provided");
  });
});

describe("deleteDatasetEvaluator and deleteDatasetEvaluators", () => {
  it("DELETEs one binding and forwards the prompt flag", async () => {
    let receivedId: string | undefined;
    let receivedFlag: string | null = null;
    server.use(
      http.delete(
        "/v1/dataset_evaluators/{dataset_evaluator_id}",
        ({ params, request, response }) => {
          receivedId = params.dataset_evaluator_id;
          receivedFlag = new URL(request.url).searchParams.get(
            "delete_associated_prompt"
          );
          return response(204).empty();
        }
      )
    );

    await deleteDatasetEvaluator({
      client: createTestClient(),
      datasetEvaluatorId: BINDING_ID,
      deleteAssociatedPrompt: true,
    });

    expect(receivedId).toBe(BINDING_ID);
    expect(receivedFlag).toBe("true");
  });

  it("leaves the prompt flag to the server by default", async () => {
    let receivedFlag: string | null = "unset";
    server.use(
      http.delete(
        "/v1/dataset_evaluators/{dataset_evaluator_id}",
        ({ request, response }) => {
          receivedFlag = new URL(request.url).searchParams.get(
            "delete_associated_prompt"
          );
          return response(204).empty();
        }
      )
    );

    await deleteDatasetEvaluator({
      client: createTestClient(),
      datasetEvaluatorId: BINDING_ID,
    });

    expect(receivedFlag).toBeNull();
  });

  it("POSTs many binding ids in the body", async () => {
    let receivedBody: unknown;
    server.use(
      http.post(
        "/v1/dataset_evaluators/delete",
        async ({ request, response }) => {
          receivedBody = await request.json();
          return response(204).empty();
        }
      )
    );

    await deleteDatasetEvaluators({
      client: createTestClient(),
      datasetEvaluatorIds: ["a", "b"],
      deleteAssociatedPrompt: true,
    });

    expect(receivedBody).toEqual({
      dataset_evaluator_ids: ["a", "b"],
      delete_associated_prompt: true,
    });
  });

  it("refuses an empty id list without calling the server", async () => {
    await expect(
      deleteDatasetEvaluators({
        client: createTestClient(),
        datasetEvaluatorIds: [],
      })
    ).rejects.toThrow("At least one datasetEvaluatorId must be provided");
  });
});
