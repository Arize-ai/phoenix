import type { componentsV1 } from "@arizeai/phoenix-testing";
import { HttpResponse } from "@arizeai/phoenix-testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDatasetCommand } from "../src/commands/dataset";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

type Dataset = componentsV1["schemas"]["Dataset"];
type DatasetExample = componentsV1["schemas"]["DatasetExample"];

const mock = setupMockPhoenixServer();

// A hex identifier is treated as a dataset ID directly, skipping the
// `/v1/datasets?name=...` name-resolution round-trip.
const DATASET_ID = "abc123";

const DATASET_GOLDEN: Dataset = {
  id: DATASET_ID,
  name: "golden-set",
  description: "Curated regression examples",
  metadata: {},
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-15T00:00:00.000Z",
  example_count: 2,
};

const DATASET_SCRATCH: Dataset = {
  id: "def456",
  name: "scratch",
  description: null,
  metadata: {},
  created_at: "2026-06-02T00:00:00.000Z",
  updated_at: "2026-06-02T00:00:00.000Z",
  example_count: 0,
};

const EXAMPLE_ONE: DatasetExample = {
  id: "RGF0YXNldEV4YW1wbGU6MQ==",
  node_id: "RGF0YXNldEV4YW1wbGU6MQ==",
  input: { question: "What is Phoenix?" },
  output: { answer: "An AI observability platform" },
  metadata: { split: "train" },
  updated_at: "2026-06-15T00:00:00.000Z",
};

const EXAMPLE_TWO: DatasetExample = {
  id: "RGF0YXNldEV4YW1wbGU6Mg==",
  node_id: "RGF0YXNldEV4YW1wbGU6Mg==",
  input: { question: "What is a span?" },
  output: { answer: "A unit of work in a trace" },
  metadata: { split: "train" },
  updated_at: "2026-06-15T00:00:00.000Z",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dataset list", () => {
  it("outputs pinned datasets in raw mode and propagates --limit", async () => {
    let capturedQuery: URLSearchParams | undefined;
    mock.server.use(
      http.get("/v1/datasets", ({ request, response }) => {
        capturedQuery = new URL(request.url).searchParams;
        return response(200).json({
          data: [DATASET_GOLDEN, DATASET_SCRATCH],
          next_cursor: null,
        });
      })
    );
    const io = captureCliOutput();

    await createDatasetCommand().parseAsync(
      ["list", "--format", "raw", "--limit", "50", ...BASE_ARGS],
      { from: "user" }
    );

    expect(capturedQuery?.get("limit")).toBe("50");
    expect(capturedQuery?.get("cursor")).toBeNull();

    const output = io.stdout.mock.calls[0]?.[0];
    const datasets = JSON.parse(String(output));
    expect(datasets).toEqual([DATASET_GOLDEN, DATASET_SCRATCH]);
  });

  it("follows next_cursor across pages", async () => {
    const capturedCursors: Array<string | null> = [];
    let page = 0;
    mock.server.use(
      http.get("/v1/datasets", ({ request, response }) => {
        capturedCursors.push(new URL(request.url).searchParams.get("cursor"));
        page += 1;
        if (page === 1) {
          return response(200).json({
            data: [DATASET_GOLDEN],
            next_cursor: "cursor-page-2",
          });
        }
        return response(200).json({
          data: [DATASET_SCRATCH],
          next_cursor: null,
        });
      })
    );
    const io = captureCliOutput();

    await createDatasetCommand().parseAsync(
      ["list", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    expect(capturedCursors).toEqual([null, "cursor-page-2"]);
    const output = io.stdout.mock.calls[0]?.[0];
    const datasets = JSON.parse(String(output));
    expect(datasets.map((d: Dataset) => d.name)).toEqual([
      "golden-set",
      "scratch",
    ]);
  });

  it("exits NETWORK_ERROR when the request fails at the network level", async () => {
    mock.server.use(http.get("/v1/datasets", () => HttpResponse.error()));
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createDatasetCommand().parseAsync(
        ["list", "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
    expect(String(io.stderr.mock.calls[0]?.[0])).toContain(
      "Error fetching datasets"
    );
  });

  it("completes end-to-end against the generated OpenAPI handlers", async () => {
    // No pinned handlers: every response comes from the schema-generated mocks.
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await createDatasetCommand().parseAsync(
      ["list", "--format", "raw", "--limit", "2", ...BASE_ARGS],
      { from: "user" }
    );

    expect(exitSpy).not.toHaveBeenCalled();
    const output = io.stdout.mock.calls[0]?.[0];
    const datasets = JSON.parse(String(output));
    expect(Array.isArray(datasets)).toBe(true);
    expect(datasets.length).toBeGreaterThan(0);
    expect(typeof datasets[0].id).toBe("string");
  });
});

describe("dataset get", () => {
  it("resolves a dataset name to an ID and propagates version and split", async () => {
    let capturedResolutionQuery: URLSearchParams | undefined;
    let capturedExamplesId: string | undefined;
    let capturedExamplesQuery: URLSearchParams | undefined;
    mock.server.use(
      // Name resolution: a non-hex identifier is looked up by name.
      http.get("/v1/datasets", ({ request, response }) => {
        capturedResolutionQuery = new URL(request.url).searchParams;
        return response(200).json({
          data: [DATASET_GOLDEN],
          next_cursor: null,
        });
      }),
      // Dataset metadata fetch (for the display name).
      http.get("/v1/datasets/{id}", ({ response }) =>
        response(200).json({ data: DATASET_GOLDEN })
      ),
      http.get(
        "/v1/datasets/{id}/examples",
        ({ params, request, response }) => {
          capturedExamplesId = params.id;
          capturedExamplesQuery = new URL(request.url).searchParams;
          return response(200).json({
            data: {
              dataset_id: DATASET_ID,
              version_id: "version-007",
              filtered_splits: ["train"],
              examples: [EXAMPLE_ONE, EXAMPLE_TWO],
            },
          });
        }
      )
    );
    const io = captureCliOutput();

    await createDatasetCommand().parseAsync(
      [
        "get",
        "golden-set",
        "--format",
        "raw",
        "--version",
        "version-007",
        "--split",
        "train",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(capturedResolutionQuery?.get("name")).toBe("golden-set");
    expect(capturedResolutionQuery?.get("limit")).toBe("1");
    expect(capturedExamplesId).toBe(DATASET_ID);
    expect(capturedExamplesQuery?.get("version_id")).toBe("version-007");
    expect(capturedExamplesQuery?.getAll("split")).toEqual(["train"]);

    const output = io.stdout.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(output));
    expect(parsed).toEqual({
      dataset_id: DATASET_ID,
      version_id: "version-007",
      filtered_splits: ["train"],
      examples: [EXAMPLE_ONE, EXAMPLE_TWO],
    });
  });

  it("skips name resolution when the identifier is a hex ID", async () => {
    let resolutionCalls = 0;
    mock.server.use(
      http.get("/v1/datasets", ({ response }) => {
        resolutionCalls += 1;
        return response(200).json({ data: [], next_cursor: null });
      }),
      http.get("/v1/datasets/{id}", ({ response }) =>
        response(200).json({ data: DATASET_GOLDEN })
      ),
      http.get("/v1/datasets/{id}/examples", ({ params, response }) =>
        response(200).json({
          data: {
            dataset_id: params.id,
            version_id: "version-latest",
            examples: [EXAMPLE_ONE],
          },
        })
      )
    );
    const io = captureCliOutput();

    await createDatasetCommand().parseAsync(
      ["get", DATASET_ID, "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    expect(resolutionCalls).toBe(0);
    const output = io.stdout.mock.calls[0]?.[0];
    const parsed = JSON.parse(String(output));
    expect(parsed.dataset_id).toBe(DATASET_ID);
    expect(parsed.examples).toEqual([EXAMPLE_ONE]);
  });

  it("exits FAILURE with an error on stderr when the name matches no dataset", async () => {
    mock.server.use(
      http.get("/v1/datasets", ({ response }) =>
        response(200).json({ data: [], next_cursor: null })
      )
    );
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createDatasetCommand().parseAsync(
        ["get", "no-such-dataset", "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    const stderrCall = String(io.stderr.mock.calls[0]?.[0]);
    expect(stderrCall).toContain("Error fetching dataset");
    expect(stderrCall).toContain('Dataset not found: "no-such-dataset"');
  });

  it("exits NETWORK_ERROR when the examples request fails at the network level", async () => {
    mock.server.use(
      // The display-name fetch swallows its own errors, so only the examples
      // request needs to fail to exercise the network error path.
      http.get("/v1/datasets/{id}/examples", () => HttpResponse.error())
    );
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();

    await expect(
      createDatasetCommand().parseAsync(
        ["get", DATASET_ID, "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
    expect(String(io.stderr.mock.calls[0]?.[0])).toContain(
      "Error fetching dataset"
    );
  });
});
