import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { componentsV1 } from "@arizeai/phoenix-testing";
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
import { http, setupMockPhoenixServer } from "./mockServer";
import { mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

// Deliberately NOT composed from the shared BASE_ARGS: these tests assert on
// the "Deleted ..." progress messages, which --no-progress would suppress.
const BASE_ARGS = ["--endpoint", "http://localhost:6006", "--yes"];

const datasetFixture: componentsV1["schemas"]["Dataset"] = {
  id: "abc123",
  name: "my-dataset",
  description: null,
  metadata: {},
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  example_count: 0,
};

/** Pin GET /v1/datasets so name resolution finds the fixture dataset. */
function usePinnedDatasetList() {
  mock.server.use(
    http.get("/v1/datasets", ({ response }) =>
      response(200).json({ data: [datasetFixture], next_cursor: null })
    )
  );
}

/**
 * Register a DELETE /v1/datasets/{id} handler that records the deleted id and
 * how many times it was called.
 */
function captureDatasetDelete() {
  const captured: { id?: string; calls: number } = { calls: 0 };
  mock.server.use(
    http.delete("/v1/datasets/{id}", ({ params, response }) => {
      captured.calls += 1;
      captured.id = params.id;
      return response(204).empty();
    })
  );
  return captured;
}

/**
 * Register a GET /v1/datasets handler that counts calls, for asserting that
 * no name-resolution request was made.
 */
function countDatasetListCalls() {
  const counter = { calls: 0 };
  mock.server.use(
    http.get("/v1/datasets", ({ response }) => {
      counter.calls += 1;
      return response(200).json({ data: [datasetFixture], next_cursor: null });
    })
  );
  return counter;
}

beforeEach(() => {
  vi.stubEnv(ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES, "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/**
 * Point XDG_CONFIG_HOME at a clean temp dir for each test so the CLI's
 * settings file resolution lands on an empty directory — keeping tests
 * unaffected by a developer's real `~/.px/settings.json`.
 */
function useIsolatedProfilesDir() {
  let tmpDir: string;
  let originalXdg: string | undefined;
  beforeEach(() => {
    originalXdg = process.env.XDG_CONFIG_HOME;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-delete-test-"));
    process.env.XDG_CONFIG_HOME = tmpDir;
  });
  afterEach(() => {
    if (originalXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdg;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
}

describe("dataset delete", () => {
  useIsolatedProfilesDir();
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves dataset name to ID then calls DELETE /v1/datasets/{id}", async () => {
    // First request: GET /v1/datasets?name=my-dataset (resolveDatasetId)
    // Second request: DELETE /v1/datasets/{id}
    const listCounter = countDatasetListCalls();
    const deleted = captureDatasetDelete();
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await createDatasetCommand().parseAsync(
      ["delete", "my-dataset", ...BASE_ARGS],
      { from: "user" }
    );

    // First call resolves name → ID
    expect(listCounter.calls).toBe(1);
    // Second call is the DELETE
    expect(deleted.calls).toBe(1);
    expect(deleted.id).toBe("abc123");
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("my-dataset")
    );
  });

  it("passes dataset ID directly (no name resolution) when identifier looks like an ID", async () => {
    const listCounter = countDatasetListCalls();
    const deleted = captureDatasetDelete();
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createDatasetCommand().parseAsync(
      ["delete", "abcdef1234567890", ...BASE_ARGS],
      { from: "user" }
    );

    expect(listCounter.calls).toBe(0);
    expect(deleted.calls).toBe(1);
    expect(deleted.id).toBe("abcdef1234567890");
  });

  it("exits with FAILURE on 404", async () => {
    usePinnedDatasetList();
    mock.server.use(
      http.delete("/v1/datasets/{id}", ({ response }) =>
        response(404).text("Dataset not found")
      )
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

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
    usePinnedDatasetList();
    captureDatasetDelete();
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
    const listCounter = countDatasetListCalls();
    const deleted = captureDatasetDelete();
    const exitSpy = mockProcessExit();

    await expect(
      createDatasetCommand().parseAsync(
        ["delete", "my-dataset", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(listCounter.calls).toBe(0);
    expect(deleted.calls).toBe(0);
    expect(vi.mocked(confirmOrExit)).not.toHaveBeenCalled();
  });

  it("fails before any network call when the delete env var is invalid", async () => {
    vi.stubEnv(ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES, "yes");
    vi.mocked(confirmOrExit).mockClear();
    const listCounter = countDatasetListCalls();
    const deleted = captureDatasetDelete();
    const exitSpy = mockProcessExit();

    await expect(
      createDatasetCommand().parseAsync(
        ["delete", "my-dataset", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(listCounter.calls).toBe(0);
    expect(deleted.calls).toBe(0);
    expect(vi.mocked(confirmOrExit)).not.toHaveBeenCalled();
  });
});

describe("project delete", () => {
  useIsolatedProfilesDir();
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls DELETE /v1/projects/{project_identifier}", async () => {
    const captured: { projectIdentifier?: string; calls: number } = {
      calls: 0,
    };
    mock.server.use(
      http.delete(
        "/v1/projects/{project_identifier}",
        ({ params, response }) => {
          captured.calls += 1;
          captured.projectIdentifier = params.project_identifier;
          return response(204).empty();
        }
      )
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createProjectCommand().parseAsync(
      ["delete", "my-project", ...BASE_ARGS],
      { from: "user" }
    );

    expect(captured.calls).toBe(1);
    expect(captured.projectIdentifier).toBe("my-project");
  });

  it("uses cascade warning message mentioning traces, spans, sessions, and annotations", async () => {
    vi.mocked(confirmOrExit).mockResolvedValue(undefined);
    mock.server.use(
      http.delete("/v1/projects/{project_identifier}", ({ response }) =>
        response(204).empty()
      )
    );
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
  useIsolatedProfilesDir();
  beforeEach(() => {
    // trace delete uses validateConfig which requires a project
    vi.stubEnv("PHOENIX_PROJECT", "default");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("calls DELETE /v1/traces/{trace_identifier}", async () => {
    const captured: { traceIdentifier?: string; calls: number } = { calls: 0 };
    mock.server.use(
      http.delete("/v1/traces/{trace_identifier}", ({ params, response }) => {
        captured.calls += 1;
        captured.traceIdentifier = params.trace_identifier;
        return response(204).empty();
      })
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createTraceCommand().parseAsync(
      ["delete", "trace-abc", ...BASE_ARGS],
      { from: "user" }
    );

    expect(captured.calls).toBe(1);
    expect(captured.traceIdentifier).toBe("trace-abc");
  });

  it("uses cascade warning message mentioning spans", async () => {
    vi.mocked(confirmOrExit).mockResolvedValue(undefined);
    mock.server.use(
      http.delete("/v1/traces/{trace_identifier}", ({ response }) =>
        response(204).empty()
      )
    );
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
  useIsolatedProfilesDir();
  beforeEach(() => {
    vi.mocked(deleteExperimentModule.deleteExperiment).mockResolvedValue(
      undefined
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
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
    const exitSpy = mockProcessExit();

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
  useIsolatedProfilesDir();
  beforeEach(() => {
    vi.mocked(deleteSessionModule.deleteSession).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
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
  useIsolatedProfilesDir();
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const annotationConfigFixture: componentsV1["schemas"]["CategoricalAnnotationConfig"] =
    {
      id: "config-789",
      name: "quality",
      type: "CATEGORICAL",
      optimization_direction: "MAXIMIZE",
      values: [{ label: "good" }, { label: "bad" }],
    };

  it("calls DELETE /v1/annotation_configs/{config_id}", async () => {
    const captured: { configId?: string; calls: number } = { calls: 0 };
    mock.server.use(
      http.delete(
        "/v1/annotation_configs/{config_id}",
        ({ params, response }) => {
          captured.calls += 1;
          captured.configId = params.config_id;
          return response(200).json({ data: annotationConfigFixture });
        }
      )
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createAnnotationConfigCommand().parseAsync(
      ["delete", "config-789", ...BASE_ARGS],
      { from: "user" }
    );

    expect(captured.calls).toBe(1);
    expect(captured.configId).toBe("config-789");
  });

  it("uses confirmation message without cascade warning", async () => {
    vi.mocked(confirmOrExit).mockResolvedValue(undefined);
    mock.server.use(
      http.delete("/v1/annotation_configs/{config_id}", ({ response }) =>
        response(200).json({ data: annotationConfigFixture })
      )
    );
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
  useIsolatedProfilesDir();
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls DELETE /v1/prompts/{prompt_identifier}", async () => {
    const captured: { promptIdentifier?: string; calls: number } = {
      calls: 0,
    };
    mock.server.use(
      http.delete("/v1/prompts/{prompt_identifier}", ({ params, response }) => {
        captured.calls += 1;
        captured.promptIdentifier = params.prompt_identifier;
        return response(204).empty();
      })
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createPromptCommand().parseAsync(
      ["delete", "my-prompt", ...BASE_ARGS],
      { from: "user" }
    );

    expect(captured.calls).toBe(1);
    expect(captured.promptIdentifier).toBe("my-prompt");
  });

  it("uses cascade warning message mentioning versions, tags, and labels", async () => {
    vi.mocked(confirmOrExit).mockResolvedValue(undefined);
    mock.server.use(
      http.delete("/v1/prompts/{prompt_identifier}", ({ response }) =>
        response(204).empty()
      )
    );
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
  useIsolatedProfilesDir();
  beforeEach(() => {
    // span delete uses validateConfig which requires a project
    vi.stubEnv("PHOENIX_PROJECT", "default");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  function captureSpanDelete() {
    const captured: { spanIdentifier?: string; calls: number } = { calls: 0 };
    mock.server.use(
      http.delete("/v1/spans/{span_identifier}", ({ params, response }) => {
        captured.calls += 1;
        captured.spanIdentifier = params.span_identifier;
        return response(204).empty();
      })
    );
    return captured;
  }

  it("calls DELETE /v1/spans/{span_identifier}", async () => {
    const captured = captureSpanDelete();
    vi.spyOn(console, "error").mockImplementation(() => {});

    await createSpanCommand().parseAsync(["delete", "span-abc", ...BASE_ARGS], {
      from: "user",
    });

    expect(captured.calls).toBe(1);
    expect(captured.spanIdentifier).toBe("span-abc");
  });

  it("warns that child spans are NOT deleted in confirmation message", async () => {
    vi.mocked(confirmOrExit).mockResolvedValue(undefined);
    captureSpanDelete();
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
    captureSpanDelete();
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await createSpanCommand().parseAsync(["delete", "span-abc", ...BASE_ARGS], {
      from: "user",
    });

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("span-abc"));
  });
});
