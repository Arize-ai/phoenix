import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { HttpError } from "../../src/errors";
import {
  createEvaluator,
  deleteEvaluator,
  getSandboxConfigs,
} from "../../src/evaluators";
import { createTestClient } from "../testUtils";
import {
  CODE_EVALUATOR_ID,
  codeDefinition,
  LLM_EVALUATOR_ID,
  llmDefinition,
} from "./evaluatorsTestUtils";

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

describe("createEvaluator for an LLM definition", () => {
  it("pins an existing prompt version", async () => {
    let receivedBody: unknown;
    server.use(
      http.post("/v1/evaluators", async ({ request, response }) => {
        receivedBody = await request.json();
        return response(201).json({ data: llmDefinition });
      })
    );

    const evaluator = await createEvaluator({
      client: createTestClient(),
      evaluator: {
        type: "llm",
        name: "toxicity",
        description: "toxicity",
        prompt: {
          selector: {
            type: "version",
            prompt_version_id: "UHJvbXB0VmVyc2lvbjo3",
          },
        },
        output_configs: llmDefinition.output_configs,
      },
    });

    expect(receivedBody).toMatchObject({
      type: "llm",
      prompt: {
        selector: {
          type: "version",
          prompt_version_id: "UHJvbXB0VmVyc2lvbjo3",
        },
      },
    });
    expect(evaluator).toEqual(llmDefinition);
  });

  it("surfaces problem details on the thrown error", async () => {
    server.use(
      http.post(
        "/v1/evaluators",
        () =>
          new Response(
            JSON.stringify({
              type: "about:blank",
              title: "Conflict",
              status: 409,
              detail: "An evaluator named 'toxicity' already exists",
              code: "already_exists",
              existing_id: LLM_EVALUATOR_ID,
            }),
            {
              status: 409,
              headers: { "content-type": "application/problem+json" },
            }
          )
      )
    );

    const error = await createEvaluator({
      client: createTestClient(),
      evaluator: {
        type: "llm",
        name: "toxicity",
        prompt: {
          selector: {
            type: "version",
            prompt_version_id: "UHJvbXB0VmVyc2lvbjo3",
          },
        },
        output_configs: llmDefinition.output_configs,
      },
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).problem?.code).toBe("already_exists");
    expect((error as HttpError).problem?.existing_id).toBe(LLM_EVALUATOR_ID);
    expect((error as HttpError).message).toContain("already_exists");
  });
});

describe("getSandboxConfigs", () => {
  it("follows pagination and filters by language", async () => {
    const config = {
      id: "U2FuZGJveENvbmZpZzoy",
      name: "wasm",
      description: null,
      language: "PYTHON" as const,
      backend_type: "WASM",
      is_usable: true,
    };
    const languages: (string | null)[] = [];
    server.use(
      http.get("/v1/sandbox_configs", ({ request, response }) => {
        const url = new URL(request.url);
        languages.push(url.searchParams.get("language"));
        if (url.searchParams.get("cursor")) {
          return response(200).json({
            data: [{ ...config, id: "U2FuZGJveENvbmZpZzox" }],
            next_cursor: null,
          });
        }
        return response(200).json({ data: [config], next_cursor: "next" });
      })
    );

    const configs = await getSandboxConfigs({
      client: createTestClient(),
      language: "PYTHON",
    });

    expect(configs.map((c) => c.id)).toEqual([
      "U2FuZGJveENvbmZpZzoy",
      "U2FuZGJveENvbmZpZzox",
    ]);
    expect(languages).toEqual(["PYTHON", "PYTHON"]);
  });
});
