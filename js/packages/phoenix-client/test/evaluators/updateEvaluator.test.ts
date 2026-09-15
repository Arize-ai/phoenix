import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { updateEvaluator } from "../../src/evaluators";
import { createTestClient } from "../testUtils";
import { LLM_EVALUATOR_ID, llmDefinition } from "./evaluatorsTestUtils";

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

describe("updateEvaluator", () => {
  it("PATCHes the discriminated patch body as-is", async () => {
    let receivedId: string | undefined;
    let receivedBody: unknown;
    server.use(
      http.patch(
        "/v1/evaluators/{evaluator_id}",
        async ({ params, request, response }) => {
          receivedId = params.evaluator_id;
          receivedBody = await request.json();
          return response(200).json({
            data: { ...llmDefinition, description: "updated" },
          });
        }
      )
    );

    const evaluator = await updateEvaluator({
      client: createTestClient(),
      evaluatorId: LLM_EVALUATOR_ID,
      patch: { type: "llm", description: "updated" },
    });

    expect(receivedId).toBe(LLM_EVALUATOR_ID);
    expect(receivedBody).toEqual({ type: "llm", description: "updated" });
    expect(evaluator.description).toBe("updated");
  });

  it("refuses a patch with nothing to change without calling the server", async () => {
    await expect(
      updateEvaluator({
        client: createTestClient(),
        evaluatorId: LLM_EVALUATOR_ID,
        patch: { type: "code" },
      })
    ).rejects.toThrow("At least one field to update must be provided");
  });
});
