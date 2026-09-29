import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  createProjectEvaluator,
  deleteProjectEvaluator,
  deleteProjectEvaluators,
  getProjectEvaluator,
  getProjectEvaluators,
  updateProjectEvaluator,
} from "../../src/evaluators";
import type { ProjectEvaluator } from "../../src/types/evaluators";
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

const BINDING_ID = "UHJvamVjdEV2YWx1YXRvcjox";

const binding: ProjectEvaluator = {
  id: BINDING_ID,
  project_id: "UHJvamVjdDox",
  evaluator_id: "RXZhbHVhdG9yOjE=",
  evaluator_type: "llm",
  trace_project_id: "UHJvamVjdDo5",
  name: "toxicity",
  evaluation_target: "SPAN",
  sampling_rate: 0.25,
  filter_condition: "",
  enabled: true,
  input_mapping: null,
  evaluation_delay_seconds: 0,
};

describe("createProjectEvaluator", () => {
  it("POSTs to the project selected by name with required fields only", async () => {
    let receivedIdentifier: string | undefined;
    let receivedBody: unknown;
    server.use(
      http.post(
        "/v1/projects/{project_identifier}/evaluators",
        async ({ params, request, response }) => {
          receivedIdentifier = params.project_identifier;
          receivedBody = await request.json();
          return response(201).json({ data: binding });
        }
      )
    );

    const created = await createProjectEvaluator({
      client: createTestClient(),
      project: { projectName: "support-bot" },
      name: "toxicity",
      evaluationTarget: "SPAN",
      samplingRate: 0.25,
      evaluator: { type: "reference", evaluator_id: "RXZhbHVhdG9yOjE=" },
    });

    expect(receivedIdentifier).toBe("support-bot");
    expect(receivedBody).toEqual({
      name: "toxicity",
      evaluation_target: "SPAN",
      sampling_rate: 0.25,
      evaluator: { type: "reference", evaluator_id: "RXZhbHVhdG9yOjE=" },
    });
    expect(created).toEqual(binding);
  });

  it("sends the optional scheduling fields when given", async () => {
    let receivedBody: Record<string, unknown> | undefined;
    server.use(
      http.post(
        "/v1/projects/{project_identifier}/evaluators",
        async ({ request, response }) => {
          receivedBody = (await request.json()) as Record<string, unknown>;
          return response(201).json({ data: binding });
        }
      )
    );

    await createProjectEvaluator({
      client: createTestClient(),
      project: { projectId: "UHJvamVjdDox" },
      name: "toxicity",
      evaluationTarget: "SESSION",
      samplingRate: 1,
      evaluator: { type: "reference", evaluator_id: "RXZhbHVhdG9yOjE=" },
      filterCondition: "span_kind == 'LLM'",
      enabled: false,
      inputMapping: { literal_mapping: {}, path_mapping: {} },
      evaluationDelaySeconds: 600,
    });

    expect(receivedBody).toMatchObject({
      evaluation_target: "SESSION",
      filter_condition: "span_kind == 'LLM'",
      enabled: false,
      input_mapping: { literal_mapping: {}, path_mapping: {} },
      evaluation_delay_seconds: 600,
    });
  });
});

describe("getProjectEvaluators", () => {
  it("follows pagination until next_cursor is null", async () => {
    const receivedCursors: Array<string | null> = [];
    server.use(
      http.get(
        "/v1/projects/{project_identifier}/evaluators",
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

    const bindings = await getProjectEvaluators({
      client: createTestClient(),
      project: { project: "support-bot" },
    });

    expect(receivedCursors).toEqual([null, "c1"]);
    expect(bindings.map((b) => b.id)).toEqual(["a", "b"]);
  });
});

describe("getProjectEvaluators with a limit", () => {
  it("stops after the limit without a second page", async () => {
    let calls = 0;
    server.use(
      http.get(
        "/v1/projects/{project_identifier}/evaluators",
        ({ request, response }) => {
          calls += 1;
          expect(new URL(request.url).searchParams.get("limit")).toBe("1");
          return response(200).json({ data: [binding], next_cursor: "c1" });
        }
      )
    );

    const bindings = await getProjectEvaluators({
      client: createTestClient(),
      project: { projectName: "support-bot" },
      limit: 1,
    });

    expect(bindings).toEqual([binding]);
    expect(calls).toBe(1);
  });
});

describe("getProjectEvaluator and updateProjectEvaluator", () => {
  it("GETs the binding by id", async () => {
    let receivedId: string | undefined;
    server.use(
      http.get(
        "/v1/project_evaluators/{project_evaluator_id}",
        ({ params, response }) => {
          receivedId = params.project_evaluator_id;
          return response(200).json({ data: binding });
        }
      )
    );

    const result = await getProjectEvaluator({
      client: createTestClient(),
      projectEvaluatorId: BINDING_ID,
    });

    expect(receivedId).toBe(BINDING_ID);
    expect(result).toEqual(binding);
  });

  it("PATCHes the patch body as-is, including explicit nulls", async () => {
    let receivedBody: unknown;
    server.use(
      http.patch(
        "/v1/project_evaluators/{project_evaluator_id}",
        async ({ request, response }) => {
          receivedBody = await request.json();
          return response(200).json({ data: { ...binding, enabled: false } });
        }
      )
    );

    const result = await updateProjectEvaluator({
      client: createTestClient(),
      projectEvaluatorId: BINDING_ID,
      patch: { enabled: false, evaluation_delay_seconds: null },
    });

    expect(receivedBody).toEqual({
      enabled: false,
      evaluation_delay_seconds: null,
    });
    expect(result.enabled).toBe(false);
  });

  it("refuses an empty patch without calling the server", async () => {
    await expect(
      updateProjectEvaluator({
        client: createTestClient(),
        projectEvaluatorId: BINDING_ID,
        patch: {},
      })
    ).rejects.toThrow("At least one field to update must be provided");
  });
});

describe("deleteProjectEvaluator and deleteProjectEvaluators", () => {
  it("DELETEs one binding and forwards the prompt flag", async () => {
    let receivedId: string | undefined;
    let receivedFlag: string | null = null;
    server.use(
      http.delete(
        "/v1/project_evaluators/{project_evaluator_id}",
        ({ params, request, response }) => {
          receivedId = params.project_evaluator_id;
          receivedFlag = new URL(request.url).searchParams.get(
            "delete_associated_prompt"
          );
          return response(204).empty();
        }
      )
    );

    await deleteProjectEvaluator({
      client: createTestClient(),
      projectEvaluatorId: BINDING_ID,
      deleteAssociatedPrompt: true,
    });

    expect(receivedId).toBe(BINDING_ID);
    expect(receivedFlag).toBe("true");
  });

  it("leaves the prompt flag to the server by default", async () => {
    let receivedFlag: string | null = "unset";
    server.use(
      http.delete(
        "/v1/project_evaluators/{project_evaluator_id}",
        ({ request, response }) => {
          receivedFlag = new URL(request.url).searchParams.get(
            "delete_associated_prompt"
          );
          return response(204).empty();
        }
      )
    );

    await deleteProjectEvaluator({
      client: createTestClient(),
      projectEvaluatorId: BINDING_ID,
    });

    expect(receivedFlag).toBeNull();
  });

  it("POSTs many binding ids in the body", async () => {
    let receivedBody: unknown;
    server.use(
      http.post(
        "/v1/project_evaluators/delete",
        async ({ request, response }) => {
          receivedBody = await request.json();
          return response(204).empty();
        }
      )
    );

    await deleteProjectEvaluators({
      client: createTestClient(),
      projectEvaluatorIds: ["a", "b"],
      deleteAssociatedPrompt: true,
    });

    expect(receivedBody).toEqual({
      project_evaluator_ids: ["a", "b"],
      delete_associated_prompt: true,
    });
  });

  it("refuses an empty id list without calling the server", async () => {
    await expect(
      deleteProjectEvaluators({
        client: createTestClient(),
        projectEvaluatorIds: [],
      })
    ).rejects.toThrow("At least one projectEvaluatorId must be provided");
  });
});
