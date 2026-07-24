import type { componentsV1 } from "@arizeai/phoenix-testing";
import { HttpResponse } from "@arizeai/phoenix-testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSpanCommand } from "../src/commands/span";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

type Span = componentsV1["schemas"]["Span"];

const mock = setupMockPhoenixServer();

// A hex identifier is treated as a project ID directly, skipping the
// `/v1/projects/{project_identifier}` name-resolution round-trip.
const PROJECT_ID = "cafe0123";
const PROJECT_ARGS = ["--project", PROJECT_ID];

const TRACE_ID = "0123456789abcdef0123456789abcdef";

const LLM_SPAN: Span = {
  id: "U3BhbjoxMjM=",
  name: "chat_completion",
  context: { trace_id: TRACE_ID, span_id: "aaaa000000000001" },
  span_kind: "LLM",
  parent_id: null,
  start_time: "2026-07-01T00:00:00.000Z",
  end_time: "2026-07-01T00:00:01.000Z",
  status_code: "ERROR",
  status_message: "rate limited",
  attributes: { "llm.model_name": "gpt-4" },
  events: [],
};

const TOOL_SPAN: Span = {
  id: "U3BhbjoxMjQ=",
  name: "search_tool",
  context: { trace_id: TRACE_ID, span_id: "aaaa000000000002" },
  span_kind: "TOOL",
  parent_id: "aaaa000000000001",
  start_time: "2026-07-01T00:00:00.100Z",
  end_time: "2026-07-01T00:00:00.400Z",
  status_code: "OK",
  status_message: "",
  attributes: {},
  events: [],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("span list", () => {
  it("outputs pinned spans in raw mode and propagates path, limit, and filter params", async () => {
    let capturedProjectIdentifier: string | undefined;
    let capturedQuery: URLSearchParams | undefined;
    mock.server.use(
      http.get(
        "/v1/projects/{project_identifier}/spans",
        ({ params, request, response }) => {
          capturedProjectIdentifier = params.project_identifier;
          capturedQuery = new URL(request.url).searchParams;
          return response(200).json({
            data: [LLM_SPAN, TOOL_SPAN],
            next_cursor: null,
          });
        }
      )
    );
    const io = captureCliOutput();

    await createSpanCommand().parseAsync(
      [
        "list",
        "--format",
        "raw",
        "--limit",
        "50",
        "--status-code",
        "ERROR",
        "--trace-id",
        TRACE_ID,
        "--span-id",
        "aaaa000000000001",
        "--parent-id",
        "null",
        ...PROJECT_ARGS,
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(capturedProjectIdentifier).toBe(PROJECT_ID);
    // span list pages at min(limit, 1000), so --limit 50 is sent verbatim
    expect(capturedQuery?.get("limit")).toBe("50");
    expect(capturedQuery?.getAll("status_code")).toEqual(["ERROR"]);
    expect(capturedQuery?.getAll("trace_id")).toEqual([TRACE_ID]);
    expect(capturedQuery?.getAll("span_id")).toEqual(["aaaa000000000001"]);
    expect(capturedQuery?.get("parent_id")).toBe("null");

    const output = io.stdout.mock.calls[0]?.[0];
    const spans = JSON.parse(String(output));
    expect(spans).toHaveLength(2);
    expect(spans[0].name).toBe("chat_completion");
    expect(spans[0].status_code).toBe("ERROR");
    expect(spans[0].attributes["llm.model_name"]).toBe("gpt-4");
    expect(spans[1].context.span_id).toBe("aaaa000000000002");
  });

  it("follows the pagination cursor and truncates client-side to --limit", async () => {
    const capturedCursors: (string | null)[] = [];
    let page = 0;
    mock.server.use(
      http.get(
        "/v1/projects/{project_identifier}/spans",
        ({ request, response }) => {
          capturedCursors.push(new URL(request.url).searchParams.get("cursor"));
          page += 1;
          if (page === 1) {
            return response(200).json({
              data: [LLM_SPAN],
              next_cursor: "cursor-page-2",
            });
          }
          return response(200).json({
            data: [TOOL_SPAN, { ...TOOL_SPAN, name: "extra_span" }],
            next_cursor: null,
          });
        }
      )
    );
    const io = captureCliOutput();

    await createSpanCommand().parseAsync(
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
    const spans = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    // 3 spans came back across pages; --limit 2 truncates client-side
    expect(spans).toHaveLength(2);
    expect(spans.map((span: Span) => span.name)).toEqual([
      "chat_completion",
      "search_tool",
    ]);
  });

  it("exits FAILURE with an error on stderr when the server returns 404", async () => {
    mock.server.use(
      http.get("/v1/projects/{project_identifier}/spans", ({ response }) =>
        response(404).text("Project not found")
      )
    );
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createSpanCommand().parseAsync(
        ["list", "--format", "raw", ...PROJECT_ARGS, ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    expect(String(io.stderr.mock.calls[0]?.[0])).toContain(
      "Error fetching spans"
    );
  });

  it("exits NETWORK_ERROR when the request fails at the network level", async () => {
    mock.server.use(
      http.get("/v1/projects/{project_identifier}/spans", () =>
        HttpResponse.error()
      )
    );
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createSpanCommand().parseAsync(
        ["list", "--format", "raw", ...PROJECT_ARGS, ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
    expect(String(io.stderr.mock.calls[0]?.[0])).toContain(
      "Error fetching spans"
    );
  });

  it("completes end-to-end against the generated OpenAPI handlers", async () => {
    // No pinned handlers: every response comes from the schema-generated mocks.
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await createSpanCommand().parseAsync(
      [
        "list",
        "--format",
        "raw",
        "--limit",
        "3",
        ...PROJECT_ARGS,
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(exitSpy).not.toHaveBeenCalled();
    const output = io.stdout.mock.calls[0]?.[0];
    const spans = JSON.parse(String(output));
    expect(Array.isArray(spans)).toBe(true);
    expect(spans.length).toBeGreaterThan(0);
    // --limit is honored even for generated pages (client-side truncation)
    expect(spans.length).toBeLessThanOrEqual(3);
    for (const span of spans) {
      expect(Array.isArray(span)).toBe(false);
      expect(typeof span.context.trace_id).toBe("string");
      expect(typeof span.context.span_id).toBe("string");
    }
  });
});
