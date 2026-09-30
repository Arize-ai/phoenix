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

import { createDatasetEvaluatorCommand } from "../src/commands/datasetEvaluator";
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

const BINDING_ID = "RGF0YXNldEV2YWx1YXRvcjox";
const INPUT_MAPPING = {
  literal_mapping: {},
  path_mapping: { output: "output" },
};

const BINDING: componentsV1["schemas"]["DatasetEvaluator"] = {
  id: BINDING_ID,
  dataset_id: "RGF0YXNldDox",
  evaluator_id: "Q29kZUV2YWx1YXRvcjoy",
  evaluator_type: "code",
  trace_project_id: "UHJvamVjdDo5",
  name: "exact-match",
  input_mapping: INPUT_MAPPING,
  description: null,
  output_configs: null,
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

describe("dataset evaluator list", () => {
  it("GETs the dataset's bindings by identifier and prints them as raw JSON", async () => {
    let receivedIdentifier: string | undefined;
    mock.server.use(
      http.get(
        "/v1/datasets/{dataset_identifier}/evaluators",
        ({ params, response }) => {
          receivedIdentifier = params.dataset_identifier;
          return response(200).json({ data: [BINDING], next_cursor: null });
        }
      )
    );
    const io = captureCliOutput();

    await createDatasetEvaluatorCommand().parseAsync(
      ["list", "golden-questions", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    expect(receivedIdentifier).toBe("golden-questions");
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual([BINDING]);
  });

  it("accepts --format in any case", async () => {
    mock.server.use(
      http.get("/v1/datasets/{dataset_identifier}/evaluators", ({ response }) =>
        response(200).json({ data: [BINDING], next_cursor: null })
      )
    );
    const io = captureCliOutput();

    await createDatasetEvaluatorCommand().parseAsync(
      ["list", "golden-questions", "--format", "RAW", ...BASE_ARGS],
      { from: "user" }
    );

    expect(JSON.parse(String(io.stdout.mock.calls[0]?.[0]))).toEqual([BINDING]);
  });

  it("rejects an invalid --format before any request", async () => {
    let listed = false;
    mock.server.use(
      http.get(
        "/v1/datasets/{dataset_identifier}/evaluators",
        ({ response }) => {
          listed = true;
          return response(200).json({ data: [BINDING], next_cursor: null });
        }
      )
    );
    const io = captureCliOutput();
    mockProcessExit();

    await expect(
      createDatasetEvaluatorCommand().parseAsync(
        ["list", "golden-questions", "--format", "yaml", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(listed).toBe(false);
    expect(String(io.stderr.mock.calls[0]?.[0])).toContain(
      "Invalid --format: yaml"
    );
  });
});

describe("dataset evaluator create", () => {
  function captureCreate() {
    const captured: { identifier?: string; body?: unknown; count: number } = {
      count: 0,
    };
    mock.server.use(
      http.post(
        "/v1/datasets/{dataset_identifier}/evaluators",
        async ({ params, request, response }) => {
          captured.count += 1;
          captured.identifier = params.dataset_identifier;
          captured.body = await request.clone().json();
          return response(201).json({ data: BINDING });
        }
      )
    );
    return captured;
  }

  it("builds a reference body from --evaluator-id", async () => {
    const captured = captureCreate();
    const io = captureCliOutput();

    await createDatasetEvaluatorCommand().parseAsync(
      [
        "create",
        "golden-questions",
        "--name",
        "exact-match",
        "--evaluator-id",
        "Q29kZUV2YWx1YXRvcjoy",
        "--input-mapping",
        JSON.stringify(INPUT_MAPPING),
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.count).toBe(1);
    expect(captured.identifier).toBe("golden-questions");
    expect(captured.body).toEqual({
      name: "exact-match",
      evaluator_id: "Q29kZUV2YWx1YXRvcjoy",
      input_mapping: INPUT_MAPPING,
    });
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual(BINDING);
  });

  it("passes overrides through", async () => {
    const captured = captureCreate();
    captureCliOutput();

    await createDatasetEvaluatorCommand().parseAsync(
      [
        "create",
        "golden-questions",
        "--name",
        "exact-match",
        "--evaluator-id",
        "Q29kZUV2YWx1YXRvcjoy",
        "--input-mapping",
        JSON.stringify(INPUT_MAPPING),
        "--description",
        "override",
        "--output-configs",
        '[{"type":"FREEFORM","name":"notes"}]',
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.body).toEqual({
      name: "exact-match",
      evaluator_id: "Q29kZUV2YWx1YXRvcjoy",
      input_mapping: INPUT_MAPPING,
      description: "override",
      output_configs: [{ type: "FREEFORM", name: "notes" }],
    });
  });

  it("exits INVALID_ARGUMENT without --evaluator-id and never calls the server", async () => {
    const captured = captureCreate();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createDatasetEvaluatorCommand().parseAsync(
        [
          "create",
          "golden-questions",
          "--name",
          "exact-match",
          "--input-mapping",
          JSON.stringify(INPUT_MAPPING),
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.count).toBe(0);
  });

  it("rejects an empty --output-configs override before any request", async () => {
    const requests = recordRequests(mock.server);
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createDatasetEvaluatorCommand().parseAsync(
        [
          "create",
          "golden-questions",
          "--name",
          "exact-match",
          "--evaluator-id",
          "Q29kZUV2YWx1YXRvcjoy",
          "--input-mapping",
          JSON.stringify(INPUT_MAPPING),
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
        "Error creating dataset evaluator: --output-configs must be a non-empty JSON array",
      code: "INVALID_ARGUMENT",
      hint: "px dataset evaluator create golden-questions --name exact-match --input-mapping <json> --evaluator-id <id>",
    });
  });
});

describe("dataset evaluator update", () => {
  it("PATCHes only the flags given", async () => {
    let receivedBody: unknown;
    mock.server.use(
      http.patch(
        "/v1/dataset_evaluators/{dataset_evaluator_id}",
        async ({ request, response }) => {
          receivedBody = await request.clone().json();
          return response(200).json({ data: { ...BINDING, name: "renamed" } });
        }
      )
    );
    captureCliOutput();

    await createDatasetEvaluatorCommand().parseAsync(
      ["update", BINDING_ID, "--name", "renamed", ...BASE_ARGS],
      { from: "user" }
    );

    expect(receivedBody).toEqual({ name: "renamed" });
  });

  it("sends explicit nulls for --inherit-* flags", async () => {
    let receivedBody: unknown;
    mock.server.use(
      http.patch(
        "/v1/dataset_evaluators/{dataset_evaluator_id}",
        async ({ request, response }) => {
          receivedBody = await request.clone().json();
          return response(200).json({ data: BINDING });
        }
      )
    );
    captureCliOutput();

    await createDatasetEvaluatorCommand().parseAsync(
      [
        "update",
        BINDING_ID,
        "--inherit-description",
        "--inherit-output-configs",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(receivedBody).toEqual({ description: null, output_configs: null });
  });

  it("rejects --description together with --inherit-description", async () => {
    let calls = 0;
    mock.server.use(
      http.patch(
        "/v1/dataset_evaluators/{dataset_evaluator_id}",
        ({ response }) => {
          calls += 1;
          return response(200).json({ data: BINDING });
        }
      )
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createDatasetEvaluatorCommand().parseAsync(
        [
          "update",
          BINDING_ID,
          "--description",
          "x",
          "--inherit-description",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(calls).toBe(0);
  });

  it("rejects an empty --output-configs before any request", async () => {
    const requests = recordRequests(mock.server);
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createDatasetEvaluatorCommand().parseAsync(
        [
          "update",
          BINDING_ID,
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
        "Error updating dataset evaluator: --output-configs must be a non-empty JSON array",
      code: "INVALID_ARGUMENT",
      hint: `px dataset evaluator update ${BINDING_ID} --inherit-output-configs`,
    });
  });

  it("exits INVALID_ARGUMENT when no field flag is given", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createDatasetEvaluatorCommand().parseAsync(
        ["update", BINDING_ID, ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
  });
});

describe("dataset evaluator delete", () => {
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

  it("DELETEs a single binding and sends no other options", async () => {
    let receivedId: string | undefined;
    let receivedQuery: string | undefined;
    mock.server.use(
      http.delete(
        "/v1/dataset_evaluators/{dataset_evaluator_id}",
        ({ params, request, response }) => {
          receivedId = params.dataset_evaluator_id;
          receivedQuery = new URL(request.url).search;
          return response(204).empty();
        }
      )
    );
    captureCliOutput();

    await createDatasetEvaluatorCommand().parseAsync(
      ["delete", BINDING_ID, "--yes", ...BASE_ARGS],
      { from: "user" }
    );

    expect(receivedId).toBe(BINDING_ID);
    expect(receivedQuery).toBe("");
  });

  it("DELETEs several ids from the dataset's collection", async () => {
    let receivedIdentifier: string | undefined;
    let receivedIds: string[] = [];
    mock.server.use(
      http.delete(
        "/v1/datasets/{dataset_identifier}/evaluators",
        ({ params, request, response }) => {
          receivedIdentifier = params.dataset_identifier;
          receivedIds = new URL(request.url).searchParams.getAll(
            "dataset_evaluator_id"
          );
          return response(204).empty();
        }
      )
    );
    captureCliOutput();

    await createDatasetEvaluatorCommand().parseAsync(
      [
        "delete",
        "a",
        "b",
        "--dataset",
        "golden-questions",
        "--yes",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(receivedIdentifier).toBe("golden-questions");
    expect(receivedIds).toEqual(["a", "b"]);
  });

  it("requires --dataset to delete several ids", async () => {
    const requests = recordRequests(mock.server);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createDatasetEvaluatorCommand().parseAsync(
        ["delete", "a", "b", "--yes", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(requests).toEqual([]);
  });

  it("exits INVALID_ARGUMENT when deletes are not enabled", async () => {
    delete process.env[ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES];
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createDatasetEvaluatorCommand().parseAsync(
        ["delete", BINDING_ID, "--yes", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
  });

  it("prints a refusal as structured JSON in raw mode", async () => {
    mock.server.use(
      http.delete(
        "/v1/dataset_evaluators/{dataset_evaluator_id}",
        () =>
          new Response(
            JSON.stringify({
              type: "urn:phoenix:problem:conflict",
              title: "Conflict",
              status: 409,
              detail:
                "Evaluator is still bound by 1 project and 0 dataset bindings",
              code: "conflict",
              reason: "still_bound",
              binding_counts: { project: 1, dataset: 0 },
            }),
            {
              status: 409,
              headers: { "content-type": "application/problem+json" },
            }
          )
      )
    );
    const io = captureCliOutput();
    mockProcessExit();

    await expect(
      createDatasetEvaluatorCommand().parseAsync(
        ["delete", BINDING_ID, "--yes", "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow("process.exit:");

    const envelope = JSON.parse(String(io.stderr.mock.calls[0]?.[0]));
    expect(envelope).toMatchObject({
      status: 409,
      problem_code: "conflict",
      problem_reason: "still_bound",
    });
    expect(envelope.problem.binding_counts).toEqual({ project: 1, dataset: 0 });
  });
});

describe("dataset evaluator get", () => {
  it("GETs the binding by id and prints it as a single object", async () => {
    let receivedId: string | undefined;
    mock.server.use(
      http.get(
        "/v1/dataset_evaluators/{dataset_evaluator_id}",
        ({ params, response }) => {
          receivedId = params.dataset_evaluator_id;
          return response(200).json({ data: BINDING });
        }
      )
    );
    const io = captureCliOutput();

    await createDatasetEvaluatorCommand().parseAsync(
      ["get", BINDING_ID, "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    expect(receivedId).toBe(BINDING_ID);
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual(BINDING);
  });
});

describe("dataset evaluator list --limit", () => {
  it("rejects a non-positive --limit before contacting the server", async () => {
    let listed = false;
    mock.server.use(
      http.get(
        "/v1/datasets/{dataset_identifier}/evaluators",
        ({ response }) => {
          listed = true;
          return response(200).json({ data: [], next_cursor: null });
        }
      )
    );
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockProcessExit();

    await expect(
      createDatasetEvaluatorCommand().parseAsync(
        [
          "list",
          "golden-questions",
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
    const envelope = JSON.parse(String(stderrSpy.mock.calls[0]?.[0]));
    expect(envelope.code).toBe("INVALID_ARGUMENT");
  });
});
