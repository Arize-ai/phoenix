import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionAnnotationsCommand } from "../src/commands/sessionAnnotations";
import { createSpanAnnotationsCommand } from "../src/commands/spanAnnotations";
import { createTraceAnnotationsCommand } from "../src/commands/traceAnnotations";
import { ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES } from "../src/confirm";
import { ExitCode } from "../src/exitCodes";

function makeFetchMock(
  responses: Array<
    | { ok: boolean; status?: number; body?: unknown; text?: string }
    | { error: Error }
  >
) {
  let callIndex = 0;
  return vi.fn().mockImplementation((requestOrUrl: Request | string) => {
    const response = responses[callIndex++] ?? responses[responses.length - 1];
    if ("error" in response) {
      return Promise.reject(response.error);
    }
    const status = response.status ?? (response.ok ? 200 : 500);
    const url =
      requestOrUrl instanceof Request ? requestOrUrl.url : requestOrUrl;
    const body = response.body ?? {};
    const text = response.text ?? JSON.stringify(body);
    return Promise.resolve({
      ok: response.ok,
      status,
      statusText: response.ok ? "OK" : "Error",
      url,
      headers: new Headers(),
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(text),
    });
  });
}

function getFetchUrl(arg: unknown): string {
  if (arg instanceof Request) return arg.url;
  return String(arg);
}

function getFetchMethod(arg: unknown, init?: RequestInit): string {
  if (arg instanceof Request) return arg.method;
  return init?.method ?? "GET";
}

const BASE_ARGS = [
  "--endpoint",
  "http://localhost:6006",
  "--project",
  "default",
  "--no-progress",
];

const PROJECT_RESPONSE = {
  ok: true as const,
  body: { data: { id: "project-default" } },
};

const DELETE_204 = {
  ok: true as const,
  status: 204,
  body: {},
} satisfies { ok: true; status: 204; body: object };

beforeEach(() => {
  process.env[ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES] = "true";
});

afterEach(() => {
  delete process.env[ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("trace-annotations delete", () => {
  it("DELETEs with delete_all=true when --all is set, then emits structured success", async () => {
    const fetchMock = makeFetchMock([PROJECT_RESPONSE, DELETE_204]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createTraceAnnotationsCommand().parseAsync(
      [
        "delete",
        "--identifier",
        "coding-session:demo",
        "--all",
        "-y",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getFetchMethod(fetchMock.mock.calls[1][0])).toBe("DELETE");
    const url = new URL(getFetchUrl(fetchMock.mock.calls[1][0]));
    expect(url.pathname).toBe("/v1/projects/project-default/trace_annotations");
    expect(url.searchParams.get("identifier")).toBe("coding-session:demo");
    expect(url.searchParams.get("delete_all")).toBe("true");

    const output = stdoutSpy.mock.calls[0]?.[0];
    expect(JSON.parse(String(output))).toEqual({
      deleted: true,
      target: "trace",
      filter: { identifier: "coding-session:demo", all: true },
    });
  });

  it("DELETEs with a bounded time window when --start-time/--end-time are set", async () => {
    const fetchMock = makeFetchMock([PROJECT_RESPONSE, DELETE_204]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

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
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const url = new URL(getFetchUrl(fetchMock.mock.calls[1][0]));
    expect(url.searchParams.get("start_time")).toBe("2026-01-01T00:00:00Z");
    expect(url.searchParams.get("end_time")).toBe("2026-01-02T00:00:00Z");
    expect(url.searchParams.get("delete_all")).toBeNull();

    const output = stdoutSpy.mock.calls[0]?.[0];
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
    const fetchMock = makeFetchMock([PROJECT_RESPONSE]);
    vi.stubGlobal("fetch", fetchMock);
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createTraceAnnotationsCommand().parseAsync(
        [
          "delete",
          "--identifier",
          "coding-session:demo",
          "-y",
          "--format",
          "raw",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
    const stderrCall = stderrSpy.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(stderrCall));
    expect(parsed.code).toBe("INVALID_ARGUMENT");
    expect(parsed.error).toMatch(/--all|--start-time/);
  });

  it("threads narrowing filters into the DELETE query string", async () => {
    const fetchMock = makeFetchMock([PROJECT_RESPONSE, DELETE_204]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

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
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const url = new URL(getFetchUrl(fetchMock.mock.calls[1][0]));
    expect(url.searchParams.get("name")).toBe("axial_coding_category");
    expect(url.searchParams.get("annotator_kind")).toBe("HUMAN");
    expect(url.searchParams.get("delete_all")).toBe("true");
  });
});

describe("span-annotations delete", () => {
  it("DELETEs /span_annotations with delete_all=true and emits structured success", async () => {
    const fetchMock = makeFetchMock([PROJECT_RESPONSE, DELETE_204]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createSpanAnnotationsCommand().parseAsync(
      [
        "delete",
        "--identifier",
        "coding-session:demo",
        "--all",
        "-y",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const url = new URL(getFetchUrl(fetchMock.mock.calls[1][0]));
    expect(url.pathname).toBe("/v1/projects/project-default/span_annotations");
    expect(url.searchParams.get("delete_all")).toBe("true");

    const output = stdoutSpy.mock.calls[0]?.[0];
    expect(JSON.parse(String(output))).toEqual({
      deleted: true,
      target: "span",
      filter: { identifier: "coding-session:demo", all: true },
    });
  });

  it("rejects underspecified deletes for span", async () => {
    const fetchMock = makeFetchMock([PROJECT_RESPONSE]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createSpanAnnotationsCommand().parseAsync(
        ["delete", "--identifier", "coding-session:demo", "-y", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("session-annotations delete", () => {
  it("DELETEs /session_annotations with delete_all=true and emits structured success", async () => {
    const fetchMock = makeFetchMock([PROJECT_RESPONSE, DELETE_204]);
    vi.stubGlobal("fetch", fetchMock);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createSessionAnnotationsCommand().parseAsync(
      [
        "delete",
        "--identifier",
        "coding-session:demo",
        "--all",
        "-y",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const url = new URL(getFetchUrl(fetchMock.mock.calls[1][0]));
    expect(url.pathname).toBe(
      "/v1/projects/project-default/session_annotations"
    );
    expect(url.searchParams.get("delete_all")).toBe("true");

    const output = stdoutSpy.mock.calls[0]?.[0];
    expect(JSON.parse(String(output))).toEqual({
      deleted: true,
      target: "session",
      filter: { identifier: "coding-session:demo", all: true },
    });
  });

  it("rejects underspecified deletes for session", async () => {
    const fetchMock = makeFetchMock([PROJECT_RESPONSE]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createSessionAnnotationsCommand().parseAsync(
        ["delete", "--identifier", "coding-session:demo", "-y", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("disables delete commands when the dangerous-deletes env var is unset", async () => {
    delete process.env[ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES];
    const fetchMock = makeFetchMock([PROJECT_RESPONSE]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createSessionAnnotationsCommand().parseAsync(
        [
          "delete",
          "--identifier",
          "coding-session:demo",
          "--all",
          "-y",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(/process\.exit:/);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
