import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getEvaluator } from "../../src/evaluators";
import { createTestClient } from "../testUtils";
import { codeDefinition, CODE_EVALUATOR_ID } from "./evaluatorsTestUtils";

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

describe("getEvaluator", () => {
  it("GETs the definition by id", async () => {
    let receivedId: string | undefined;
    server.use(
      http.get("/v1/evaluators/{evaluator_id}", ({ params, response }) => {
        receivedId = params.evaluator_id;
        return response(200).json({ data: codeDefinition });
      })
    );

    const evaluator = await getEvaluator({
      client: createTestClient(),
      evaluatorId: CODE_EVALUATOR_ID,
    });

    expect(receivedId).toBe(CODE_EVALUATOR_ID);
    expect(evaluator).toEqual(codeDefinition);
  });

  it("rejects when the evaluator does not exist", async () => {
    server.use(
      http.get("/v1/evaluators/{evaluator_id}", ({ response }) =>
        response(404).text("Evaluator not found")
      )
    );

    await expect(
      getEvaluator({ client: createTestClient(), evaluatorId: "missing" })
    ).rejects.toThrow();
  });
});
