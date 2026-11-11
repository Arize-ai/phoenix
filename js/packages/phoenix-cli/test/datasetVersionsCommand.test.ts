import type { componentsV1 } from "@arizeai/phoenix-testing";
import { HttpResponse } from "@arizeai/phoenix-testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createProgram } from "../src/cli";
import { createDatasetCommand } from "../src/commands/dataset";
import { createDatasetVersionsCommand } from "../src/commands/datasetVersions";
import { formatDatasetVersionsOutput } from "../src/commands/formatDatasetVersions";
import * as config from "../src/config";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

// A hex identifier is treated as a dataset ID directly, skipping the
// `/v1/datasets?name=...` name-resolution round-trip.
const DATASET_ID = "abc123";
const DATASET_VERSION: componentsV1["schemas"]["DatasetVersion"] = {
  version_id: "RGF0YXNldFZlcnNpb246Mw==",
  description: "Added edge cases",
  metadata: { source: "ui" },
  created_at: "2026-10-14T10:00:00Z",
};
const OLDER_VERSION = {
  ...DATASET_VERSION,
  version_id: "RGF0YXNldFZlcnNpb246Mg==",
  description: null,
};
const OLDEST_VERSION = {
  ...DATASET_VERSION,
  version_id: "RGF0YXNldFZlcnNpb246MQ==",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dataset-versions list", () => {
  it("passes a dataset ID to the API and prints raw JSON", async () => {
    const ids: string[] = [];
    mock.server.use(
      http.get("/v1/datasets/{id}/versions", ({ params, response }) => {
        ids.push(params.id);
        return response(200).json({
          data: [DATASET_VERSION],
          next_cursor: null,
        });
      })
    );
    const io = captureCliOutput();
    await createDatasetVersionsCommand().parseAsync(
      ["list", DATASET_ID, "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );
    expect(ids).toEqual([DATASET_ID]);
    expect(io.stdout).toHaveBeenCalledWith(JSON.stringify([DATASET_VERSION]));
    expect(io.stderr).not.toHaveBeenCalled();
  });

  it("resolves a dataset name to its ID before listing versions", async () => {
    const names: (string | null)[] = [];
    const ids: string[] = [];
    mock.server.use(
      http.get("/v1/datasets", ({ request, response }) => {
        names.push(new URL(request.url).searchParams.get("name"));
        return response(200).json({
          data: [
            {
              id: DATASET_ID,
              name: "golden-set",
              description: null,
              metadata: {},
              created_at: "2026-06-01T00:00:00.000Z",
              updated_at: "2026-06-15T00:00:00.000Z",
              example_count: 2,
            },
          ],
          next_cursor: null,
        });
      }),
      http.get("/v1/datasets/{id}/versions", ({ params, response }) => {
        ids.push(params.id);
        return response(200).json({
          data: [DATASET_VERSION],
          next_cursor: null,
        });
      })
    );
    const io = captureCliOutput();
    await createDatasetVersionsCommand().parseAsync(
      ["list", "golden-set", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );
    expect(names).toEqual(["golden-set"]);
    expect(ids).toEqual([DATASET_ID]);
    expect(io.stdout).toHaveBeenCalledWith(JSON.stringify([DATASET_VERSION]));
  });

  it.each(["pretty", "json", "raw"] as const)(
    "exits FAILURE with a discovery hint for an unknown dataset name in %s output",
    async (format) => {
      let numVersionRequests = 0;
      mock.server.use(
        http.get("/v1/datasets", ({ response }) =>
          response(200).json({ data: [], next_cursor: null })
        ),
        http.get("/v1/datasets/{id}/versions", ({ response }) => {
          numVersionRequests += 1;
          return response(200).json({ data: [], next_cursor: null });
        })
      );
      const io = captureCliOutput();
      const exitSpy = mockProcessExit();
      await expect(
        createDatasetVersionsCommand().parseAsync(
          ["list", "missing", "--format", format, ...BASE_ARGS],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);
      expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
      expect(numVersionRequests).toBe(0);
      expect(io.stdout).not.toHaveBeenCalled();
      expect(io.stderr).toHaveBeenCalledTimes(1);
      const message = String(io.stderr.mock.calls[0]?.[0]);
      if (format === "pretty") {
        expect(message).toContain('Dataset not found: "missing"');
        expect(message).toContain("px dataset list");
      } else {
        expect(JSON.parse(message)).toEqual({
          error: expect.stringContaining('Dataset not found: "missing"'),
          code: "FAILURE",
          hint: "px dataset list",
        });
      }
    }
  );

  it("follows all cursors with a default page size of 100", async () => {
    const queries: { cursor: string | null; limit: string | null }[] = [];
    mock.server.use(
      http.get("/v1/datasets/{id}/versions", ({ request, response }) => {
        const query = new URL(request.url).searchParams;
        queries.push({
          cursor: query.get("cursor"),
          limit: query.get("limit"),
        });
        return response(200).json(
          query.has("cursor")
            ? { data: [OLDER_VERSION], next_cursor: null }
            : { data: [DATASET_VERSION], next_cursor: "next-page" }
        );
      })
    );
    const io = captureCliOutput();
    await createDatasetVersionsCommand().parseAsync(
      ["list", DATASET_ID, "--format", "json", ...BASE_ARGS],
      { from: "user" }
    );
    expect(queries).toEqual([
      { cursor: null, limit: "100" },
      { cursor: "next-page", limit: "100" },
    ]);
    expect(io.stdout).toHaveBeenCalledWith(
      JSON.stringify([DATASET_VERSION, OLDER_VERSION], null, 2)
    );
  });

  it("requests only the remaining limit and stops before the next page", async () => {
    const limits: string[] = [];
    mock.server.use(
      http.get("/v1/datasets/{id}/versions", ({ request, response }) => {
        limits.push(new URL(request.url).searchParams.get("limit")!);
        return response(200).json(
          limits.length === 1
            ? { data: [DATASET_VERSION], next_cursor: "second-page" }
            : { data: [OLDER_VERSION], next_cursor: "third-page" }
        );
      })
    );
    const io = captureCliOutput();
    await createDatasetVersionsCommand().parseAsync(
      ["list", DATASET_ID, "--limit", "2", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );
    expect(limits).toEqual(["2", "1"]);
    expect(JSON.parse(String(io.stdout.mock.calls[0]?.[0]))).toEqual([
      DATASET_VERSION,
      OLDER_VERSION,
    ]);
  });

  it("does not exceed the limit if a server returns an oversized page", async () => {
    mock.server.use(
      http.get("/v1/datasets/{id}/versions", ({ response }) =>
        response(200).json({
          data: [DATASET_VERSION, OLDER_VERSION, OLDEST_VERSION],
          next_cursor: "next-page",
        })
      )
    );
    const io = captureCliOutput();
    await createDatasetVersionsCommand().parseAsync(
      ["list", DATASET_ID, "--limit", "1", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );
    expect(io.stdout).toHaveBeenCalledWith(JSON.stringify([DATASET_VERSION]));
  });

  it.each(["pretty", "json", "raw"] as const)(
    "succeeds for a dataset with no versions in %s output",
    async (format) => {
      mock.server.use(
        http.get("/v1/datasets/{id}/versions", ({ response }) =>
          response(200).json({ data: [], next_cursor: null })
        )
      );
      const io = captureCliOutput();
      await createDatasetVersionsCommand().parseAsync(
        ["list", DATASET_ID, "--format", format, ...BASE_ARGS],
        { from: "user" }
      );
      expect(io.stdout).toHaveBeenCalledWith(
        format === "pretty" ? "No dataset versions found" : "[]"
      );
      expect(io.stderr).not.toHaveBeenCalled();
    }
  );

  it("accepts an empty final page after fetching versions", async () => {
    const cursors: (string | null)[] = [];
    mock.server.use(
      http.get("/v1/datasets/{id}/versions", ({ request, response }) => {
        const cursor = new URL(request.url).searchParams.get("cursor");
        cursors.push(cursor);
        return response(200).json(
          cursor
            ? { data: [], next_cursor: null }
            : { data: [DATASET_VERSION], next_cursor: "last-page" }
        );
      })
    );
    const io = captureCliOutput();
    await createDatasetVersionsCommand().parseAsync(
      ["list", DATASET_ID, "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );
    expect(cursors).toEqual([null, "last-page"]);
    expect(io.stdout).toHaveBeenCalledWith(JSON.stringify([DATASET_VERSION]));
    expect(io.stderr).not.toHaveBeenCalled();
  });

  it.each([404, 422, 500])("exits FAILURE on HTTP %i", async (status) => {
    mock.server.use(
      http.get("/v1/datasets/{id}/versions", ({ response }) =>
        response.untyped(HttpResponse.json({ error: "Failed" }, { status }))
      )
    );
    const io = captureCliOutput();
    const exitSpy = mockProcessExit();
    await expect(
      createDatasetVersionsCommand().parseAsync(
        ["list", DATASET_ID, ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);
    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    expect(io.stdout).not.toHaveBeenCalled();
    expect(io.stderr).toHaveBeenCalledWith(
      expect.stringContaining("Error fetching dataset versions")
    );
  });

  it.each(["json", "raw"] as const)(
    "writes structured HTTP errors without a hint in %s output",
    async (format) => {
      mock.server.use(
        http.get("/v1/datasets/{id}/versions", ({ response }) =>
          response.untyped(
            HttpResponse.json({ error: "Failed" }, { status: 500 })
          )
        )
      );
      const io = captureCliOutput();
      mockProcessExit();
      await expect(
        createDatasetVersionsCommand().parseAsync(
          ["list", DATASET_ID, "--format", format, ...BASE_ARGS],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);
      expect(io.stdout).not.toHaveBeenCalled();
      expect(io.stderr).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String(io.stderr.mock.calls[0]?.[0]))).toEqual({
        error: expect.stringContaining("Error fetching dataset versions"),
        code: "FAILURE",
      });
    }
  );

  it.each(["pretty", "json", "raw"] as const)(
    "exits NETWORK_ERROR on a connection failure in %s output",
    async (format) => {
      mock.server.use(
        http.get("/v1/datasets/{id}/versions", () => HttpResponse.error())
      );
      const io = captureCliOutput();
      mockProcessExit();
      await expect(
        createDatasetVersionsCommand().parseAsync(
          ["list", DATASET_ID, "--format", format, ...BASE_ARGS],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.NETWORK_ERROR}`);
      expect(io.stdout).not.toHaveBeenCalled();
      if (format !== "pretty") {
        expect(JSON.parse(String(io.stderr.mock.calls[0]?.[0]))).toEqual({
          error: expect.stringContaining("Error fetching dataset versions"),
          code: "NETWORK_ERROR",
        });
      }
    }
  );

  it.each(["0", "-1", "1.5", "abc", "2oops"])(
    "rejects invalid limit %s without making a request",
    async (limit) => {
      let numRequests = 0;
      mock.server.use(
        http.get("/v1/datasets/{id}/versions", ({ response }) => {
          numRequests += 1;
          return response(200).json({
            data: [DATASET_VERSION],
            next_cursor: null,
          });
        })
      );
      const io = captureCliOutput();
      mockProcessExit();
      await expect(
        createDatasetVersionsCommand().parseAsync(
          ["list", DATASET_ID, "--limit", limit, ...BASE_ARGS],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);
      expect(io.stderr).toHaveBeenCalledWith(
        expect.stringContaining("--limit must be a positive integer")
      );
      expect(numRequests).toBe(0);
    }
  );

  it.each(["json", "raw"] as const)(
    "writes structured invalid-limit errors with an invocation hint in %s output",
    async (format) => {
      const io = captureCliOutput();
      mockProcessExit();
      await expect(
        createDatasetVersionsCommand().parseAsync(
          [
            "list",
            DATASET_ID,
            "--limit",
            "0",
            "--format",
            format,
            ...BASE_ARGS,
          ],
          { from: "user" }
        )
      ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);
      expect(io.stdout).not.toHaveBeenCalled();
      expect(io.stderr).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String(io.stderr.mock.calls[0]?.[0]))).toEqual({
        error: expect.stringContaining("--limit must be a positive integer"),
        code: "INVALID_ARGUMENT",
        hint: "px dataset-versions list <dataset-identifier> --limit <number>",
      });
    }
  );

  it("exits INVALID_ARGUMENT for missing configuration", async () => {
    vi.spyOn(config, "resolveConfig").mockReturnValue({});
    const io = captureCliOutput();
    mockProcessExit();
    await expect(
      createDatasetVersionsCommand().parseAsync(["list", DATASET_ID], {
        from: "user",
      })
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);
    expect(io.stderr).toHaveBeenCalledWith(
      expect.stringContaining("--endpoint")
    );
  });

  it("works through the registered command against generated handlers alone", async () => {
    const io = captureCliOutput();
    await createProgram().parseAsync(
      [
        "dataset-versions",
        "list",
        DATASET_ID,
        "--limit",
        "1",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );
    const versions = JSON.parse(String(io.stdout.mock.calls[0]?.[0]));
    expect(versions).toHaveLength(1);
    expect(typeof versions[0].version_id).toBe("string");
    expect(typeof versions[0].created_at).toBe("string");
  });

  it("includes examples and the dataset get discovery pointer in help", () => {
    const command = createDatasetVersionsCommand();
    let help = "";
    command.commands[0].configureOutput({
      writeOut: (text) => {
        help += text;
      },
    });
    command.commands[0].outputHelp();
    expect(help).toContain("px dataset-versions list my-dataset");
    expect(help).toContain("--format raw --no-progress");
    expect(
      createDatasetCommand()
        .commands.find((subcommand) => subcommand.name() === "get")
        ?.helpInformation()
    ).toContain("px dataset-versions list");
  });
});

describe("formatDatasetVersionsOutput", () => {
  it("shows version IDs, descriptions, and creation timestamps", () => {
    const output = formatDatasetVersionsOutput({
      datasetVersions: [DATASET_VERSION],
    });
    for (const value of [
      DATASET_VERSION.version_id,
      "Added edge cases",
      new Date(DATASET_VERSION.created_at).toLocaleString(),
    ]) {
      expect(output).toContain(value);
    }
    expect(output).not.toContain(DATASET_VERSION.created_at);
    expect(output).not.toContain("metadata");
  });

  it("leaves the description cell blank when it is null", () => {
    const output = formatDatasetVersionsOutput({
      datasetVersions: [OLDER_VERSION],
    });
    expect(output).toContain(OLDER_VERSION.version_id);
    expect(output).not.toContain("null");
  });

  it.each(["json", "raw"] as const)(
    "preserves full versions including metadata in %s",
    (format) => {
      const output = formatDatasetVersionsOutput({
        datasetVersions: [DATASET_VERSION],
        format,
      });
      expect(output).toBe(
        JSON.stringify(
          [DATASET_VERSION],
          null,
          format === "json" ? 2 : undefined
        )
      );
    }
  );

  it.each(["pretty", "json", "raw"] as const)(
    "formats empty %s output",
    (format) => {
      expect(formatDatasetVersionsOutput({ datasetVersions: [], format })).toBe(
        format === "pretty" ? "No dataset versions found" : "[]"
      );
    }
  );
});
