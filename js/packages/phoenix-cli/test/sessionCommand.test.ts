import type { componentsV1 } from "@arizeai/phoenix-testing";
import { HttpResponse } from "@arizeai/phoenix-testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSessionCommand } from "../src/commands/session";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

type SessionData = componentsV1["schemas"]["SessionData"];

const mock = setupMockPhoenixServer();

// A hex identifier is treated as a project ID directly, skipping the
// `/v1/projects/{project_identifier}` name-resolution round-trip.
const PROJECT_ID = "cafe0123";
const PROJECT_ARGS = ["--project", PROJECT_ID];

const SESSION_A: SessionData = {
  id: "U2Vzc2lvbjox",
  session_id: "chat-session-001",
  project_id: PROJECT_ID,
  start_time: "2026-07-01T00:00:00.000Z",
  end_time: "2026-07-01T00:05:00.000Z",
  traces: [
    {
      id: "VHJhY2U6MQ==",
      trace_id: "0123456789abcdef0123456789abcdef",
      start_time: "2026-07-01T00:00:00.000Z",
      end_time: "2026-07-01T00:01:00.000Z",
    },
  ],
};

const SESSION_B: SessionData = {
  id: "U2Vzc2lvbjoy",
  session_id: "chat-session-002",
  project_id: PROJECT_ID,
  start_time: "2026-07-01T01:00:00.000Z",
  end_time: "2026-07-01T01:02:00.000Z",
  traces: [],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("session list", () => {
  it("resolves a project name and propagates limit and order in raw mode", async () => {
    let capturedResolutionIdentifier: string | undefined;
    let capturedSessionsProject: string | undefined;
    let capturedQuery: URLSearchParams | undefined;
    mock.server.use(
      http.get("/v1/projects/{project_identifier}", ({ params, response }) => {
        capturedResolutionIdentifier = params.project_identifier;
        return response(200).json({
          data: { id: PROJECT_ID, name: "demo", description: null },
        });
      }),
      http.get(
        "/v1/projects/{project_identifier}/sessions",
        ({ params, request, response }) => {
          capturedSessionsProject = params.project_identifier;
          capturedQuery = new URL(request.url).searchParams;
          return response(200).json({
            data: [SESSION_A, SESSION_B],
            next_cursor: null,
          });
        }
      )
    );
    const io = captureCliOutput();

    await createSessionCommand().parseAsync(
      [
        "list",
        "--format",
        "raw",
        "--limit",
        "5",
        "--order",
        "asc",
        "--project",
        "demo",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    // The non-hex project name is resolved to an ID first, and the sessions
    // request is made against the resolved ID.
    expect(capturedResolutionIdentifier).toBe("demo");
    expect(capturedSessionsProject).toBe(PROJECT_ID);
    expect(capturedQuery?.get("limit")).toBe("5");
    expect(capturedQuery?.get("order")).toBe("asc");
    expect(capturedQuery?.get("cursor")).toBeNull();

    const output = io.stdout.mock.calls[0]?.[0];
    const sessions = JSON.parse(String(output));
    expect(sessions).toEqual([SESSION_A, SESSION_B]);
  });

  it("follows next_cursor across pages until --limit is reached", async () => {
    const capturedCursors: Array<string | null> = [];
    const capturedLimits: Array<string | null> = [];
    let page = 0;
    mock.server.use(
      http.get(
        "/v1/projects/{project_identifier}/sessions",
        ({ request, response }) => {
          const query = new URL(request.url).searchParams;
          capturedCursors.push(query.get("cursor"));
          capturedLimits.push(query.get("limit"));
          page += 1;
          if (page === 1) {
            return response(200).json({
              data: [SESSION_A],
              next_cursor: "cursor-page-2",
            });
          }
          return response(200).json({ data: [SESSION_B], next_cursor: null });
        }
      )
    );
    const io = captureCliOutput();

    await createSessionCommand().parseAsync(
      [
        "list",
        "--format",
        "raw",
        "--limit",
        "2",
        ...PROJECT_ARGS,
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(capturedCursors).toEqual([null, "cursor-page-2"]);
    // The per-page limit shrinks to the number of sessions still needed.
    expect(capturedLimits).toEqual(["2", "1"]);

    const output = io.stdout.mock.calls[0]?.[0];
    const sessions = JSON.parse(String(output));
    expect(sessions.map((s: SessionData) => s.session_id)).toEqual([
      "chat-session-001",
      "chat-session-002",
    ]);
  });

  it("completes end-to-end against the generated OpenAPI handlers", async () => {
    // No pinned handlers: every response comes from the schema-generated mocks.
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await createSessionCommand().parseAsync(
      [
        "list",
        "--format",
        "raw",
        "--limit",
        "2",
        ...PROJECT_ARGS,
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(exitSpy).not.toHaveBeenCalled();
    const output = io.stdout.mock.calls[0]?.[0];
    const sessions = JSON.parse(String(output));
    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions.length).toBeGreaterThan(0);
    expect(typeof sessions[0].session_id).toBe("string");
  });
});

describe("session get", () => {
  it("outputs the session wrapped in a `session` envelope in raw mode", async () => {
    let capturedIdentifier: string | undefined;
    mock.server.use(
      http.get("/v1/sessions/{session_identifier}", ({ params, response }) => {
        capturedIdentifier = params.session_identifier;
        return response(200).json({ data: SESSION_A });
      })
    );
    const io = captureCliOutput();

    await createSessionCommand().parseAsync(
      ["get", "chat-session-001", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    expect(capturedIdentifier).toBe("chat-session-001");
    const output = io.stdout.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(output));
    expect(parsed).toEqual({ session: SESSION_A });
  });

  it("exits FAILURE with an error on stderr when the session is not found", async () => {
    mock.server.use(
      http.get("/v1/sessions/{session_identifier}", ({ response }) =>
        response(404).text("Session not found")
      )
    );
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createSessionCommand().parseAsync(
        ["get", "missing-session", "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    expect(String(io.stderr.mock.calls[0]?.[0])).toContain(
      "Error fetching session"
    );
  });

  it("exits NETWORK_ERROR when the request fails at the network level", async () => {
    mock.server.use(
      http.get("/v1/sessions/{session_identifier}", () => HttpResponse.error())
    );
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createSessionCommand().parseAsync(
        ["get", "chat-session-001", "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
    expect(String(io.stderr.mock.calls[0]?.[0])).toContain(
      "Error fetching session"
    );
  });
});
