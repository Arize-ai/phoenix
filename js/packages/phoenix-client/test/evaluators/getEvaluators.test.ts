import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getEvaluators } from "../../src/evaluators";
import { createTestClient } from "../testUtils";
import { codeDefinition, llmDefinition } from "./evaluatorsTestUtils";

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

describe("getEvaluators", () => {
  it("follows pagination and forwards the filters", async () => {
    const queries: string[] = [];
    server.use(
      http.get("/v1/evaluators", ({ request, response }) => {
        const url = new URL(request.url);
        queries.push(url.search);
        if (url.searchParams.get("cursor")) {
          return response(200).json({
            data: [llmDefinition],
            next_cursor: null,
          });
        }
        return response(200).json({
          data: [codeDefinition],
          next_cursor: "next",
        });
      })
    );

    const evaluators = await getEvaluators({
      client: createTestClient(),
      type: "code",
      name: "exact-match",
    });

    expect(evaluators).toEqual([codeDefinition, llmDefinition]);
    expect(queries).toEqual([
      "?type=code&name=exact-match&limit=100",
      "?type=code&name=exact-match&cursor=next&limit=100",
    ]);
  });

  it("stops at the limit and asks for no more than it needs", async () => {
    let calls = 0;
    server.use(
      http.get("/v1/evaluators", ({ request, response }) => {
        calls += 1;
        expect(new URL(request.url).searchParams.get("limit")).toBe("1");
        return response(200).json({
          data: [codeDefinition],
          next_cursor: "next",
        });
      })
    );

    const evaluators = await getEvaluators({
      client: createTestClient(),
      limit: 1,
    });

    expect(evaluators).toEqual([codeDefinition]);
    expect(calls).toBe(1);
  });

  it("omits the filters by default", async () => {
    let search: string | undefined;
    server.use(
      http.get("/v1/evaluators", ({ request, response }) => {
        search = new URL(request.url).search;
        return response(200).json({ data: [], next_cursor: null });
      })
    );

    await expect(
      getEvaluators({ client: createTestClient() })
    ).resolves.toEqual([]);
    expect(search).toBe("?limit=100");
  });
});
