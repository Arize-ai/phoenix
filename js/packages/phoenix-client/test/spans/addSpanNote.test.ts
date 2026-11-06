import { createHttp } from "@arizeai/phoenix-testing";
import { createMockServer, type Server } from "@arizeai/phoenix-testing/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { HttpError } from "../../src/errors";
import { addSpanNote } from "../../src/spans/addSpanNote";
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

describe("addSpanNote", () => {
  it("should add a span note", async () => {
    server.use(
      http.post("/v1/span_notes", ({ response }) =>
        response(200).json({ data: { id: "test-note-id-1" } })
      )
    );

    const result = await addSpanNote({
      client: createTestClient(),
      spanNote: {
        spanId: "123abc",
        note: "This is a test note",
      },
    });

    expect(result).toEqual({ id: "test-note-id-1" });
  });

  it("should trim span ID", async () => {
    let receivedRequestBody: unknown;

    server.use(
      http.post("/v1/span_notes", async ({ request, response }) => {
        receivedRequestBody = await request.json();
        return response(200).json({ data: { id: "test-note-id-1" } });
      })
    );

    await addSpanNote({
      client: createTestClient(),
      spanNote: {
        spanId: "  123abc  ",
        note: "This is a test note",
      },
    });

    expect(receivedRequestBody).toEqual({
      data: {
        span_id: "123abc",
        note: "This is a test note",
      },
    });
  });

  it("should throw error when API returns error", async () => {
    // The client middleware surfaces non-2xx responses as HttpError.
    server.use(
      http.post("/v1/span_notes", ({ response }) =>
        response(404).text("Span not found")
      )
    );

    const notePromise = addSpanNote({
      client: createTestClient(),
      spanNote: {
        spanId: "nonexistent",
        note: "This will fail",
      },
    });

    await expect(notePromise).rejects.toThrow(HttpError);
    await expect(notePromise).rejects.toMatchObject({ status: 404 });
  });

  it("should reject on FastAPI detail errors", async () => {
    // The client middleware throws HttpError before the response body's
    // FastAPI `detail` payload is ever parsed.
    server.use(
      http.post("/v1/span_notes", ({ response }) =>
        response.untyped(
          new Response(JSON.stringify({ detail: "Span not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );

    const notePromise = addSpanNote({
      client: createTestClient(),
      spanNote: {
        spanId: "nonexistent",
        note: "This will fail",
      },
    });

    await expect(notePromise).rejects.toThrow(HttpError);
    await expect(notePromise).rejects.toMatchObject({ status: 404 });
  });

  it("should throw error when no data is returned", async () => {
    server.use(
      http.post("/v1/span_notes", ({ response }) =>
        // An empty success response leaves the client with no data to return.
        response.untyped(new Response(null, { status: 204 }))
      )
    );

    await expect(
      addSpanNote({
        client: createTestClient(),
        spanNote: {
          spanId: "123abc",
          note: "This will fail",
        },
      })
    ).rejects.toThrow("Failed to add span note: no data returned");
  });
});
