import type { componentsV1 } from "@arizeai/phoenix-client";
import { HttpResponse } from "@arizeai/phoenix-testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTraceCommand } from "../src/commands/trace";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";

type Span = componentsV1["schemas"]["Span"];

const mock = setupMockPhoenixServer();

const BASE_ARGS = ["--endpoint", "http://localhost:6006", "--no-progress"];

// A hex identifier is treated as a project ID directly, skipping the
// `/v1/projects/{project_identifier}` name-resolution round-trip.
const PROJECT_ID = "cafe0123";
const PROJECT_ARGS = ["--project", PROJECT_ID];

const TRACE_ID = "0123456789abcdef0123456789abcdef";

const ROOT_SPAN: Span = {
  id: "U3BhbjoxMjM=",
  name: "agent_run",
  context: { trace_id: TRACE_ID, span_id: "aaaa000000000001" },
  span_kind: "AGENT",
  parent_id: null,
  start_time: "2026-07-01T00:00:00.000Z",
  end_time: "2026-07-01T00:00:02.000Z",
  status_code: "OK",
  status_message: "",
  attributes: { "input.value": "hello", "output.value": "world" },
  events: [],
};

const CHILD_SPAN: Span = {
  id: "U3BhbjoxMjQ=",
  name: "chat_completion",
  context: { trace_id: TRACE_ID, span_id: "aaaa000000000002" },
  span_kind: "LLM",
  parent_id: "aaaa000000000001",
  start_time: "2026-07-01T00:00:00.500Z",
  end_time: "2026-07-01T00:00:01.500Z",
  status_code: "ERROR",
  status_message: "boom",
  attributes: {},
  events: [],
};

function mockProcessExit() {
  return vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`process.exit:${code}`);
  }) as never);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("trace list", () => {
  it("outputs traces built from pinned spans in raw mode and propagates request params", async () => {
    let capturedProjectIdentifier: string | undefined;
    let capturedQuery: URLSearchParams | undefined;
    mock.server.use(
      http.get(
        "/v1/projects/{project_identifier}/spans",
        ({ params, request, response }) => {
          capturedProjectIdentifier = params.project_identifier;
          capturedQuery = new URL(request.url).searchParams;
          return response(200).json({
            data: [ROOT_SPAN, CHILD_SPAN],
            next_cursor: null,
          });
        }
      )
    );
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createTraceCommand().parseAsync(
      [
        "list",
        "--format",
        "raw",
        "--limit",
        "5",
        "--since",
        "2026-07-01T00:00:00Z",
        ...PROJECT_ARGS,
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(capturedProjectIdentifier).toBe(PROJECT_ID);
    // trace list always pages spans at 1000 regardless of --limit; the
    // user-facing limit is applied to the assembled traces client-side.
    expect(capturedQuery?.get("limit")).toBe("1000");
    expect(capturedQuery?.get("start_time")).toBe("2026-07-01T00:00:00Z");
    expect(capturedQuery?.get("cursor")).toBeNull();

    const output = stdoutSpy.mock.calls[0]?.[0];
    const traces = JSON.parse(String(output));
    expect(traces).toHaveLength(1);
    expect(traces[0].traceId).toBe(TRACE_ID);
    expect(traces[0].spans).toHaveLength(2);
    expect(traces[0].rootSpan.name).toBe("agent_run");
    // A single ERROR span marks the whole trace as ERROR
    expect(traces[0].status).toBe("ERROR");
    expect(traces[0].duration).toBe(2000);
  });

  it("exits FAILURE with an error on stderr when the server returns 404", async () => {
    mock.server.use(
      http.get("/v1/projects/{project_identifier}/spans", ({ response }) =>
        response(404).text("Project not found")
      )
    );
    vi.spyOn(console, "log").mockImplementation(() => {});
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createTraceCommand().parseAsync(
        ["list", "--format", "raw", ...PROJECT_ARGS, ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    const stderrCall = stderrSpy.mock.calls[0]?.[0];
    expect(String(stderrCall)).toContain("Error fetching traces");
  });

  it("exits NETWORK_ERROR when the request fails at the network level", async () => {
    mock.server.use(
      http.get("/v1/projects/{project_identifier}/spans", () =>
        HttpResponse.error()
      )
    );
    vi.spyOn(console, "log").mockImplementation(() => {});
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createTraceCommand().parseAsync(
        ["list", "--format", "raw", ...PROJECT_ARGS, ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
    expect(String(stderrSpy.mock.calls[0]?.[0])).toContain(
      "Error fetching traces"
    );
  });

  it("completes end-to-end against the generated OpenAPI handlers", async () => {
    // No pinned handlers: every response comes from the schema-generated
    // mocks, proving the OpenAPI-derived data satisfies trace assembly.
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await createTraceCommand().parseAsync(
      [
        "list",
        "--format",
        "raw",
        "--limit",
        "1",
        ...PROJECT_ARGS,
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(exitSpy).not.toHaveBeenCalled();
    const output = stdoutSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(output));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeLessThanOrEqual(1);
    for (const trace of parsed) {
      expect(typeof trace.traceId).toBe("string");
    }
  });
});

describe("trace get", () => {
  it("outputs the assembled trace as a bare object in raw mode", async () => {
    mock.server.use(
      http.get("/v1/projects/{project_identifier}/spans", ({ response }) =>
        response(200).json({
          data: [ROOT_SPAN, CHILD_SPAN],
          next_cursor: null,
        })
      )
    );
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createTraceCommand().parseAsync(
      ["get", TRACE_ID, "--format", "raw", ...PROJECT_ARGS, ...BASE_ARGS],
      { from: "user" }
    );

    const output = stdoutSpy.mock.calls[0]?.[0];
    const trace = JSON.parse(String(output));
    expect(Array.isArray(trace)).toBe(false);
    expect(trace.traceId).toBe(TRACE_ID);
    expect(trace.spans).toHaveLength(2);
    expect(trace.spans.map((span: Span) => span.name)).toEqual([
      "agent_run",
      "chat_completion",
    ]);
  });

  it("matches traces by trace ID prefix", async () => {
    mock.server.use(
      http.get("/v1/projects/{project_identifier}/spans", ({ response }) =>
        response(200).json({
          data: [ROOT_SPAN, CHILD_SPAN],
          next_cursor: null,
        })
      )
    );
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createTraceCommand().parseAsync(
      [
        "get",
        TRACE_ID.slice(0, 8),
        "--format",
        "raw",
        ...PROJECT_ARGS,
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const trace = JSON.parse(String(stdoutSpy.mock.calls[0]?.[0]));
    expect(trace.traceId).toBe(TRACE_ID);
  });

  it("exits FAILURE with 'Trace not found' when no spans match", async () => {
    mock.server.use(
      http.get("/v1/projects/{project_identifier}/spans", ({ response }) =>
        response(200).json({ data: [], next_cursor: null })
      )
    );
    vi.spyOn(console, "log").mockImplementation(() => {});
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createTraceCommand().parseAsync(
        [
          "get",
          "ffffffffffffffff",
          "--format",
          "raw",
          ...PROJECT_ARGS,
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    expect(String(stderrSpy.mock.calls[0]?.[0])).toContain(
      "Trace not found: ffffffffffffffff"
    );
  });
});
