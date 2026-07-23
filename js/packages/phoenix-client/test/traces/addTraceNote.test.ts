import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.unmock("../../src/utils/serverVersionUtils");

import type { PhoenixClient } from "../../src/client";
import { addTraceNote } from "../../src/traces/addTraceNote";
import { createTestClient } from "../testUtils";

const http = createHttp();

/**
 * Stub client whose POST resolves with an openapi-fetch `{ error }` result.
 *
 * The real client's middleware converts every non-2xx response into a thrown
 * HttpError before openapi-fetch can return `{ error }`, so the
 * `formatApiError` branch in addTraceNote cannot be reached through real HTTP
 * interception — it can only be exercised with a stub client.
 */
function createErrorStubClient(error: unknown): PhoenixClient {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberate partial stub of PhoenixClient; only getServerVersion and POST are exercised
  return {
    getServerVersion: async () => [14, 13, 0] as [number, number, number],
    POST: async () => ({ data: undefined, error }),
  } as unknown as PhoenixClient;
}

/**
 * Handler that reports the given Phoenix server version. The capability guard
 * in addTraceNote resolves the server version by fetching this endpoint, and
 * the endpoint returns the version string as plain text.
 */
function serverVersionHandler(version: string) {
  return http.get("/arize_phoenix_version", ({ response }) =>
    response.untyped(new Response(version, { status: 200 }))
  );
}

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

describe("addTraceNote", () => {
  it("adds a trace note", async () => {
    server.use(
      serverVersionHandler("14.13.0"),
      http.post("/v1/trace_notes", ({ response }) =>
        response(200).json({ data: { id: "test-trace-note-id-1" } })
      )
    );

    const result = await addTraceNote({
      client: createTestClient(),
      traceNote: {
        traceId: "trace123",
        note: "This is a trace note",
      },
    });

    expect(result).toEqual({ id: "test-trace-note-id-1" });
  });

  it("trims the trace ID", async () => {
    let receivedRequestBody: unknown;

    server.use(
      serverVersionHandler("14.13.0"),
      http.post("/v1/trace_notes", async ({ request, response }) => {
        receivedRequestBody = await request.json();
        return response(200).json({ data: { id: "test-trace-note-id-1" } });
      })
    );

    await addTraceNote({
      client: createTestClient(),
      traceNote: {
        traceId: "  trace123  ",
        note: "This is a trace note",
      },
    });

    expect(receivedRequestBody).toEqual({
      data: {
        trace_id: "trace123",
        note: "This is a trace note",
      },
    });
  });

  it("throws when the API returns an error", async () => {
    await expect(
      addTraceNote({
        client: createErrorStubClient("Trace not found"),
        traceNote: {
          traceId: "missing-trace",
          note: "This will fail",
        },
      })
    ).rejects.toThrow("Failed to add trace note: Trace not found");
  });

  it("formats FastAPI detail errors", async () => {
    await expect(
      addTraceNote({
        client: createErrorStubClient({ detail: "Trace not found" }),
        traceNote: {
          traceId: "missing-trace",
          note: "This will fail",
        },
      })
    ).rejects.toThrow("Failed to add trace note: Trace not found");
  });

  it("throws when no data is returned", async () => {
    server.use(
      serverVersionHandler("14.13.0"),
      http.post("/v1/trace_notes", ({ response }) =>
        response.untyped(
          new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );

    await expect(
      addTraceNote({
        client: createTestClient(),
        traceNote: {
          traceId: "trace123",
          note: "This will fail",
        },
      })
    ).rejects.toThrow("Failed to add trace note: no data returned");
  });

  it("fails fast on older Phoenix servers", async () => {
    let noteRequestCount = 0;

    server.use(
      serverVersionHandler("14.12.0"),
      http.post("/v1/trace_notes", ({ response }) => {
        noteRequestCount += 1;
        return response(200).json({ data: { id: "unreachable" } });
      })
    );

    await expect(
      addTraceNote({
        client: createTestClient(),
        traceNote: {
          traceId: "trace123",
          note: "This is a trace note",
        },
      })
    ).rejects.toThrow(/requires Phoenix server >= 14\.13\.0/);

    expect(noteRequestCount).toBe(0);
  });
});
