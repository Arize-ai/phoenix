import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { HttpError } from "../../src/errors";
import { transferTraces } from "../../src/traces";
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

describe("transferTraces", () => {
  it("moves traces to the destination project and returns the transfer result", async () => {
    let receivedRequestBody: unknown;

    server.use(
      http.post("/v1/traces/transfer", async ({ request, response }) => {
        receivedRequestBody = await request.json();
        return response(200).json({
          data: {
            transferred_trace_count: 2,
            destination_project_id: "UHJvamVjdDoy",
          },
        });
      })
    );

    const result = await transferTraces({
      client: createTestClient(),
      traceIdentifiers: ["otel-trace-id", "VHJhY2U6Mg=="],
      destinationProjectIdentifier: "destination-project",
    });

    expect(receivedRequestBody).toEqual({
      trace_identifiers: ["otel-trace-id", "VHJhY2U6Mg=="],
      destination_project_identifier: "destination-project",
    });
    expect(result).toEqual({
      transferredTraceCount: 2,
      destinationProjectId: "UHJvamVjdDoy",
    });
  });

  it("rejects an empty trace identifier list before sending a request", async () => {
    let transferRequestCount = 0;

    server.use(
      http.post("/v1/traces/transfer", ({ response }) => {
        transferRequestCount += 1;
        return response(200).json({
          data: {
            transferred_trace_count: 0,
            destination_project_id: "UHJvamVjdDoy",
          },
        });
      })
    );

    await expect(
      transferTraces({
        client: createTestClient(),
        traceIdentifiers: [],
        destinationProjectIdentifier: "destination-project",
      })
    ).rejects.toThrow("At least one trace identifier is required");

    expect(transferRequestCount).toBe(0);
  });

  it("surfaces validation errors for traces from multiple source projects", async () => {
    server.use(
      http.post("/v1/traces/transfer", ({ response }) =>
        response(422).json({
          detail: [
            {
              type: "value_error",
              loc: ["body", "trace_identifiers"],
              msg: "Cannot transfer traces from multiple projects",
              input: ["trace-a", "trace-b"],
            },
          ],
        })
      )
    );

    const transferPromise = transferTraces({
      client: createTestClient(),
      traceIdentifiers: ["trace-a", "trace-b"],
      destinationProjectIdentifier: "destination-project",
    });

    await expect(transferPromise).rejects.toThrow(HttpError);
    await expect(transferPromise).rejects.toMatchObject({ status: 422 });
  });

  it.each([
    ["a missing trace", "One or more traces not found"],
    ["a missing destination project", "Project not found"],
  ])("surfaces not-found errors for %s", async (_caseName, detail) => {
    server.use(
      http.post("/v1/traces/transfer", ({ response }) =>
        response(404).text(detail)
      )
    );

    const transferPromise = transferTraces({
      client: createTestClient(),
      traceIdentifiers: ["trace-a"],
      destinationProjectIdentifier: "destination-project",
    });

    await expect(transferPromise).rejects.toThrow(HttpError);
    await expect(transferPromise).rejects.toMatchObject({ status: 404 });
  });

  it("throws when a successful response has no transfer data", async () => {
    server.use(
      http.post("/v1/traces/transfer", ({ response }) =>
        response.untyped(
          new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );

    await expect(
      transferTraces({
        client: createTestClient(),
        traceIdentifiers: ["trace-a"],
        destinationProjectIdentifier: "destination-project",
      })
    ).rejects.toThrow("Failed to transfer traces: no data returned");
  });
});
