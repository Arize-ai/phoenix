import { createPhoenixHttp } from "@arizeai/phoenix-testing";
import { createPhoenixMockServer } from "@arizeai/phoenix-testing/node";
import type { SetupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createClient } from "../../src";
import { logSpans, type Span } from "../../src/spans/logSpans";

const BASE_URL = "http://localhost:6006";
const http = createPhoenixHttp();

function createTestClient() {
  return createClient({
    getEnvironmentOptions: () => ({}),
    options: { baseUrl: BASE_URL },
  });
}

let server: SetupServer;

beforeAll(async () => {
  server = await createPhoenixMockServer();
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe("logSpans integration", () => {
  it("sends spans to the resolved project and returns queue statistics", async () => {
    const span: Span = {
      name: "test-span",
      context: {
        trace_id: "0123456789abcdef0123456789abcdef",
        span_id: "0123456789abcdef",
      },
      span_kind: "CHAIN",
      start_time: "2024-01-01T00:00:00Z",
      end_time: "2024-01-01T00:00:01Z",
      status_code: "OK",
      attributes: { "input.value": "hello" },
    };
    let receivedProjectIdentifier: string | undefined;
    let receivedRequestBody: { data: Span[] } | undefined;

    server.use(
      http.post(
        "/v1/projects/{project_identifier}/spans",
        async ({ params, request, response }) => {
          receivedProjectIdentifier = params.project_identifier;
          receivedRequestBody = await request.json();
          return response(200).json({
            total_received: receivedRequestBody.data.length,
            total_queued: receivedRequestBody.data.length,
          });
        }
      )
    );

    const result = await logSpans({
      client: createTestClient(),
      project: { projectName: "integration-test-project" },
      spans: [span],
    });

    expect(result).toEqual({ totalReceived: 1, totalQueued: 1 });
    expect(receivedProjectIdentifier).toBe("integration-test-project");
    expect(receivedRequestBody).toEqual({ data: [span] });
  });
});
