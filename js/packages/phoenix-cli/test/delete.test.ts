import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as ConfirmModule from "../src/confirm";

// Mock confirmOrExit to auto-confirm in all delete tests
vi.mock("../src/confirm", async (importOriginal) => {
  const originalModule = await importOriginal<typeof ConfirmModule>();
  return {
    ...originalModule,
    confirmOrExit: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock phoenix-client wrappers used by experiment and session delete
vi.mock("@arizeai/phoenix-client/experiments", () => ({
  deleteExperiment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@arizeai/phoenix-client/sessions", () => ({
  deleteSession: vi.fn().mockResolvedValue(undefined),
}));

import * as deleteExperimentModule from "@arizeai/phoenix-client/experiments";
import * as deleteSessionModule from "@arizeai/phoenix-client/sessions";

import { createAnnotationConfigCommand } from "../src/commands/annotationConfig";
import { createDatasetCommand } from "../src/commands/dataset";
import { createExperimentCommand } from "../src/commands/experiment";
import { createProjectCommand } from "../src/commands/project";
import { createPromptCommand } from "../src/commands/prompt";
import { createSessionCommand } from "../src/commands/session";
import { createSpanCommand } from "../src/commands/span";
import { createTraceCommand } from "../src/commands/trace";
import {
  confirmOrExit,
  ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES,
} from "../src/confirm";
import { ExitCode } from "../src/exitCodes";

function makeFetchMock(
  responses: Array<{ ok: boolean; status?: number; body?: unknown }>
) {
  let callIndex = 0;
  return vi.fn().mockImplementation((requestOrUrl: Request | string) => {
    const resp = responses[callIndex++] ?? responses[responses.length - 1];
    const status = resp.status ?? (resp.ok ? 200 : 500);
    const url =
      requestOrUrl instanceof Request ? requestOrUrl.url : requestOrUrl;
    return Promise.resolve({
      ok: resp.ok,
      status,
      statusText: resp.ok ? "OK" : "Error",
      url,
      headers: new Headers(),
      json: () => Promise.resolve(resp.body ?? {}),
      text: () => Promise.resolve(""),
    });
  });
}

/** Extract URL from a fetch call argument (either a Request object or a string) */
function getFetchUrl(arg: unknown): string {
  if (arg instanceof Request) return arg.url;
  return String(arg);
}

/** Extract HTTP method from a fetch call (either from Request object or RequestInit) */
function getFetchMethod(arg: unknown, init?: RequestInit): string {
  if (arg instanceof Request) return arg.method;
  return init?.method ?? "GET";
}

const BASE_ARGS = ["--endpoint", "http://localhost:6006", "--yes"];

beforeEach(() => {
  vi.stubEnv(ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES, "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("dataset delete", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("resolves dataset name to ID then calls DELETE /v1/datasets/{id}", async () => {
    // First call: GET /v1/datasets?name=my-dataset (resolveDatasetId)
    // Second call: DELETE /v1/datasets/{id}
    const fetchMock = makeFetchMock([
      {
        ok: true,
        body: { data: [{ id: "abc123", name: "my-dataset" }] },
      },
      { ok: true, body: {} },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await createDatasetCommand().parseAsync(
      ["delete", "my-dataset", ...BASE_ARGS],
      { from: "user" }
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // First call resolves name → ID
    expect(getFetchUrl(fetchMock.mock.calls[0][0])).toContain("/v1/datasets");
    // Second call is the DELETE
    expect(getFetchUrl(fetchMock.mock.calls[1][0])).toMatch(
      /\/v1\/datasets\/abc123/
    );
    expect(
      getFetchMethod(fetchMock.mock.calls[1][0], fetchMock.mock.calls[1][1])
    ).toBe("DELETE");
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("my-dataset")
    );
  });

  it("passes dataset ID directly (no name resolution) when identifier looks like an ID", async () => {
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createDatasetCommand().parseAsync(
      ["delete", "abcdef1234567890", ...BASE_ARGS],
      { from: "user" }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      getFetchMethod(fetchMock.mock.calls[0][0], fetchMock.mock.calls[0][1])
    ).toBe("DELETE");
  });

  it("exits with FAILURE on 404", async () => {
    const fetchMock = makeFetchMock([
      { ok: true, body: { data: [{ id: "abc123" }] } },
      { ok: false, status: 404, body: { status: 404 } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createDatasetCommand().parseAsync(
        ["delete", "my-dataset", ...BASE_ARGS],
        {
          from: "user",
        }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
  });

  it("uses correct confirmation message", async () => {
    vi.mocked(confirmOrExit).mockResolvedValue(undefined);
    const fetchMock = makeFetchMock([
      { ok: true, body: { data: [{ id: "abc123" }] } },
      { ok: true, body: {} },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createDatasetCommand().parseAsync(
      ["delete", "my-dataset", "--endpoint", "http://localhost:6006"],
      { from: "user" }
    );

    expect(vi.mocked(confirmOrExit)).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Delete dataset my-dataset? This cannot be undone.",
      })
    );
  });

  it("exits with INVALID_ARGUMENT when deletes are disabled", async () => {
    vi.stubEnv(ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES, "false");
    vi.mocked(confirmOrExit).mockClear();
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createDatasetCommand().parseAsync(
        ["delete", "my-dataset", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.mocked(confirmOrExit)).not.toHaveBeenCalled();
  });

  it("fails before any network call when the delete env var is invalid", async () => {
    vi.stubEnv(ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES, "yes");
    vi.mocked(confirmOrExit).mockClear();
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createDatasetCommand().parseAsync(
        ["delete", "my-dataset", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.mocked(confirmOrExit)).not.toHaveBeenCalled();
  });
});

describe("project delete", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls DELETE /v1/projects/{project_identifier}", async () => {
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createProjectCommand().parseAsync(
      ["delete", "my-project", ...BASE_ARGS],
      { from: "user" }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getFetchUrl(fetchMock.mock.calls[0][0])).toMatch(
      /\/v1\/projects\/my-project/
    );
    expect(
      getFetchMethod(fetchMock.mock.calls[0][0], fetchMock.mock.calls[0][1])
    ).toBe("DELETE");
  });

  it("uses cascade warning message mentioning traces, spans, sessions, and annotations", async () => {
    vi.mocked(confirmOrExit).mockResolvedValue(undefined);
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createProjectCommand().parseAsync(
      ["delete", "my-project", "--endpoint", "http://localhost:6006"],
      { from: "user" }
    );

    expect(vi.mocked(confirmOrExit)).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "Delete project my-project? This will also delete all traces, spans, sessions, and annotations. This cannot be undone.",
      })
    );
  });

  it("does not accept --project option", () => {
    const deleteCmd = createProjectCommand().commands.find(
      (c) => c.name() === "delete"
    );
    const optionNames = deleteCmd?.options.map((o) => o.long) ?? [];
    expect(optionNames).not.toContain("--project");
  });
});

describe("trace delete", () => {
  beforeEach(() => {
    // trace delete uses validateConfig which requires a project
    vi.stubEnv("PHOENIX_PROJECT", "default");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("calls DELETE /v1/traces/{trace_identifier}", async () => {
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createTraceCommand().parseAsync(
      ["delete", "trace-abc", ...BASE_ARGS],
      { from: "user" }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getFetchUrl(fetchMock.mock.calls[0][0])).toMatch(
      /\/v1\/traces\/trace-abc/
    );
    expect(
      getFetchMethod(fetchMock.mock.calls[0][0], fetchMock.mock.calls[0][1])
    ).toBe("DELETE");
  });

  it("uses cascade warning message mentioning spans", async () => {
    vi.mocked(confirmOrExit).mockResolvedValue(undefined);
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createTraceCommand().parseAsync(
      ["delete", "trace-abc", "--endpoint", "http://localhost:6006"],
      { from: "user" }
    );

    expect(vi.mocked(confirmOrExit)).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "Delete trace trace-abc? This will also delete all child spans. This cannot be undone.",
      })
    );
  });

  it("does not accept --project option", () => {
    const deleteCmd = createTraceCommand().commands.find(
      (c) => c.name() === "delete"
    );
    const optionNames = deleteCmd?.options.map((o) => o.long) ?? [];
    expect(optionNames).not.toContain("--project");
  });
});

describe("experiment delete", () => {
  beforeEach(() => {
    vi.mocked(deleteExperimentModule.deleteExperiment).mockResolvedValue(
      undefined
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls deleteExperiment wrapper with the experiment ID", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createExperimentCommand().parseAsync(
      ["delete", "exp-123", ...BASE_ARGS],
      { from: "user" }
    );

    expect(
      vi.mocked(deleteExperimentModule.deleteExperiment)
    ).toHaveBeenCalledWith(
      expect.objectContaining({ experimentId: "exp-123" })
    );
  });

  it("uses confirmation message without cascade warning", async () => {
    vi.mocked(confirmOrExit).mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createExperimentCommand().parseAsync(
      ["delete", "exp-123", "--endpoint", "http://localhost:6006"],
      { from: "user" }
    );

    expect(vi.mocked(confirmOrExit)).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Delete experiment exp-123? This cannot be undone.",
      })
    );
  });

  it("exits with FAILURE when deleteExperiment throws", async () => {
    vi.mocked(deleteExperimentModule.deleteExperiment).mockRejectedValue(
      new Error("Experiment not found: exp-999")
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createExperimentCommand().parseAsync(
        ["delete", "exp-999", ...BASE_ARGS],
        {
          from: "user",
        }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
  });
});

describe("session delete", () => {
  beforeEach(() => {
    vi.mocked(deleteSessionModule.deleteSession).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls deleteSession wrapper with the session ID", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createSessionCommand().parseAsync(
      ["delete", "sess-456", ...BASE_ARGS],
      { from: "user" }
    );

    expect(vi.mocked(deleteSessionModule.deleteSession)).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "sess-456" })
    );
  });

  it("uses cascade warning message mentioning traces, spans, and annotations", async () => {
    vi.mocked(confirmOrExit).mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createSessionCommand().parseAsync(
      ["delete", "sess-456", "--endpoint", "http://localhost:6006"],
      { from: "user" }
    );

    expect(vi.mocked(confirmOrExit)).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "Delete session sess-456? This will also delete all traces, spans, and annotations. This cannot be undone.",
      })
    );
  });

  it("does not accept --project option", () => {
    const deleteCmd = createSessionCommand().commands.find(
      (c) => c.name() === "delete"
    );
    const optionNames = deleteCmd?.options.map((o) => o.long) ?? [];
    expect(optionNames).not.toContain("--project");
  });
});

describe("annotation-config delete", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls DELETE /v1/annotation_configs/{config_id}", async () => {
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createAnnotationConfigCommand().parseAsync(
      ["delete", "config-789", ...BASE_ARGS],
      { from: "user" }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getFetchUrl(fetchMock.mock.calls[0][0])).toMatch(
      /\/v1\/annotation_configs\/config-789/
    );
    expect(
      getFetchMethod(fetchMock.mock.calls[0][0], fetchMock.mock.calls[0][1])
    ).toBe("DELETE");
  });

  it("uses confirmation message without cascade warning", async () => {
    vi.mocked(confirmOrExit).mockResolvedValue(undefined);
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createAnnotationConfigCommand().parseAsync(
      ["delete", "config-789", "--endpoint", "http://localhost:6006"],
      { from: "user" }
    );

    expect(vi.mocked(confirmOrExit)).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Delete annotation config config-789? This cannot be undone.",
      })
    );
  });
});

describe("prompt delete", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls DELETE /v1/prompts/{prompt_identifier}", async () => {
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createPromptCommand().parseAsync(
      ["delete", "my-prompt", ...BASE_ARGS],
      { from: "user" }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getFetchUrl(fetchMock.mock.calls[0][0])).toMatch(
      /\/v1\/prompts\/my-prompt/
    );
    expect(
      getFetchMethod(fetchMock.mock.calls[0][0], fetchMock.mock.calls[0][1])
    ).toBe("DELETE");
  });

  it("uses cascade warning message mentioning versions, tags, and labels", async () => {
    vi.mocked(confirmOrExit).mockResolvedValue(undefined);
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createPromptCommand().parseAsync(
      ["delete", "my-prompt", "--endpoint", "http://localhost:6006"],
      { from: "user" }
    );

    expect(vi.mocked(confirmOrExit)).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "Delete prompt my-prompt? This will also delete all versions, tags, and labels. This cannot be undone.",
      })
    );
  });
});

describe("span delete", () => {
  beforeEach(() => {
    // span delete uses validateConfig which requires a project
    vi.stubEnv("PHOENIX_PROJECT", "default");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("calls DELETE /v1/spans/{span_identifier}", async () => {
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createSpanCommand().parseAsync(["delete", "span-abc", ...BASE_ARGS], {
      from: "user",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getFetchUrl(fetchMock.mock.calls[0][0])).toMatch(
      /\/v1\/spans\/span-abc/
    );
    expect(
      getFetchMethod(fetchMock.mock.calls[0][0], fetchMock.mock.calls[0][1])
    ).toBe("DELETE");
  });

  it("warns that child spans are NOT deleted in confirmation message", async () => {
    vi.mocked(confirmOrExit).mockResolvedValue(undefined);
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createSpanCommand().parseAsync(
      ["delete", "span-abc", "--endpoint", "http://localhost:6006"],
      { from: "user" }
    );

    expect(vi.mocked(confirmOrExit)).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "Delete span span-abc? Child spans will NOT be deleted. This cannot be undone.",
      })
    );
  });

  it("does not accept --project option", () => {
    const deleteCmd = createSpanCommand().commands.find(
      (c) => c.name() === "delete"
    );
    const optionNames = deleteCmd?.options.map((o) => o.long) ?? [];
    expect(optionNames).not.toContain("--project");
  });

  it("writes success message to stderr", async () => {
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await createSpanCommand().parseAsync(["delete", "span-abc", ...BASE_ARGS], {
      from: "user",
    });

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("span-abc"));
  });
});
