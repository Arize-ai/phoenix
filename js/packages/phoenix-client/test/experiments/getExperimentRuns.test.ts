import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { components } from "../../src/__generated__/api/v1";
import { getExperimentRuns } from "../../src/experiments";
import { createTestClient } from "../testUtils";

const http = createHttp();

const mockExperimentRuns: components["schemas"]["ListExperimentRunsResponseBody"]["data"] =
  [
    {
      id: "id",
      experiment_id: "exp_id",
      dataset_example_id: "example_id",
      output: { response: "res" },
      repetition_number: 1,
      start_time: "2025-09-20T02:54:17.638Z",
      end_time: "2025-09-20T02:54:17.638Z",
    },
  ];

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

describe("getExperimentRuns", () => {
  it("should not paginate if the API doesn't provide a next cursor", async () => {
    let requestCount = 0;
    let receivedExperimentId: string | undefined;
    let receivedCursor: string | null = null;
    let receivedLimit: string | null = null;

    server.use(
      http.get(
        "/v1/experiments/{experiment_id}/runs",
        ({ params, request, response }) => {
          requestCount += 1;
          receivedExperimentId = params.experiment_id;
          const searchParams = new URL(request.url).searchParams;
          receivedCursor = searchParams.get("cursor");
          receivedLimit = searchParams.get("limit");
          // Older versions of Phoenix respond without a next_cursor field.
          return response.untyped(
            new Response(JSON.stringify({ data: mockExperimentRuns }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
      )
    );

    await getExperimentRuns({
      client: createTestClient(),
      experimentId: "fake",
    });

    expect(requestCount).toBe(1);
    expect(receivedExperimentId).toBe("fake");
    expect(receivedCursor).toBeNull();
    expect(receivedLimit).toBe("100");
  });

  it("should paginate through records and fetch all", async () => {
    const nextCursors: (string | null)[] = ["c1", "c2", null];
    let requestCount = 0;

    server.use(
      http.get("/v1/experiments/{experiment_id}/runs", ({ response }) => {
        const nextCursor = nextCursors[requestCount] ?? null;
        requestCount += 1;
        return response(200).json({
          data: mockExperimentRuns,
          next_cursor: nextCursor,
        });
      })
    );

    const { runs } = await getExperimentRuns({
      client: createTestClient(),
      experimentId: "fake",
    });

    expect(requestCount).toBe(3);
    expect(runs.length).toEqual(3);
  });
});
