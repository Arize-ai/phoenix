import type { componentsV1 } from "@arizeai/phoenix-testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as ConfirmModule from "../src/confirm";

vi.mock("../src/confirm", async (importOriginal) => {
  const originalModule = await importOriginal<typeof ConfirmModule>();
  return {
    ...originalModule,
    confirmOrExit: vi.fn().mockResolvedValue(undefined),
  };
});

import { createProjectEvaluatorCommand } from "../src/commands/projectEvaluator";
import { ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES } from "../src/confirm";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

const BINDING_ID = "UHJvamVjdEV2YWx1YXRvcjox";

const BINDING: componentsV1["schemas"]["ProjectEvaluator"] = {
  id: BINDING_ID,
  project_id: "UHJvamVjdDox",
  evaluator_id: "Q29kZUV2YWx1YXRvcjox",
  evaluator_type: "llm",
  trace_project_id: "UHJvamVjdDo5",
  name: "toxicity",
  evaluation_target: "SPAN",
  sampling_rate: 0.25,
  filter_condition: "",
  enabled: true,
  input_mapping: null,
  evaluation_delay_seconds: null,
};

beforeEach(() => {
  mock.server.use(
    http.get("/arize_phoenix_version", ({ response }) =>
      response.untyped(new Response("21.0.0", { status: 200 }))
    )
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("project evaluator list", () => {
  it("GETs the project's bindings by identifier and prints them as raw JSON", async () => {
    let receivedIdentifier: string | undefined;
    mock.server.use(
      http.get(
        "/v1/projects/{project_identifier}/evaluators",
        ({ params, response }) => {
          receivedIdentifier = params.project_identifier;
          return response(200).json({ data: [BINDING], next_cursor: null });
        }
      )
    );
    const io = captureCliOutput();

    await createProjectEvaluatorCommand().parseAsync(
      ["list", "support-bot", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    expect(receivedIdentifier).toBe("support-bot");
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual([BINDING]);
  });
});

describe("project evaluator create", () => {
  function captureCreate() {
    const captured: { identifier?: string; body?: unknown; count: number } = {
      count: 0,
    };
    mock.server.use(
      http.post(
        "/v1/projects/{project_identifier}/evaluators",
        async ({ params, request, response }) => {
          captured.count += 1;
          captured.identifier = params.project_identifier;
          captured.body = await request.clone().json();
          return response(201).json({ data: BINDING });
        }
      )
    );
    return captured;
  }

  it("builds the request from scheduling flags and --evaluator-id", async () => {
    const captured = captureCreate();
    const io = captureCliOutput();

    await createProjectEvaluatorCommand().parseAsync(
      [
        "create",
        "support-bot",
        "--name",
        "toxicity",
        "--evaluation-target",
        "span",
        "--sampling-rate",
        "0.25",
        "--evaluator-id",
        "Q29kZUV2YWx1YXRvcjox",
        "--filter-condition",
        "span_kind == 'LLM'",
        "--disabled",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.count).toBe(1);
    expect(captured.identifier).toBe("support-bot");
    expect(captured.body).toEqual({
      name: "toxicity",
      evaluation_target: "SPAN",
      sampling_rate: 0.25,
      evaluator: { type: "reference", evaluator_id: "Q29kZUV2YWx1YXRvcjox" },
      filter_condition: "span_kind == 'LLM'",
      enabled: false,
    });
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual(BINDING);
  });

  it("forwards a session delay and inline evaluator JSON", async () => {
    const captured = captureCreate();
    captureCliOutput();
    const evaluator = {
      type: "code",
      source_code: "def evaluate(output: str) -> float:\n    return 1.0\n",
      language: "PYTHON",
      sandbox_config_id: "U2FuZGJveENvbmZpZzox",
      input_mapping: { literal_mapping: {}, path_mapping: {} },
      output_configs: [
        {
          type: "CONTINUOUS",
          name: "score",
          optimization_direction: "MAXIMIZE",
        },
      ],
    };

    await createProjectEvaluatorCommand().parseAsync(
      [
        "create",
        "support-bot",
        "--name",
        "resolution",
        "--evaluation-target",
        "SESSION",
        "--sampling-rate",
        "1",
        "--evaluator",
        JSON.stringify(evaluator),
        "--evaluation-delay-seconds",
        "600",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.body).toEqual({
      name: "resolution",
      evaluation_target: "SESSION",
      sampling_rate: 1,
      evaluator,
      evaluation_delay_seconds: 600,
    });
  });

  it.each([
    ["omits", {}],
    ["empties", { output_configs: [] }],
  ])(
    "exits INVALID_ARGUMENT when an inline code evaluator %s its output configs",
    async (_, outputs) => {
      const captured = captureCreate();
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();
      const evaluator = {
        type: "code",
        source_code: "def evaluate(output: str) -> float:\n    return 1.0\n",
        language: "PYTHON",
        sandbox_config_id: "U2FuZGJveENvbmZpZzox",
        input_mapping: { literal_mapping: {}, path_mapping: {} },
        ...outputs,
      };

      await expect(
        createProjectEvaluatorCommand().parseAsync(
          [
            "create",
            "support-bot",
            "--name",
            "resolution",
            "--evaluation-target",
            "SESSION",
            "--sampling-rate",
            "1",
            "--evaluator",
            JSON.stringify(evaluator),
            "--format",
            "raw",
            ...BASE_ARGS,
          ],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
      expect(captured.count).toBe(0);
      const parsed = JSON.parse(String(io.stderr.mock.calls[0]?.[0]));
      expect(parsed.code).toBe("INVALID_ARGUMENT");
      expect(parsed.error).toContain(
        "A new code evaluator in --evaluator needs at least one output config"
      );
    }
  );

  it("exits INVALID_ARGUMENT on an unknown --evaluation-target without calling the server", async () => {
    const captured = captureCreate();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createProjectEvaluatorCommand().parseAsync(
        [
          "create",
          "support-bot",
          "--name",
          "toxicity",
          "--evaluation-target",
          "DOCUMENT",
          "--sampling-rate",
          "1",
          "--evaluator-id",
          "Q29kZUV2YWx1YXRvcjox",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.count).toBe(0);
  });

  it("exits INVALID_ARGUMENT without --sampling-rate", async () => {
    const captured = captureCreate();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createProjectEvaluatorCommand().parseAsync(
        [
          "create",
          "support-bot",
          "--name",
          "toxicity",
          "--evaluation-target",
          "SPAN",
          "--evaluator-id",
          "Q29kZUV2YWx1YXRvcjox",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.count).toBe(0);
  });
});

describe("project evaluator update", () => {
  function capturePatch() {
    const captured: { body?: unknown; count: number } = { count: 0 };
    mock.server.use(
      http.patch(
        "/v1/project_evaluators/{project_evaluator_id}",
        async ({ request, response }) => {
          captured.count += 1;
          captured.body = await request.clone().json();
          return response(200).json({ data: { ...BINDING, enabled: false } });
        }
      )
    );
    return captured;
  }

  it("PATCHes only the flags given, collapsing --disabled to enabled:false", async () => {
    const captured = capturePatch();
    captureCliOutput();

    await createProjectEvaluatorCommand().parseAsync(
      [
        "update",
        BINDING_ID,
        "--disabled",
        "--sampling-rate",
        "0.5",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.body).toEqual({ sampling_rate: 0.5, enabled: false });
  });

  it("sends explicit nulls for the reset flags", async () => {
    const captured = capturePatch();
    captureCliOutput();

    await createProjectEvaluatorCommand().parseAsync(
      [
        "update",
        BINDING_ID,
        "--inherit-input-mapping",
        "--default-evaluation-delay",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.body).toEqual({
      input_mapping: null,
      evaluation_delay_seconds: null,
    });
  });

  it("rejects --evaluation-delay-seconds together with --default-evaluation-delay", async () => {
    const captured = capturePatch();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createProjectEvaluatorCommand().parseAsync(
        [
          "update",
          BINDING_ID,
          "--evaluation-delay-seconds",
          "60",
          "--default-evaluation-delay",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.count).toBe(0);
  });

  it("rejects --enabled together with --disabled", async () => {
    const captured = capturePatch();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createProjectEvaluatorCommand().parseAsync(
        ["update", BINDING_ID, "--enabled", "--disabled", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.count).toBe(0);
  });

  it("exits INVALID_ARGUMENT when no field flag is given", async () => {
    const captured = capturePatch();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createProjectEvaluatorCommand().parseAsync(
        ["update", BINDING_ID, ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.count).toBe(0);
  });
});

describe("project evaluator delete", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env[ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES];
    process.env[ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES] = "true";
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env[ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES];
    } else {
      process.env[ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES] = originalEnv;
    }
  });

  it("DELETEs a single binding and keeps the prompt by default", async () => {
    let receivedId: string | undefined;
    let receivedFlag: string | null = null;
    mock.server.use(
      http.delete(
        "/v1/project_evaluators/{project_evaluator_id}",
        ({ params, request, response }) => {
          receivedId = params.project_evaluator_id;
          receivedFlag = new URL(request.url).searchParams.get(
            "delete_associated_prompt"
          );
          return response(204).empty();
        }
      )
    );
    captureCliOutput();

    await createProjectEvaluatorCommand().parseAsync(
      ["delete", BINDING_ID, "--yes", ...BASE_ARGS],
      { from: "user" }
    );

    expect(receivedId).toBe(BINDING_ID);
    expect(receivedFlag).toBe("false");
  });

  it("POSTs several ids to the bulk endpoint and forwards --delete-prompt", async () => {
    let receivedBody: unknown;
    mock.server.use(
      http.post(
        "/v1/project_evaluators/delete",
        async ({ request, response }) => {
          receivedBody = await request.clone().json();
          return response(204).empty();
        }
      )
    );
    captureCliOutput();

    await createProjectEvaluatorCommand().parseAsync(
      ["delete", "a", "b", "--delete-prompt", "--yes", ...BASE_ARGS],
      { from: "user" }
    );

    expect(receivedBody).toEqual({
      project_evaluator_ids: ["a", "b"],
      delete_associated_prompt: true,
    });
  });

  it("exits INVALID_ARGUMENT when deletes are not enabled", async () => {
    delete process.env[ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES];
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createProjectEvaluatorCommand().parseAsync(
        ["delete", BINDING_ID, "--yes", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
  });
});

describe("project evaluator get", () => {
  it("GETs the binding by id and prints it as a single object", async () => {
    let receivedId: string | undefined;
    mock.server.use(
      http.get(
        "/v1/project_evaluators/{project_evaluator_id}",
        ({ params, response }) => {
          receivedId = params.project_evaluator_id;
          return response(200).json({ data: BINDING });
        }
      )
    );
    const io = captureCliOutput();

    await createProjectEvaluatorCommand().parseAsync(
      ["get", BINDING_ID, "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    expect(receivedId).toBe(BINDING_ID);
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual(BINDING);
  });
});

describe("project evaluator numeric flags", () => {
  function captureCreate() {
    let called = false;
    mock.server.use(
      http.post(
        "/v1/projects/{project_identifier}/evaluators",
        ({ response }) => {
          called = true;
          return response(201).json({ data: BINDING });
        }
      )
    );
    return () => called;
  }

  it("rejects a non-positive --limit before contacting the server", async () => {
    let listed = false;
    mock.server.use(
      http.get(
        "/v1/projects/{project_identifier}/evaluators",
        ({ response }) => {
          listed = true;
          return response(200).json({ data: [], next_cursor: null });
        }
      )
    );
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockProcessExit();

    await expect(
      createProjectEvaluatorCommand().parseAsync(
        [
          "list",
          "support-bot",
          "--limit",
          "0",
          "--format",
          "raw",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(listed).toBe(false);
    expect(JSON.parse(String(stderrSpy.mock.calls[0]?.[0])).code).toBe(
      "INVALID_ARGUMENT"
    );
  });

  it("rejects an --evaluation-delay-seconds that is not a positive integer", async () => {
    const wasCalled = captureCreate();
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockProcessExit();

    await expect(
      createProjectEvaluatorCommand().parseAsync(
        [
          "create",
          "support-bot",
          "--name",
          "toxicity",
          "--evaluation-target",
          "session",
          "--sampling-rate",
          "0.25",
          "--evaluator-id",
          "Q29kZUV2YWx1YXRvcjox",
          "--evaluation-delay-seconds",
          "0",
          "--format",
          "raw",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(wasCalled()).toBe(false);
    expect(String(stderrSpy.mock.calls[0]?.[0])).toContain(
      "--evaluation-delay-seconds"
    );
  });

  it("rejects a --sampling-rate outside 0..1 or not a number", async () => {
    const wasCalled = captureCreate();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockProcessExit();

    for (const rate of ["1.5", "abc"]) {
      await expect(
        createProjectEvaluatorCommand().parseAsync(
          [
            "create",
            "support-bot",
            "--name",
            "toxicity",
            "--evaluation-target",
            "span",
            "--sampling-rate",
            rate,
            "--evaluator-id",
            "Q29kZUV2YWx1YXRvcjox",
            ...BASE_ARGS,
          ],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);
    }
    expect(wasCalled()).toBe(false);
  });
});

describe("project evaluator create local checks", () => {
  function trackCreate() {
    const state = { called: false };
    mock.server.use(
      http.post(
        "/v1/projects/{project_identifier}/evaluators",
        ({ response }) => {
          state.called = true;
          return response(201).json({ data: BINDING });
        }
      )
    );
    return state;
  }

  const base = [
    "create",
    "support-bot",
    "--name",
    "resolution",
    "--sampling-rate",
    "1",
  ];

  it("requires --input-mapping for a new LLM evaluator", async () => {
    const state = trackCreate();
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockProcessExit();
    const evaluator = {
      type: "llm",
      description: "resolution",
      prompt_version_id: "UHJvbXB0VmVyc2lvbjo3",
      output_configs: [
        {
          type: "CATEGORICAL",
          name: "resolution",
          optimization_direction: "MAXIMIZE",
          values: [
            { label: "yes", score: 1 },
            { label: "no", score: 0 },
          ],
        },
      ],
    };

    await expect(
      createProjectEvaluatorCommand().parseAsync(
        [
          ...base,
          "--evaluation-target",
          "SESSION",
          "--evaluator",
          JSON.stringify(evaluator),
          "--format",
          "raw",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(state.called).toBe(false);
    const envelope = JSON.parse(String(stderrSpy.mock.calls[0]?.[0]));
    expect(envelope.code).toBe("INVALID_ARGUMENT");
    expect(envelope.error).toContain("--input-mapping");
  });

  it("rejects an evaluation delay on a SPAN evaluator", async () => {
    const state = trackCreate();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockProcessExit();

    await expect(
      createProjectEvaluatorCommand().parseAsync(
        [
          ...base,
          "--evaluation-target",
          "span",
          "--evaluator-id",
          "Q29kZUV2YWx1YXRvcjox",
          "--evaluation-delay-seconds",
          "600",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);
    expect(state.called).toBe(false);
  });

  it("rejects an evaluation delay below the 10-second minimum", async () => {
    const state = trackCreate();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockProcessExit();

    await expect(
      createProjectEvaluatorCommand().parseAsync(
        [
          ...base,
          "--evaluation-target",
          "SESSION",
          "--evaluator-id",
          "Q29kZUV2YWx1YXRvcjox",
          "--evaluation-delay-seconds",
          "5",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);
    expect(state.called).toBe(false);
  });
});
