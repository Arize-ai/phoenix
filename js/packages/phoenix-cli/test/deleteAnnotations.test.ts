import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionAnnotationsCommand } from "../src/commands/sessionAnnotations";
import { createSpanAnnotationsCommand } from "../src/commands/spanAnnotations";
import { createTraceAnnotationsCommand } from "../src/commands/traceAnnotations";
import { ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES } from "../src/confirm";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

const PROJECT_ARGS = [...BASE_ARGS, "--project", "default"];

/** Pin project-name resolution to a stable project ID. */
function useProjectResolution() {
  mock.server.use(
    http.get("/v1/projects/{project_identifier}", ({ response }) =>
      response(200).json({
        data: { id: "project-default", name: "default" },
      })
    )
  );
}

/**
 * Register a 204 handler for the given annotation delete endpoint and record
 * how many times it matched plus the query string of the last request.
 */
function captureAnnotationDelete(
  path:
    | "/v1/projects/{project_identifier}/trace_annotations"
    | "/v1/projects/{project_identifier}/span_annotations"
    | "/v1/projects/{project_identifier}/session_annotations"
) {
  const captured: {
    count: number;
    projectIdentifier?: string;
    query?: URLSearchParams;
  } = { count: 0 };

  mock.server.use(
    http.delete(path, ({ params, request, response }) => {
      captured.count += 1;
      captured.projectIdentifier = params.project_identifier;
      captured.query = new URL(request.url).searchParams;
      return response(204).empty();
    })
  );

  return captured;
}

beforeEach(() => {
  process.env[ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES] = "true";
});

afterEach(() => {
  delete process.env[ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES];
  vi.restoreAllMocks();
});

describe("trace-annotations delete", () => {
  it("DELETEs with delete_all=true when --all is set, then emits structured success", async () => {
    useProjectResolution();
    const captured = captureAnnotationDelete(
      "/v1/projects/{project_identifier}/trace_annotations"
    );
    const io = captureCliOutput();

    await createTraceAnnotationsCommand().parseAsync(
      [
        "delete",
        "--identifier",
        "coding-session:demo",
        "--all",
        "-y",
        "--format",
        "raw",
        ...PROJECT_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.count).toBe(1);
    expect(captured.projectIdentifier).toBe("project-default");
    expect(captured.query?.get("identifier")).toBe("coding-session:demo");
    expect(captured.query?.get("delete_all")).toBe("true");

    const output = io.stdout.mock.calls[0]?.[0];
    expect(JSON.parse(String(output))).toEqual({
      deleted: true,
      target: "trace",
      filter: { identifier: "coding-session:demo", all: true },
    });
  });

  it("DELETEs with a bounded time window when --start-time/--end-time are set", async () => {
    useProjectResolution();
    const captured = captureAnnotationDelete(
      "/v1/projects/{project_identifier}/trace_annotations"
    );
    const io = captureCliOutput();

    await createTraceAnnotationsCommand().parseAsync(
      [
        "delete",
        "--start-time",
        "2026-01-01T00:00:00Z",
        "--end-time",
        "2026-01-02T00:00:00Z",
        "-y",
        "--format",
        "raw",
        ...PROJECT_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.query?.get("start_time")).toBe("2026-01-01T00:00:00Z");
    expect(captured.query?.get("end_time")).toBe("2026-01-02T00:00:00Z");
    expect(captured.query?.get("delete_all")).toBeNull();

    const output = io.stdout.mock.calls[0]?.[0];
    expect(JSON.parse(String(output))).toEqual({
      deleted: true,
      target: "trace",
      filter: {
        start_time: "2026-01-01T00:00:00Z",
        end_time: "2026-01-02T00:00:00Z",
      },
    });
  });

  it("rejects an underspecified delete before any HTTP call", async () => {
    const captured = captureAnnotationDelete(
      "/v1/projects/{project_identifier}/trace_annotations"
    );
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createTraceAnnotationsCommand().parseAsync(
        [
          "delete",
          "--identifier",
          "coding-session:demo",
          "-y",
          "--format",
          "raw",
          ...PROJECT_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.count).toBe(0);
    const stderrCall = stderrSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(stderrCall));
    expect(parsed.code).toBe("INVALID_ARGUMENT");
    expect(parsed.error).toMatch(/--all|--start-time/);
  });

  it("threads narrowing filters into the DELETE query string", async () => {
    useProjectResolution();
    const captured = captureAnnotationDelete(
      "/v1/projects/{project_identifier}/trace_annotations"
    );
    captureCliOutput();

    await createTraceAnnotationsCommand().parseAsync(
      [
        "delete",
        "--identifier",
        "coding-session:demo",
        "--name",
        "axial_coding_category",
        "--annotator-kind",
        "human",
        "--all",
        "-y",
        ...PROJECT_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.query?.get("name")).toBe("axial_coding_category");
    expect(captured.query?.get("annotator_kind")).toBe("HUMAN");
    expect(captured.query?.get("delete_all")).toBe("true");
  });
});

describe("span-annotations delete", () => {
  it("DELETEs /span_annotations with delete_all=true and emits structured success", async () => {
    useProjectResolution();
    const captured = captureAnnotationDelete(
      "/v1/projects/{project_identifier}/span_annotations"
    );
    const io = captureCliOutput();

    await createSpanAnnotationsCommand().parseAsync(
      [
        "delete",
        "--identifier",
        "coding-session:demo",
        "--all",
        "-y",
        "--format",
        "raw",
        ...PROJECT_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.count).toBe(1);
    expect(captured.projectIdentifier).toBe("project-default");
    expect(captured.query?.get("delete_all")).toBe("true");

    const output = io.stdout.mock.calls[0]?.[0];
    expect(JSON.parse(String(output))).toEqual({
      deleted: true,
      target: "span",
      filter: { identifier: "coding-session:demo", all: true },
    });
  });

  it("rejects underspecified deletes for span", async () => {
    const captured = captureAnnotationDelete(
      "/v1/projects/{project_identifier}/span_annotations"
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createSpanAnnotationsCommand().parseAsync(
        [
          "delete",
          "--identifier",
          "coding-session:demo",
          "-y",
          ...PROJECT_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.count).toBe(0);
  });
});

describe("session-annotations delete", () => {
  it("DELETEs /session_annotations with delete_all=true and emits structured success", async () => {
    useProjectResolution();
    const captured = captureAnnotationDelete(
      "/v1/projects/{project_identifier}/session_annotations"
    );
    const io = captureCliOutput();

    await createSessionAnnotationsCommand().parseAsync(
      [
        "delete",
        "--identifier",
        "coding-session:demo",
        "--all",
        "-y",
        "--format",
        "raw",
        ...PROJECT_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.count).toBe(1);
    expect(captured.projectIdentifier).toBe("project-default");
    expect(captured.query?.get("delete_all")).toBe("true");

    const output = io.stdout.mock.calls[0]?.[0];
    expect(JSON.parse(String(output))).toEqual({
      deleted: true,
      target: "session",
      filter: { identifier: "coding-session:demo", all: true },
    });
  });

  it("rejects underspecified deletes for session", async () => {
    const captured = captureAnnotationDelete(
      "/v1/projects/{project_identifier}/session_annotations"
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createSessionAnnotationsCommand().parseAsync(
        [
          "delete",
          "--identifier",
          "coding-session:demo",
          "-y",
          ...PROJECT_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.count).toBe(0);
  });

  it("disables delete commands when the dangerous-deletes env var is unset", async () => {
    delete process.env[ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES];
    const captured = captureAnnotationDelete(
      "/v1/projects/{project_identifier}/session_annotations"
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createSessionAnnotationsCommand().parseAsync(
        [
          "delete",
          "--identifier",
          "coding-session:demo",
          "--all",
          "-y",
          ...PROJECT_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(/process\.exit:/);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.count).toBe(0);
  });
});
