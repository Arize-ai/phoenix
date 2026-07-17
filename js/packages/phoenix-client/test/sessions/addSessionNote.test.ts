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
import { addSessionNote } from "../../src/sessions/addSessionNote";
import { createTestClient } from "../testUtils";

const http = createHttp();

/**
 * Stub client whose POST resolves with an openapi-fetch `{ error }` result.
 *
 * The real client's middleware converts every non-2xx response into a thrown
 * HttpError before openapi-fetch can return `{ error }`, so the
 * `formatApiError` branch in addSessionNote cannot be reached through real
 * HTTP interception — it can only be exercised with a stub client.
 */
function createErrorStubClient(error: unknown): PhoenixClient {
  return {
    getServerVersion: async () => [14, 17, 0] as [number, number, number],
    POST: async () => ({ data: undefined, error }),
  } as unknown as PhoenixClient;
}

/**
 * Handler that reports the given Phoenix server version. The capability guard
 * in addSessionNote resolves the server version by fetching this endpoint, and
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

describe("addSessionNote", () => {
  it("adds a session note", async () => {
    server.use(
      serverVersionHandler("14.17.0"),
      http.post("/v1/session_notes", ({ response }) =>
        response(200).json({ data: { id: "test-session-note-id-1" } })
      )
    );

    const result = await addSessionNote({
      client: createTestClient(),
      sessionNote: {
        sessionId: "session-123",
        note: "This is a session note",
      },
    });

    expect(result).toEqual({ id: "test-session-note-id-1" });
  });

  it("trims the session ID", async () => {
    let receivedRequestBody: unknown;

    server.use(
      serverVersionHandler("14.17.0"),
      http.post("/v1/session_notes", async ({ request, response }) => {
        receivedRequestBody = await request.json();
        return response(200).json({ data: { id: "test-session-note-id-1" } });
      })
    );

    await addSessionNote({
      client: createTestClient(),
      sessionNote: {
        sessionId: "  session-123  ",
        note: "This is a session note",
      },
    });

    expect(receivedRequestBody).toEqual({
      data: {
        session_id: "session-123",
        note: "This is a session note",
      },
    });
  });

  it("throws when the API returns an error", async () => {
    await expect(
      addSessionNote({
        client: createErrorStubClient("Session not found"),
        sessionNote: {
          sessionId: "missing-session",
          note: "This will fail",
        },
      })
    ).rejects.toThrow("Failed to add session note: Session not found");
  });

  it("formats FastAPI detail errors", async () => {
    await expect(
      addSessionNote({
        client: createErrorStubClient({ detail: "Session not found" }),
        sessionNote: {
          sessionId: "missing-session",
          note: "This will fail",
        },
      })
    ).rejects.toThrow("Failed to add session note: Session not found");
  });

  it("throws when no data is returned", async () => {
    server.use(
      serverVersionHandler("14.17.0"),
      http.post("/v1/session_notes", ({ response }) =>
        response.untyped(
          new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );

    await expect(
      addSessionNote({
        client: createTestClient(),
        sessionNote: {
          sessionId: "session-123",
          note: "This will fail",
        },
      })
    ).rejects.toThrow("Failed to add session note: no data returned");
  });

  it("fails fast on older Phoenix servers", async () => {
    let noteRequestCount = 0;

    server.use(
      serverVersionHandler("14.16.0"),
      http.post("/v1/session_notes", ({ response }) => {
        noteRequestCount += 1;
        return response(200).json({ data: { id: "unreachable" } });
      })
    );

    await expect(
      addSessionNote({
        client: createTestClient(),
        sessionNote: {
          sessionId: "session-123",
          note: "This is a session note",
        },
      })
    ).rejects.toThrow(/requires Phoenix server >= 14\.17\.0/);

    expect(noteRequestCount).toBe(0);
  });
});
