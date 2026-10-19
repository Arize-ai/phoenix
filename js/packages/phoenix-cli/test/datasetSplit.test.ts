import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { type componentsV1, HttpResponse } from "@arizeai/phoenix-testing";
import type * as ClackPrompts from "@clack/prompts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { confirmMock } = vi.hoisted(() => ({ confirmMock: vi.fn() }));

vi.mock("@clack/prompts", async (importOriginal) => ({
  ...(await importOriginal<typeof ClackPrompts>()),
  confirm: confirmMock,
}));

import { createDatasetCommand } from "../src/commands/dataset";
import {
  formatDatasetSplitDeleteOutput,
  formatDatasetSplitOutput,
} from "../src/commands/formatDatasetSplit";
import { ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES } from "../src/confirm";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

type DatasetSplit = componentsV1["schemas"]["DatasetSplit"];

const DATASET_NAME = "qa-golden";
const DATASET_ID = "RGF0YXNldDox";
const SPLIT_ID = "RGF0YXNldFNwbGl0OjE=";
const EXAMPLE_IDS = ["RGF0YXNldEV4YW1wbGU6MQ==", "user-example-2"];

const SPLIT_FIXTURE: DatasetSplit = {
  id: SPLIT_ID,
  name: "train",
  description: "Training examples",
  color: "#33c5e8",
  metadata: { owner: "evals" },
  example_count: 2,
  created_at: "2026-10-01T00:00:00+00:00",
  updated_at: "2026-10-01T00:00:00+00:00",
};

let tmpDir: string;
const originalIsTTY = process.stdin.isTTY;

function setStdinIsTTY(value: boolean | undefined) {
  Object.defineProperty(process.stdin, "isTTY", {
    value,
    configurable: true,
  });
}

beforeEach(() => {
  // Keep a developer's real `~/.px/settings.json` out of config resolution.
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-split-test-"));
  vi.stubEnv("XDG_CONFIG_HOME", tmpDir);
  vi.stubEnv(ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES, "true");
  // The split client helpers check the server version before each request.
  mock.server.use(
    http.get("/arize_phoenix_version", ({ response }) =>
      response.untyped(new Response("19.20.0", { status: 200 }))
    )
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  confirmMock.mockReset();
  setStdinIsTTY(originalIsTTY);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function run(args: string[]) {
  return createDatasetCommand().parseAsync(["split", ...args], {
    from: "user",
  });
}

/** Capture POST /v1/datasets/{dataset_identifier}/splits requests. */
function captureCreate(split: DatasetSplit = SPLIT_FIXTURE) {
  const captured: {
    calls: number;
    datasetIdentifier?: string;
    body?: unknown;
  } = { calls: 0 };
  mock.server.use(
    http.post(
      "/v1/datasets/{dataset_identifier}/splits",
      async ({ params, request, response }) => {
        captured.calls += 1;
        captured.datasetIdentifier = params.dataset_identifier;
        captured.body = await request.json();
        return response(201).json({ data: split });
      }
    )
  );
  return captured;
}

/** Capture PATCH /v1/datasets/{dataset_identifier}/splits/{split_id} requests. */
function captureUpdate(split: DatasetSplit = SPLIT_FIXTURE) {
  const captured: {
    calls: number;
    datasetIdentifier?: string;
    splitId?: string;
    body?: unknown;
  } = { calls: 0 };
  mock.server.use(
    http.patch(
      "/v1/datasets/{dataset_identifier}/splits/{split_id}",
      async ({ params, request, response }) => {
        captured.calls += 1;
        captured.datasetIdentifier = params.dataset_identifier;
        captured.splitId = params.split_id;
        captured.body = await request.json();
        return response(200).json({ data: split });
      }
    )
  );
  return captured;
}

/** Capture DELETE /v1/datasets/{dataset_identifier}/splits/{split_id} requests. */
function captureDelete() {
  const captured: {
    calls: number;
    datasetIdentifier?: string;
    splitId?: string;
  } = { calls: 0 };
  mock.server.use(
    http.delete(
      "/v1/datasets/{dataset_identifier}/splits/{split_id}",
      ({ params, response }) => {
        captured.calls += 1;
        captured.datasetIdentifier = params.dataset_identifier;
        captured.splitId = params.split_id;
        return response(204).empty();
      }
    )
  );
  return captured;
}

/** Answer every split route with the given status and plain-text detail. */
function respondWithError(status: number, message: string) {
  mock.server.use(
    http.post("/v1/datasets/{dataset_identifier}/splits", ({ response }) =>
      response.untyped(new HttpResponse(message, { status }))
    ),
    http.patch(
      "/v1/datasets/{dataset_identifier}/splits/{split_id}",
      ({ response }) => response.untyped(new HttpResponse(message, { status }))
    ),
    http.delete(
      "/v1/datasets/{dataset_identifier}/splits/{split_id}",
      ({ response }) => response.untyped(new HttpResponse(message, { status }))
    )
  );
}

const CREATE_ARGS = ["create", DATASET_NAME, "--name", "train", ...BASE_ARGS];
const UPDATE_ARGS = ["update", DATASET_NAME, SPLIT_ID, ...BASE_ARGS];
const DELETE_ARGS = ["delete", DATASET_NAME, SPLIT_ID, ...BASE_ARGS, "--yes"];

describe("dataset split create", () => {
  it("POSTs the name, description, metadata, and example IDs and prints the split", async () => {
    const captured = captureCreate();
    const io = captureCliOutput();

    await run([
      ...CREATE_ARGS,
      "--description",
      "Training examples",
      "--metadata",
      '{"owner":"evals"}',
      "--example-id",
      EXAMPLE_IDS[0]!,
      "--example-id",
      EXAMPLE_IDS[1]!,
      "--format",
      "raw",
    ]);

    expect(captured.calls).toBe(1);
    expect(captured.datasetIdentifier).toBe(DATASET_NAME);
    expect(captured.body).toEqual({
      name: "train",
      description: "Training examples",
      metadata: { owner: "evals" },
      example_ids: EXAMPLE_IDS,
    });
    expect(io.stdout).toHaveBeenCalledTimes(1);
    expect(io.stdout.mock.calls[0]?.[0]).toBe(JSON.stringify(SPLIT_FIXTURE));
  });

  it("sends only the name when no optional flags are given", async () => {
    const captured = captureCreate();
    captureCliOutput();

    await run(CREATE_ARGS);

    expect(captured.body).toEqual({ name: "train" });
  });

  it("passes a dataset GlobalID through without a name lookup", async () => {
    // Unhandled requests fail the test, so a GET /v1/datasets lookup would too.
    const captured = captureCreate();
    captureCliOutput();

    await run(["create", DATASET_ID, "--name", "train", ...BASE_ARGS]);

    expect(captured.datasetIdentifier).toBe(DATASET_ID);
  });

  it("exposes the created split ID in --format json", async () => {
    captureCreate();
    const io = captureCliOutput();

    await run([...CREATE_ARGS, "--format", "json"]);

    const output = io.stdout.mock.calls[0]?.[0] as string;
    expect(output).toContain("\n");
    expect(JSON.parse(output).id).toBe(SPLIT_ID);
  });

  it("prints a table with the split ID by default", async () => {
    captureCreate();
    const io = captureCliOutput();

    await run(CREATE_ARGS);

    const output = io.stdout.mock.calls[0]?.[0] as string;
    expect(output).toContain(SPLIT_ID);
    expect(output).toContain("train");
  });

  it("exits INVALID_ARGUMENT before any request when --name is missing", async () => {
    const captured = captureCreate();
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      run(["create", DATASET_NAME, ...BASE_ARGS, "--format", "json"])
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(JSON.parse(io.stderr.mock.calls[0]?.[0] as string)).toMatchObject({
      error: "Missing required flag --name",
      code: "INVALID_ARGUMENT",
    });
    expect(captured.calls).toBe(0);
  });

  it.each([
    ["not JSON", "{owner: evals}"],
    ["an array", '["a"]'],
    ["null", "null"],
    ["a string", '"evals"'],
  ])(
    "exits INVALID_ARGUMENT before any request when --metadata is %s",
    async (_kind, metadata) => {
      const captured = captureCreate();
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(
        run([...CREATE_ARGS, "--metadata", metadata, "--format", "raw"])
      ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

      expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
      expect(JSON.parse(io.stderr.mock.calls[0]?.[0] as string)).toMatchObject({
        error: expect.stringContaining("--metadata must be a JSON object"),
        code: "INVALID_ARGUMENT",
      });
      expect(captured.calls).toBe(0);
    }
  );

  it.each([
    [401, "Unauthorized", ExitCode.AUTH_REQUIRED, "AUTH_REQUIRED"],
    [403, "Forbidden", ExitCode.AUTH_REQUIRED, "AUTH_REQUIRED"],
    [
      422,
      "Dataset split name cannot be empty",
      ExitCode.INVALID_ARGUMENT,
      "INVALID_ARGUMENT",
    ],
    [404, "Dataset with name qa-golden not found", ExitCode.FAILURE, "FAILURE"],
    [
      409,
      "A dataset split named 'train' already exists",
      ExitCode.FAILURE,
      "FAILURE",
    ],
  ])(
    "maps a %i response to its exit code and reports the server detail",
    async (status, message, exitCode, code) => {
      respondWithError(status, message);
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(run([...CREATE_ARGS, "--format", "raw"])).rejects.toThrow(
        `process.exit:${exitCode}`
      );

      expect(exitSpy).toHaveBeenCalledWith(exitCode);
      expect(io.stdout).not.toHaveBeenCalled();
      expect(JSON.parse(io.stderr.mock.calls[0]?.[0] as string)).toMatchObject({
        error: `Error creating dataset split: ${message}`,
        code,
      });
    }
  );

  it("exits NETWORK_ERROR when the connection fails", async () => {
    mock.server.use(
      http.post("/v1/datasets/{dataset_identifier}/splits", () =>
        HttpResponse.error()
      )
    );
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(run(CREATE_ARGS)).rejects.toThrow(
      `process.exit:${ExitCode.NETWORK_ERROR}`
    );

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
    expect(io.stdout).not.toHaveBeenCalled();
  });
});

describe("dataset split update", () => {
  it("PATCHes every provided field and prints the updated split", async () => {
    const captured = captureUpdate();
    const io = captureCliOutput();

    await run([
      ...UPDATE_ARGS,
      "--name",
      "train-v2",
      "--description",
      "Refreshed",
      "--metadata",
      '{"owner":"evals","round":2}',
      "--add-example",
      EXAMPLE_IDS[0]!,
      "--add-example",
      EXAMPLE_IDS[1]!,
      "--remove-example",
      "user-example-3",
      "--format",
      "raw",
    ]);

    expect(captured.calls).toBe(1);
    expect(captured.datasetIdentifier).toBe(DATASET_NAME);
    expect(captured.splitId).toBe(SPLIT_ID);
    expect(captured.body).toEqual({
      name: "train-v2",
      description: "Refreshed",
      metadata: { owner: "evals", round: 2 },
      add_example_ids: EXAMPLE_IDS,
      remove_example_ids: ["user-example-3"],
    });
    expect(io.stdout.mock.calls[0]?.[0]).toBe(JSON.stringify(SPLIT_FIXTURE));
  });

  it("sends only the fields that were passed", async () => {
    const captured = captureUpdate();
    captureCliOutput();

    await run([...UPDATE_ARGS, "--remove-example", EXAMPLE_IDS[0]!]);

    expect(captured.body).toEqual({ remove_example_ids: [EXAMPLE_IDS[0]] });
  });

  it("sends an empty description so the server clears it", async () => {
    const captured = captureUpdate();
    captureCliOutput();

    await run([...UPDATE_ARGS, "--description", ""]);

    expect(captured.body).toEqual({ description: "" });
  });

  it("exposes the updated split ID in --format json", async () => {
    captureUpdate();
    const io = captureCliOutput();

    await run([...UPDATE_ARGS, "--name", "train-v2", "--format", "json"]);

    expect(JSON.parse(io.stdout.mock.calls[0]?.[0] as string).id).toBe(
      SPLIT_ID
    );
  });

  it("exits INVALID_ARGUMENT before any request when no fields are given", async () => {
    const captured = captureUpdate();
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(run([...UPDATE_ARGS, "--format", "raw"])).rejects.toThrow(
      `process.exit:${ExitCode.INVALID_ARGUMENT}`
    );

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(JSON.parse(io.stderr.mock.calls[0]?.[0] as string)).toMatchObject({
      error: "No fields to update were provided",
      code: "INVALID_ARGUMENT",
    });
    expect(captured.calls).toBe(0);
  });

  it("exits INVALID_ARGUMENT before any request when --metadata is not an object", async () => {
    const captured = captureUpdate();
    captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(run([...UPDATE_ARGS, "--metadata", "[1,2]"])).rejects.toThrow(
      `process.exit:${ExitCode.INVALID_ARGUMENT}`
    );

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.calls).toBe(0);
  });

  it.each([
    [422, `Invalid dataset split ID: ${SPLIT_ID}`, ExitCode.INVALID_ARGUMENT],
    [404, `Dataset split with ID ${SPLIT_ID} not found`, ExitCode.FAILURE],
    [403, "Forbidden", ExitCode.AUTH_REQUIRED],
  ])(
    "maps a %i response to its exit code",
    async (status, message, exitCode) => {
      respondWithError(status, message);
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(run([...UPDATE_ARGS, "--name", "x"])).rejects.toThrow(
        `process.exit:${exitCode}`
      );

      expect(exitSpy).toHaveBeenCalledWith(exitCode);
      expect(io.stderr).toHaveBeenCalledWith(
        expect.stringContaining(`Error updating dataset split: ${message}`)
      );
    }
  );
});

describe("dataset split delete", () => {
  it("calls only DELETE on the split and prints a raw record", async () => {
    // Unhandled requests fail the test, so no example route can be reached.
    const captured = captureDelete();
    const io = captureCliOutput();

    await run([...DELETE_ARGS, "--format", "raw"]);

    expect(captured.calls).toBe(1);
    expect(captured.datasetIdentifier).toBe(DATASET_NAME);
    expect(captured.splitId).toBe(SPLIT_ID);
    expect(io.stdout.mock.calls[0]?.[0]).toBe(
      JSON.stringify({
        deleted: true,
        dataset: DATASET_NAME,
        split_id: SPLIT_ID,
      })
    );
  });

  it("prints a human-readable confirmation by default", async () => {
    captureDelete();
    const io = captureCliOutput();

    await run(DELETE_ARGS);

    expect(io.stdout.mock.calls[0]?.[0]).toBe(
      `Deleted dataset split ${SPLIT_ID}. Examples were not deleted.`
    );
  });

  it("asks for confirmation without --yes and deletes once confirmed", async () => {
    const captured = captureDelete();
    captureCliOutput();
    setStdinIsTTY(true);
    confirmMock.mockResolvedValue(true);

    await run(["delete", DATASET_NAME, SPLIT_ID, ...BASE_ARGS]);

    expect(confirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(`Delete dataset split ${SPLIT_ID}?`),
      })
    );
    expect(captured.calls).toBe(1);
  });

  it("exits CANCELLED without calling the API when confirmation is declined", async () => {
    const captured = captureDelete();
    captureCliOutput();
    setStdinIsTTY(true);
    confirmMock.mockResolvedValue(false);
    const exitSpy = mockProcessExit();

    await expect(
      run(["delete", DATASET_NAME, SPLIT_ID, ...BASE_ARGS])
    ).rejects.toThrow("process.exit:");

    // The mocked exit throws, so the handler's catch exits again; the first
    // call is the one a real process would stop at.
    expect(exitSpy).toHaveBeenNthCalledWith(1, ExitCode.CANCELLED);
    expect(captured.calls).toBe(0);
  });

  it("exits INVALID_ARGUMENT without --yes when stdin is not a TTY", async () => {
    const captured = captureDelete();
    captureCliOutput();
    setStdinIsTTY(false);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const exitSpy = mockProcessExit();

    await expect(
      run(["delete", DATASET_NAME, SPLIT_ID, ...BASE_ARGS])
    ).rejects.toThrow("process.exit:");

    expect(exitSpy).toHaveBeenNthCalledWith(1, ExitCode.INVALID_ARGUMENT);
    expect(confirmMock).not.toHaveBeenCalled();
    expect(captured.calls).toBe(0);
  });

  it("exits INVALID_ARGUMENT before any request when deletes are disabled", async () => {
    vi.stubEnv(ENV_PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES, "false");
    const captured = captureDelete();
    captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(run(DELETE_ARGS)).rejects.toThrow(
      `process.exit:${ExitCode.INVALID_ARGUMENT}`
    );

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.calls).toBe(0);
  });

  it.each([
    [404, `Dataset split with ID ${SPLIT_ID} not found`, ExitCode.FAILURE],
    [422, `Invalid dataset split ID: ${SPLIT_ID}`, ExitCode.INVALID_ARGUMENT],
    [401, "Unauthorized", ExitCode.AUTH_REQUIRED],
  ])(
    "maps a %i response to its exit code",
    async (status, message, exitCode) => {
      respondWithError(status, message);
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();

      await expect(run(DELETE_ARGS)).rejects.toThrow(
        `process.exit:${exitCode}`
      );

      expect(exitSpy).toHaveBeenCalledWith(exitCode);
      expect(io.stdout).not.toHaveBeenCalled();
      expect(io.stderr).toHaveBeenCalledWith(
        expect.stringContaining(`Error deleting dataset split: ${message}`)
      );
    }
  );
});

describe("dataset split help", () => {
  it("points split listing to #12090", () => {
    const split = createDatasetCommand().commands.find(
      (command) => command.name() === "split"
    );

    expect(split?.commands.map((command) => command.name())).toEqual([
      "create",
      "update",
      "delete",
    ]);
    // `addHelpText` output is only written by `outputHelp`, not returned by
    // `helpInformation`.
    let help = "";
    split?.configureOutput({ writeOut: (text) => (help += text) });
    split?.outputHelp();
    expect(help).toContain("https://github.com/Arize-ai/phoenix/issues/12090");
  });
});

describe("formatDatasetSplitOutput", () => {
  it("renders compact JSON for raw and indented JSON for json", () => {
    expect(
      formatDatasetSplitOutput({ split: SPLIT_FIXTURE, format: "raw" })
    ).toBe(JSON.stringify(SPLIT_FIXTURE));
    expect(
      formatDatasetSplitOutput({ split: SPLIT_FIXTURE, format: "json" })
    ).toBe(JSON.stringify(SPLIT_FIXTURE, null, 2));
  });

  it("defaults to a pretty table", () => {
    const output = formatDatasetSplitOutput({ split: SPLIT_FIXTURE });
    expect(output).toContain("train");
    expect(output).toContain(SPLIT_ID);
    expect(output).toContain("Training examples");
  });
});

describe("formatDatasetSplitDeleteOutput", () => {
  const result = {
    deleted: true as const,
    dataset: DATASET_NAME,
    split_id: SPLIT_ID,
  };

  it("defaults to pretty output", () => {
    expect(formatDatasetSplitDeleteOutput({ result })).toBe(
      `Deleted dataset split ${SPLIT_ID}. Examples were not deleted.`
    );
  });

  it("renders compact JSON for raw and indented JSON for json", () => {
    expect(formatDatasetSplitDeleteOutput({ result, format: "raw" })).toBe(
      JSON.stringify(result)
    );
    expect(formatDatasetSplitDeleteOutput({ result, format: "json" })).toBe(
      JSON.stringify(result, null, 2)
    );
  });
});
