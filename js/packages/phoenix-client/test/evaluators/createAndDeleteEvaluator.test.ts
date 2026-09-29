import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createEvaluator, deleteEvaluator } from "../../src/evaluators";
import { createTestClient } from "../testUtils";
import { CODE_EVALUATOR_ID, codeDefinition } from "./evaluatorsTestUtils";

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

describe("createEvaluator", () => {
  it("POSTs the code evaluator and returns the definition", async () => {
    let receivedBody: unknown;
    server.use(
      http.post("/v1/evaluators", async ({ request, response }) => {
        receivedBody = await request.json();
        return response(201).json({ data: codeDefinition });
      })
    );

    const evaluator = await createEvaluator({
      client: createTestClient(),
      evaluator: {
        type: "code",
        name: "exact-match",
        source_code: codeDefinition.source_code ?? "",
        language: "PYTHON",
        sandbox_config_id: "U2FuZGJveENvbmZpZzox",
        input_mapping: codeDefinition.input_mapping ?? {
          literal_mapping: {},
          path_mapping: {},
        },
        output_configs: codeDefinition.output_configs,
      },
    });

    expect(receivedBody).toMatchObject({
      type: "code",
      name: "exact-match",
      output_configs: codeDefinition.output_configs,
    });
    expect(evaluator).toEqual(codeDefinition);
  });

  it("rejects when the name is taken", async () => {
    server.use(
      http.post("/v1/evaluators", ({ response }) =>
        response(409).text("An evaluator named 'exact-match' already exists")
      )
    );

    await expect(
      createEvaluator({
        client: createTestClient(),
        evaluator: {
          type: "code",
          name: "exact-match",
          source_code: "x",
          language: "PYTHON",
          sandbox_config_id: "U2FuZGJveENvbmZpZzox",
          input_mapping: { literal_mapping: {}, path_mapping: {} },
          output_configs: codeDefinition.output_configs,
        },
      })
    ).rejects.toThrow();
  });
});

describe("deleteEvaluator", () => {
  it("DELETEs by id", async () => {
    let receivedId: string | undefined;
    server.use(
      http.delete("/v1/evaluators/{evaluator_id}", ({ params, response }) => {
        receivedId = params.evaluator_id;
        return response(204).empty();
      })
    );

    await deleteEvaluator({
      client: createTestClient(),
      evaluatorId: CODE_EVALUATOR_ID,
    });

    expect(receivedId).toBe(CODE_EVALUATOR_ID);
  });

  it("rejects while the evaluator is still bound", async () => {
    server.use(
      http.delete("/v1/evaluators/{evaluator_id}", ({ response }) =>
        response(409).text("still bound")
      )
    );

    await expect(
      deleteEvaluator({
        client: createTestClient(),
        evaluatorId: CODE_EVALUATOR_ID,
      })
    ).rejects.toThrow();
  });
});
