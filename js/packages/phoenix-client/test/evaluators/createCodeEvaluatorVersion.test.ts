import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createCodeEvaluatorVersion } from "../../src/evaluators";
import type { CreatedCodeEvaluatorVersion } from "../../src/types/evaluators";
import { createTestClient } from "../testUtils";
import { CODE_EVALUATOR_ID, codeVersion } from "./evaluatorsTestUtils";

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

describe("createCodeEvaluatorVersion", () => {
  it("POSTs the source with the expected version and configuration", async () => {
    const created: CreatedCodeEvaluatorVersion = {
      ...codeVersion,
      id: "Q29kZUV2YWx1YXRvclZlcnNpb246Mg==",
      was_created: true,
    };
    let receivedBody: unknown;
    server.use(
      http.post(
        "/v1/evaluators/{evaluator_id}/versions",
        async ({ request, response }) => {
          receivedBody = await request.json();
          return response(201).json({ data: created });
        }
      )
    );

    const version = await createCodeEvaluatorVersion({
      client: createTestClient(),
      evaluatorId: CODE_EVALUATOR_ID,
      sourceCode: codeVersion.source_code,
      expectedCurrentVersionId: codeVersion.id,
      configuration: { output_configs: [{ type: "FREEFORM", name: "notes" }] },
    });

    expect(receivedBody).toEqual({
      source_code: codeVersion.source_code,
      expected_current_version_id: codeVersion.id,
      output_configs: [{ type: "FREEFORM", name: "notes" }],
    });
    expect(version).toEqual(created);
  });

  it("returns the existing version when the source is unchanged", async () => {
    const existing: CreatedCodeEvaluatorVersion = {
      ...codeVersion,
      was_created: false,
    };
    let receivedBody: unknown;
    server.use(
      http.post(
        "/v1/evaluators/{evaluator_id}/versions",
        async ({ request, response }) => {
          receivedBody = await request.json();
          return response(200).json({ data: existing });
        }
      )
    );

    const version = await createCodeEvaluatorVersion({
      client: createTestClient(),
      evaluatorId: CODE_EVALUATOR_ID,
      sourceCode: codeVersion.source_code,
    });

    expect(receivedBody).toEqual({ source_code: codeVersion.source_code });
    expect(version.was_created).toBe(false);
  });

  it("rejects when another version landed first", async () => {
    server.use(
      http.post("/v1/evaluators/{evaluator_id}/versions", ({ response }) =>
        response(409).text("The evaluator's current version is ...")
      )
    );

    await expect(
      createCodeEvaluatorVersion({
        client: createTestClient(),
        evaluatorId: CODE_EVALUATOR_ID,
        sourceCode: "x",
        expectedCurrentVersionId: codeVersion.id,
      })
    ).rejects.toThrow();
  });
});
