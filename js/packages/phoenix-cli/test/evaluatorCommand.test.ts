import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { componentsV1 } from "@arizeai/phoenix-testing";
import { HttpResponse } from "@arizeai/phoenix-testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as ConfirmModule from "../src/confirm";

vi.mock("../src/confirm", async (importOriginal) => {
  const originalModule = await importOriginal<typeof ConfirmModule>();
  return {
    ...originalModule,
    confirmOrExit: vi.fn().mockResolvedValue(undefined),
  };
});

import { createEvaluatorCommand } from "../src/commands/evaluator";
import { ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES } from "../src/confirm";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import {
  BASE_ARGS,
  captureCliOutput,
  mockProcessExit,
  recordRequests,
} from "./testUtils";

const mock = setupMockPhoenixServer();

const CODE_ID = "Q29kZUV2YWx1YXRvcjoy";
const LLM_ID = "TExNRXZhbHVhdG9yOjE=";
const VERSION_ID = "Q29kZUV2YWx1YXRvclZlcnNpb246MQ==";

const CODE_EVALUATOR: componentsV1["schemas"]["CodeEvaluatorDefinition"] = {
  type: "code",
  id: CODE_ID,
  name: "exact-match",
  description: null,
  language: "PYTHON",
  sandbox_config_id: "U2FuZGJveENvbmZpZzox",
  input_mapping: { literal_mapping: {}, path_mapping: { output: "output" } },
  output_configs: [
    { type: "CONTINUOUS", name: "score", optimization_direction: "MAXIMIZE" },
  ],
  current_version_id: VERSION_ID,
  source_code: "def evaluate(output: str) -> float:\n    return 1.0\n",
};

const LLM_EVALUATOR: componentsV1["schemas"]["LLMEvaluatorDefinition"] = {
  type: "llm",
  id: LLM_ID,
  name: "toxicity",
  description: "Flags toxic responses",
  prompt_id: "UHJvbXB0OjE=",
  prompt_version: null,
  output_configs: [
    {
      type: "CATEGORICAL",
      name: "toxicity",
      optimization_direction: "MINIMIZE",
      values: [
        { label: "toxic", score: 1 },
        { label: "clean", score: 0 },
      ],
    },
  ],
};

const VERSION: componentsV1["schemas"]["CodeEvaluatorVersion"] = {
  id: VERSION_ID,
  evaluator_id: CODE_ID,
  source_code: CODE_EVALUATOR.source_code ?? "",
  created_at: "2026-01-01T00:00:00+00:00",
};

/**
 * The client checks the server version before calling a gated route; the
 * mock server has to say it is new enough.
 */
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

function capturePatch() {
  const captured: { id?: string; body?: unknown; count: number } = {
    count: 0,
  };
  mock.server.use(
    http.patch(
      "/v1/evaluators/{evaluator_id}",
      async ({ params, request, response }) => {
        captured.count += 1;
        captured.id = params.evaluator_id;
        captured.body = await request.clone().json();
        return response(200).json({ data: LLM_EVALUATOR });
      }
    )
  );
  return captured;
}

describe("evaluator list", () => {
  it("follows pagination, forwards the filters, and prints the definitions as raw JSON", async () => {
    const queries: string[] = [];
    mock.server.use(
      http.get("/v1/evaluators", ({ request, response }) => {
        const url = new URL(request.url);
        queries.push(url.search);
        if (url.searchParams.get("cursor")) {
          return response(200).json({
            data: [LLM_EVALUATOR],
            next_cursor: null,
          });
        }
        return response(200).json({
          data: [CODE_EVALUATOR],
          next_cursor: "next",
        });
      })
    );
    const io = captureCliOutput();

    await createEvaluatorCommand().parseAsync(
      [
        "list",
        "--type",
        "code",
        "--name",
        "exact-match",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(queries).toEqual([
      "?type=code&name=exact-match&limit=100",
      "?type=code&name=exact-match&cursor=next&limit=100",
    ]);
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual([CODE_EVALUATOR, LLM_EVALUATOR]);
  });

  it("shows every kind's columns in a pretty table whichever kind comes first", async () => {
    mock.server.use(
      http.get("/v1/evaluators", ({ response }) =>
        response(200).json({
          data: [LLM_EVALUATOR, CODE_EVALUATOR],
          next_cursor: null,
        })
      )
    );
    const io = captureCliOutput();

    await createEvaluatorCommand().parseAsync(["list", ...BASE_ARGS], {
      from: "user",
    });

    const table = String(io.stdout.mock.calls[0]?.[0]);
    expect(table).toContain("prompt version");
    expect(table).toContain("language");
    expect(table).toContain("PYTHON");
  });

  it("stops at --limit without a second page", async () => {
    let calls = 0;
    mock.server.use(
      http.get("/v1/evaluators", ({ request, response }) => {
        calls += 1;
        expect(new URL(request.url).searchParams.get("limit")).toBe("1");
        return response(200).json({
          data: [CODE_EVALUATOR],
          next_cursor: "next",
        });
      })
    );
    const io = captureCliOutput();

    await createEvaluatorCommand().parseAsync(
      ["list", "--limit", "1", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    expect(calls).toBe(1);
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual([CODE_EVALUATOR]);
  });

  it("exits INVALID_ARGUMENT on an unknown --type without calling the server", async () => {
    let calls = 0;
    mock.server.use(
      http.get("/v1/evaluators", ({ response }) => {
        calls += 1;
        return response(200).json({ data: [], next_cursor: null });
      })
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createEvaluatorCommand().parseAsync(
        ["list", "--type", "widget", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(calls).toBe(0);
  });
});

describe("evaluator get", () => {
  it("GETs by id and prints the definition as raw JSON", async () => {
    let receivedId: string | undefined;
    mock.server.use(
      http.get("/v1/evaluators/{evaluator_id}", ({ params, response }) => {
        receivedId = params.evaluator_id;
        return response(200).json({ data: CODE_EVALUATOR });
      })
    );
    const io = captureCliOutput();

    await createEvaluatorCommand().parseAsync(
      ["get", CODE_ID, "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    expect(receivedId).toBe(CODE_ID);
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual(CODE_EVALUATOR);
  });

  it("exits FAILURE and prints the server's explanation when the evaluator is not found", async () => {
    mock.server.use(
      http.get("/v1/evaluators/{evaluator_id}", ({ response }) =>
        response.untyped(
          HttpResponse.text("Evaluator not found: missing", { status: 404 })
        )
      )
    );
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createEvaluatorCommand().parseAsync(
        ["get", "missing", "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("HTTP 404"));
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Evaluator not found: missing")
    );
  });
});

describe("evaluator create", () => {
  it("POSTs the code evaluator built from the flags and file", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "px-evaluator-"));
    const file = path.join(dir, "evaluator.py");
    fs.writeFileSync(file, CODE_EVALUATOR.source_code ?? "");
    let receivedBody: unknown;
    mock.server.use(
      http.post("/v1/evaluators", async ({ request, response }) => {
        receivedBody = await request.clone().json();
        return response(201).json({ data: CODE_EVALUATOR });
      })
    );
    const io = captureCliOutput();

    try {
      await createEvaluatorCommand().parseAsync(
        [
          "create",
          "--name",
          "exact-match",
          "--file",
          file,
          "--language",
          "python",
          "--sandbox-config-id",
          "U2FuZGJveENvbmZpZzox",
          "--input-mapping",
          '{"literal_mapping":{},"path_mapping":{"output":"output"}}',
          "--output-configs",
          JSON.stringify(CODE_EVALUATOR.output_configs),
          "--format",
          "raw",
          ...BASE_ARGS,
        ],
        { from: "user" }
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }

    expect(receivedBody).toEqual({
      type: "code",
      name: "exact-match",
      source_code: CODE_EVALUATOR.source_code,
      language: "PYTHON",
      sandbox_config_id: "U2FuZGJveENvbmZpZzox",
      input_mapping: {
        literal_mapping: {},
        path_mapping: { output: "output" },
      },
      output_configs: CODE_EVALUATOR.output_configs,
    });
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual(CODE_EVALUATOR);
  });

  it("exits INVALID_ARGUMENT when a required flag is missing", async () => {
    let calls = 0;
    mock.server.use(
      http.post("/v1/evaluators", ({ response }) => {
        calls += 1;
        return response(201).json({ data: CODE_EVALUATOR });
      })
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createEvaluatorCommand().parseAsync(
        ["create", "--name", "exact-match", "--source-code", "x", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(calls).toBe(0);
  });

  it("requires --output-configs and shows the full invocation", async () => {
    let calls = 0;
    mock.server.use(
      http.post("/v1/evaluators", ({ response }) => {
        calls += 1;
        return response(201).json({ data: CODE_EVALUATOR });
      })
    );
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createEvaluatorCommand().parseAsync(
        [
          "create",
          "--name",
          "exact-match",
          "--source-code",
          "x",
          "--language",
          "PYTHON",
          "--sandbox-config-id",
          "U2FuZGJveENvbmZpZzox",
          "--input-mapping",
          '{"literal_mapping":{},"path_mapping":{}}',
          "--format",
          "raw",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(calls).toBe(0);
    const parsed = JSON.parse(String(io.stderr.mock.calls[0]?.[0]));
    expect(parsed.error).toBe("Missing required flag --output-configs");
    expect(parsed.code).toBe("INVALID_ARGUMENT");
    expect(parsed.hint).toContain("--output-configs <json>");
  });

  it("rejects an empty --output-configs before any request", async () => {
    const requests = recordRequests(mock.server);
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createEvaluatorCommand().parseAsync(
        [
          "create",
          "--name",
          "exact-match",
          "--source-code",
          "x",
          "--language",
          "PYTHON",
          "--sandbox-config-id",
          "U2FuZGJveENvbmZpZzox",
          "--input-mapping",
          '{"literal_mapping":{},"path_mapping":{}}',
          "--output-configs",
          "[]",
          "--format",
          "raw",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(requests).toEqual([]);
    const envelope = JSON.parse(String(io.stderr.mock.calls[0]?.[0]));
    expect(envelope).toEqual({
      error:
        "Error creating evaluator: --output-configs must be a non-empty JSON array",
      code: "INVALID_ARGUMENT",
      hint: expect.stringContaining("px evaluator create --name <name>"),
    });
  });
});

describe("evaluator update", () => {
  it("PATCHes only the flags given, discriminated by --type", async () => {
    const captured = capturePatch();
    const io = captureCliOutput();

    await createEvaluatorCommand().parseAsync(
      [
        "update",
        LLM_ID,
        "--type",
        "llm",
        "--description",
        "Flags toxic responses",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.count).toBe(1);
    expect(captured.id).toBe(LLM_ID);
    expect(captured.body).toEqual({
      type: "llm",
      description: "Flags toxic responses",
    });
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual(LLM_EVALUATOR);
  });

  it("sends --prompt-version-id on an llm update", async () => {
    const captured = capturePatch();
    captureCliOutput();

    await createEvaluatorCommand().parseAsync(
      [
        "update",
        LLM_ID,
        "--type",
        "llm",
        "--prompt-version-id",
        "UHJvbXB0VmVyc2lvbjo3",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.body).toEqual({
      type: "llm",
      prompt_version_id: "UHJvbXB0VmVyc2lvbjo3",
    });
  });

  it("sends nulls for the clear flags on a code update", async () => {
    const captured = capturePatch();
    captureCliOutput();

    await createEvaluatorCommand().parseAsync(
      [
        "update",
        CODE_ID,
        "--type",
        "code",
        "--clear-description",
        "--clear-sandbox-config",
        "--input-mapping",
        '{"literal_mapping":{},"path_mapping":{"output":"output.text"}}',
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.body).toEqual({
      type: "code",
      description: null,
      sandbox_config_id: null,
      input_mapping: {
        literal_mapping: {},
        path_mapping: { output: "output.text" },
      },
    });
  });

  it("rejects --description together with --clear-description", async () => {
    const captured = capturePatch();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createEvaluatorCommand().parseAsync(
        [
          "update",
          CODE_ID,
          "--type",
          "code",
          "--description",
          "x",
          "--clear-description",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.count).toBe(0);
  });

  it("exits INVALID_ARGUMENT without --type and never calls the server", async () => {
    const captured = capturePatch();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createEvaluatorCommand().parseAsync(
        ["update", LLM_ID, "--name", "x", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.count).toBe(0);
  });

  it("rejects code-only flags on an llm update", async () => {
    const captured = capturePatch();
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createEvaluatorCommand().parseAsync(
        [
          "update",
          LLM_ID,
          "--type",
          "llm",
          "--sandbox-config-id",
          "abc",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "--sandbox-config-id cannot be used with --type llm"
      )
    );
    expect(captured.count).toBe(0);
  });

  it("exits INVALID_ARGUMENT when no field flag is given", async () => {
    const captured = capturePatch();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createEvaluatorCommand().parseAsync(
        ["update", CODE_ID, "--type", "code", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.count).toBe(0);
  });

  it.each([
    ["llm", LLM_ID],
    ["code", CODE_ID],
  ])(
    "rejects an empty --output-configs on a %s update before any request",
    async (type, evaluatorId) => {
      const requests = recordRequests(mock.server);
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(
        createEvaluatorCommand().parseAsync(
          [
            "update",
            evaluatorId,
            "--type",
            type,
            "--output-configs",
            "[]",
            "--format",
            "raw",
            ...BASE_ARGS,
          ],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
      expect(requests).toEqual([]);
      const envelope = JSON.parse(String(io.stderr.mock.calls[0]?.[0]));
      expect(envelope).toEqual({
        error:
          "Error updating evaluator: --output-configs must be a non-empty JSON array",
        code: "INVALID_ARGUMENT",
        hint: `px evaluator get ${evaluatorId} --format raw --no-progress | jq '.output_configs'`,
      });
    }
  );

  it("prints the 409 explanation when the server refuses the change", async () => {
    mock.server.use(
      http.patch("/v1/evaluators/{evaluator_id}", ({ response }) =>
        response.untyped(
          HttpResponse.text(
            "Dataset evaluator bindings override outputs that the updated prompt no longer supports: RGF0YXNldEV2YWx1YXRvcjox",
            { status: 409 }
          )
        )
      )
    );
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockProcessExit();

    await expect(
      createEvaluatorCommand().parseAsync(
        [
          "update",
          LLM_ID,
          "--type",
          "llm",
          "--prompt-version-id",
          "UHJvbXB0VmVyc2lvbjo3",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("RGF0YXNldEV2YWx1YXRvcjox")
    );
  });
});

describe("evaluator delete", () => {
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

  it("DELETEs the evaluator", async () => {
    let receivedId: string | undefined;
    mock.server.use(
      http.delete("/v1/evaluators/{evaluator_id}", ({ params, response }) => {
        receivedId = params.evaluator_id;
        return response(204).empty();
      })
    );
    captureCliOutput();

    await createEvaluatorCommand().parseAsync(
      ["delete", CODE_ID, "--yes", ...BASE_ARGS],
      { from: "user" }
    );

    expect(receivedId).toBe(CODE_ID);
  });

  it("exits INVALID_ARGUMENT when deletes are not enabled", async () => {
    delete process.env[ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES];
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createEvaluatorCommand().parseAsync(
        ["delete", CODE_ID, "--yes", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
  });
});

describe("evaluator version list", () => {
  it("GETs the versions newest first and honors --limit", async () => {
    let receivedId: string | undefined;
    let receivedLimit: string | null = null;
    mock.server.use(
      http.get(
        "/v1/evaluators/{evaluator_id}/versions",
        ({ params, request, response }) => {
          receivedId = params.evaluator_id;
          receivedLimit = new URL(request.url).searchParams.get("limit");
          return response(200).json({ data: [VERSION], next_cursor: "more" });
        }
      )
    );
    const io = captureCliOutput();

    await createEvaluatorCommand().parseAsync(
      [
        "version",
        "list",
        CODE_ID,
        "--limit",
        "1",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(receivedId).toBe(CODE_ID);
    expect(receivedLimit).toBe("1");
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual([VERSION]);
  });
});

describe("evaluator version create", () => {
  it("POSTs the file contents with the expected version and configuration", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "px-evaluator-"));
    const file = path.join(dir, "evaluator.py");
    const source = "def evaluate(output: str) -> float:\n    return 0.5\n";
    fs.writeFileSync(file, source);
    const created: componentsV1["schemas"]["CreatedCodeEvaluatorVersion"] = {
      id: "Q29kZUV2YWx1YXRvclZlcnNpb246Mg==",
      evaluator_id: CODE_ID,
      source_code: source,
      created_at: "2026-01-02T00:00:00+00:00",
      was_created: true,
    };
    let receivedBody: unknown;
    mock.server.use(
      http.post(
        "/v1/evaluators/{evaluator_id}/versions",
        async ({ request, response }) => {
          receivedBody = await request.clone().json();
          return response(201).json({ data: created });
        }
      )
    );
    const io = captureCliOutput();

    try {
      await createEvaluatorCommand().parseAsync(
        [
          "version",
          "create",
          CODE_ID,
          "--file",
          file,
          "--expected-current-version",
          VERSION_ID,
          "--output-configs",
          '[{"type":"FREEFORM","name":"notes"}]',
          "--format",
          "raw",
          ...BASE_ARGS,
        ],
        { from: "user" }
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }

    expect(receivedBody).toEqual({
      source_code: source,
      expected_current_version_id: VERSION_ID,
      output_configs: [{ type: "FREEFORM", name: "notes" }],
    });
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual(created);
  });

  it("exits INVALID_ARGUMENT when neither --source-code nor --file is given", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createEvaluatorCommand().parseAsync(
        ["version", "create", CODE_ID, ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
  });

  it("rejects an empty --output-configs before any request", async () => {
    const requests = recordRequests(mock.server);
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createEvaluatorCommand().parseAsync(
        [
          "version",
          "create",
          CODE_ID,
          "--source-code",
          "x",
          "--output-configs",
          "[]",
          "--format",
          "raw",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(requests).toEqual([]);
    const envelope = JSON.parse(String(io.stderr.mock.calls[0]?.[0]));
    expect(envelope).toEqual({
      error:
        "Error creating evaluator version: --output-configs must be a non-empty JSON array",
      code: "INVALID_ARGUMENT",
      hint: `px evaluator get ${CODE_ID} --format raw --no-progress | jq '.output_configs'`,
    });
  });
});

describe("evaluator command error handling", () => {
  it("writes a structured error envelope in raw mode", async () => {
    mock.server.use(
      http.get("/v1/evaluators/{evaluator_id}", ({ response }) =>
        response.untyped(
          HttpResponse.text("Evaluator not found: missing", { status: 404 })
        )
      )
    );
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockProcessExit();

    await expect(
      createEvaluatorCommand().parseAsync(
        ["get", "missing", "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    const envelope = JSON.parse(String(stderrSpy.mock.calls[0]?.[0]));
    expect(envelope.code).toBe("FAILURE");
    expect(envelope.error).toContain("Evaluator not found: missing");
  });

  it("exits AUTH_REQUIRED when the server rejects the credentials", async () => {
    mock.server.use(
      http.get("/v1/evaluators", ({ response }) =>
        response.untyped(HttpResponse.text("Unauthorized", { status: 401 }))
      )
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createEvaluatorCommand().parseAsync(["list", ...BASE_ARGS], {
        from: "user",
      })
    ).rejects.toThrow(`process.exit:${ExitCode.AUTH_REQUIRED}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.AUTH_REQUIRED);
  });

  it("rejects a non-positive --limit before contacting the server", async () => {
    let listed = false;
    mock.server.use(
      http.get("/v1/evaluators", ({ response }) => {
        listed = true;
        return response(200).json({ data: [], next_cursor: null });
      })
    );
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockProcessExit();

    await expect(
      createEvaluatorCommand().parseAsync(
        ["list", "--limit", "0", "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(listed).toBe(false);
    const envelope = JSON.parse(String(stderrSpy.mock.calls[0]?.[0]));
    expect(envelope.code).toBe("INVALID_ARGUMENT");
  });
});
