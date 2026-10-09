import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getCodeEvaluatorVersions } from "../../src/evaluators";
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

describe("getCodeEvaluatorVersions", () => {
  it("follows pagination, newest first", async () => {
    const newest = { ...codeVersion, id: "Q29kZUV2YWx1YXRvclZlcnNpb246Mg==" };
    let receivedId: string | undefined;
    server.use(
      http.get(
        "/v1/evaluators/{evaluator_id}/versions",
        ({ params, request, response }) => {
          receivedId = params.evaluator_id;
          if (new URL(request.url).searchParams.get("cursor")) {
            return response(200).json({
              data: [codeVersion],
              next_cursor: null,
            });
          }
          return response(200).json({ data: [newest], next_cursor: "next" });
        }
      )
    );

    const versions = await getCodeEvaluatorVersions({
      client: createTestClient(),
      evaluatorId: CODE_EVALUATOR_ID,
    });

    expect(receivedId).toBe(CODE_EVALUATOR_ID);
    expect(versions).toEqual([newest, codeVersion]);
  });

  it("stops at the limit", async () => {
    let calls = 0;
    server.use(
      http.get(
        "/v1/evaluators/{evaluator_id}/versions",
        ({ request, response }) => {
          calls += 1;
          expect(new URL(request.url).searchParams.get("limit")).toBe("1");
          return response(200).json({
            data: [codeVersion],
            next_cursor: "next",
          });
        }
      )
    );

    const versions = await getCodeEvaluatorVersions({
      client: createTestClient(),
      evaluatorId: CODE_EVALUATOR_ID,
      limit: 1,
    });

    expect(versions).toEqual([codeVersion]);
    expect(calls).toBe(1);
  });

  it("rejects for a non-code evaluator", async () => {
    server.use(
      http.get("/v1/evaluators/{evaluator_id}/versions", ({ response }) =>
        response(422).text("Only code evaluators have versions")
      )
    );

    await expect(
      getCodeEvaluatorVersions({
        client: createTestClient(),
        evaluatorId: CODE_EVALUATOR_ID,
      })
    ).rejects.toThrow();
  });
});
