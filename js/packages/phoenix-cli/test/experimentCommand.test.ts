import type { componentsV1 } from "@arizeai/phoenix-testing";
import { HttpResponse } from "@arizeai/phoenix-testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createExperimentCommand } from "../src/commands/experiment";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

// Hex string, so the CLI treats it as a dataset ID and skips name resolution.
const DATASET_ID = "abc123";

const EXPERIMENT: componentsV1["schemas"]["Experiment"] = {
  id: "exp-001",
  dataset_id: DATASET_ID,
  dataset_version_id: "dsv-001",
  name: "baseline",
  description: "baseline run",
  repetitions: 1,
  metadata: {},
  project_name: "demo-project",
  created_at: "2026-07-01T00:00:00+00:00",
  updated_at: "2026-07-01T00:00:00+00:00",
  example_count: 3,
  successful_run_count: 2,
  failed_run_count: 1,
  missing_run_count: 0,
};

const DATASET: componentsV1["schemas"]["Dataset"] = {
  id: DATASET_ID,
  name: "my-dataset",
  description: null,
  metadata: {},
  created_at: "2026-06-01T00:00:00+00:00",
  updated_at: "2026-06-01T00:00:00+00:00",
  example_count: 3,
};

/**
 * Register a handler for GET /v1/datasets/{dataset_id}/experiments that
 * answers with a single pinned experiment and records the requested dataset
 * ID and query parameters.
 */
function captureListExperimentsRequest() {
  const captured: {
    datasetId?: string;
    limit?: string | null;
    cursor?: string | null;
    count: number;
  } = { count: 0 };
  mock.server.use(
    http.get(
      "/v1/datasets/{dataset_id}/experiments",
      ({ params, request, response }) => {
        captured.count += 1;
        captured.datasetId = params.dataset_id;
        const searchParams = new URL(request.url).searchParams;
        captured.limit = searchParams.get("limit");
        captured.cursor = searchParams.get("cursor");
        return response(200).json({ data: [EXPERIMENT], next_cursor: null });
      }
    )
  );
  return captured;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("experiment list", () => {
  it("scopes the request to the dataset and prints experiments as raw JSON", async () => {
    const captured = captureListExperimentsRequest();
    const io = captureCliOutput();

    await createExperimentCommand().parseAsync(
      [
        "list",
        "--dataset",
        DATASET_ID,
        "--limit",
        "50",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    // A hex identifier is used as-is: exactly one request, no name lookup.
    expect(captured.count).toBe(1);
    expect(captured.datasetId).toBe(DATASET_ID);
    expect(captured.limit).toBe("50");

    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual([EXPERIMENT]);
  });

  it("resolves a dataset name via /v1/datasets before listing", async () => {
    const capturedName: { name?: string | null } = {};
    mock.server.use(
      http.get("/v1/datasets", ({ request, response }) => {
        capturedName.name = new URL(request.url).searchParams.get("name");
        return response(200).json({ data: [DATASET], next_cursor: null });
      })
    );
    const captured = captureListExperimentsRequest();
    const io = captureCliOutput();

    await createExperimentCommand().parseAsync(
      ["list", "--dataset", "my-dataset", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    expect(capturedName.name).toBe("my-dataset");
    expect(captured.datasetId).toBe(DATASET_ID);
    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(parsed).toEqual([EXPERIMENT]);
  });

  it("exits FAILURE with an error message on a server error", async () => {
    mock.server.use(
      http.get("/v1/datasets/{dataset_id}/experiments", ({ response }) =>
        response.untyped(HttpResponse.json({}, { status: 404 }))
      )
    );
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createExperimentCommand().parseAsync(
        ["list", "--dataset", DATASET_ID, "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error fetching experiments")
    );
  });

  it("exits NETWORK_ERROR when the connection fails", async () => {
    mock.server.use(
      http.get("/v1/datasets/{dataset_id}/experiments", () =>
        HttpResponse.error()
      )
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createExperimentCommand().parseAsync(
        ["list", "--dataset", DATASET_ID, "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
  });

  it("succeeds end-to-end against the generated OpenAPI handlers", async () => {
    // No pinned handler: the schema-generated mock answers everything. The
    // generated pages always carry a non-null next_cursor, so --limit 1 is
    // required to stop the CLI's pagination loop.
    const io = captureCliOutput();

    await createExperimentCommand().parseAsync(
      [
        "list",
        "--dataset",
        DATASET_ID,
        "--limit",
        "1",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const parsed = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    expect(typeof parsed[0].id).toBe("string");
    expect(typeof parsed[0].dataset_id).toBe("string");
  });
});

describe("experiment get", () => {
  it("downloads the experiment JSON by ID and prints it compact in raw mode", async () => {
    const runs = [
      {
        id: "run-1",
        example_id: "ex-1",
        repetition_number: 1,
        input: { question: "2+2?" },
        output: "4",
        error: null,
      },
    ];
    const captured: { experimentId?: string; count: number } = { count: 0 };
    mock.server.use(
      http.get(
        "/v1/experiments/{experiment_id}/json",
        ({ params, response }) => {
          captured.count += 1;
          captured.experimentId = params.experiment_id;
          return response(200).text(JSON.stringify(runs, null, 2));
        }
      )
    );
    const io = captureCliOutput();

    await createExperimentCommand().parseAsync(
      ["get", "exp-001", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    expect(captured.count).toBe(1);
    expect(captured.experimentId).toBe("exp-001");
    // Raw mode re-serializes the payload as compact JSON.
    expect(io.stdout).toHaveBeenCalledWith(JSON.stringify(runs));
  });

  it("exits FAILURE when the experiment does not exist", async () => {
    mock.server.use(
      http.get("/v1/experiments/{experiment_id}/json", ({ response }) =>
        response(404).text("Experiment not found")
      )
    );
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createExperimentCommand().parseAsync(
        ["get", "missing", "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error fetching experiment")
    );
  });
});
