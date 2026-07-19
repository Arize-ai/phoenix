import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { componentsV1 } from "@arizeai/phoenix-testing";
import { HttpResponse } from "@arizeai/phoenix-testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAnnotationConfigCommand } from "../src/commands/annotationConfig";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { BASE_ARGS, captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

type AnnotationConfig =
  componentsV1["schemas"]["GetAnnotationConfigResponseBody"]["data"];

const CATEGORICAL: componentsV1["schemas"]["CategoricalAnnotationConfig"] = {
  id: "cat-id-001",
  name: "quality",
  type: "CATEGORICAL",
  description: "Quality rating",
  optimization_direction: "MAXIMIZE",
  values: [
    { label: "good", score: 1 },
    { label: "bad", score: 0 },
  ],
};

const CONTINUOUS: componentsV1["schemas"]["ContinuousAnnotationConfig"] = {
  id: "cont-id-002",
  name: "score",
  type: "CONTINUOUS",
  description: null,
  optimization_direction: "MAXIMIZE",
  lower_bound: 0,
  upper_bound: 1,
};

/**
 * Register handlers for the update flow: GET by identifier answers with
 * `existing`, PUT answers with `updated` (defaults to `existing`). Records
 * the GET identifier, the PUT config id and body, and per-handler call
 * counts so tests can assert which calls happened.
 */
function captureAnnotationConfigUpdateFlow(
  existing: AnnotationConfig,
  updated: AnnotationConfig = existing
) {
  const captured: {
    getIdentifier?: string;
    getCount: number;
    putConfigId?: string;
    putBody?: Record<string, unknown>;
    putCount: number;
  } = { getCount: 0, putCount: 0 };

  mock.server.use(
    http.get(
      "/v1/annotation_configs/{config_identifier}",
      ({ params, response }) => {
        captured.getCount += 1;
        captured.getIdentifier = params.config_identifier;
        return response(200).json({ data: existing });
      }
    ),
    http.put(
      "/v1/annotation_configs/{config_id}",
      async ({ params, request, response }) => {
        captured.putCount += 1;
        captured.putConfigId = params.config_id;
        captured.putBody = (await request.clone().json()) as Record<
          string,
          unknown
        >;
        return response(200).json({ data: updated });
      }
    )
  );

  return captured;
}

/**
 * Point XDG_CONFIG_HOME at a clean temp dir so the CLI's settings resolution
 * doesn't pick up a developer's real `~/.px/settings.json`.
 */
function useIsolatedProfilesDir() {
  let tmpDir: string;
  let originalXdg: string | undefined;
  beforeEach(() => {
    originalXdg = process.env.XDG_CONFIG_HOME;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-ac-update-test-"));
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

describe("annotation-config update", () => {
  useIsolatedProfilesDir();
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches the config then PUTs a merged body changing only --name", async () => {
    const captured = captureAnnotationConfigUpdateFlow(CATEGORICAL, {
      ...CATEGORICAL,
      name: "renamed",
    });
    captureCliOutput();

    await createAnnotationConfigCommand().parseAsync(
      ["update", "quality", "--name", "renamed", ...BASE_ARGS],
      { from: "user" }
    );

    // First call: GET by identifier
    expect(captured.getCount).toBe(1);
    expect(captured.getIdentifier).toBe("quality");
    // Second call: PUT using the resolved ID
    expect(captured.putCount).toBe(1);
    expect(captured.putConfigId).toBe("cat-id-001");

    const body = captured.putBody as Record<string, unknown>;
    // Changed field
    expect(body.name).toBe("renamed");
    // Preserved fields
    expect(body.type).toBe("CATEGORICAL");
    expect(body.description).toBe("Quality rating");
    expect(body.optimization_direction).toBe("MAXIMIZE");
    expect(body.values).toEqual(CATEGORICAL.values);
    // PUT body must not carry the read-only id
    expect(body).not.toHaveProperty("id");
  });

  it("updates categorical values from --values JSON", async () => {
    const captured = captureAnnotationConfigUpdateFlow(CATEGORICAL);
    captureCliOutput();

    await createAnnotationConfigCommand().parseAsync(
      [
        "update",
        "quality",
        "--values",
        '[{"label":"excellent","score":2},{"label":"poor"}]',
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const body = captured.putBody as Record<string, unknown>;
    expect(body.values).toEqual([
      { label: "excellent", score: 2 },
      { label: "poor" },
    ]);
  });

  it("updates categorical values from repeatable --value flags", async () => {
    const captured = captureAnnotationConfigUpdateFlow(CATEGORICAL);
    captureCliOutput();

    await createAnnotationConfigCommand().parseAsync(
      [
        "update",
        "quality",
        "--value",
        "excellent=2",
        "--value",
        "poor",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const body = captured.putBody as Record<string, unknown>;
    expect(body.values).toEqual([
      { label: "excellent", score: 2 },
      { label: "poor" },
    ]);
  });

  it("exits INVALID_ARGUMENT when both --value and --values are supplied", async () => {
    captureAnnotationConfigUpdateFlow(CATEGORICAL);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createAnnotationConfigCommand().parseAsync(
        [
          "update",
          "quality",
          "--value",
          "good=1",
          "--values",
          '[{"label":"bad"}]',
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
  });

  it("exits INVALID_ARGUMENT before any network call when a numeric flag is not a number", async () => {
    const captured = captureAnnotationConfigUpdateFlow(CONTINUOUS);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createAnnotationConfigCommand().parseAsync(
        ["update", "score", "--lower-bound", "abc", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    // A typo'd bound must never reach the API (it would silently clear the
    // existing bound to null).
    expect(captured.getCount).toBe(0);
    expect(captured.putCount).toBe(0);
  });

  it("accepts a lowercase --optimization-direction and sends it uppercased", async () => {
    const captured = captureAnnotationConfigUpdateFlow(CATEGORICAL);
    captureCliOutput();

    await createAnnotationConfigCommand().parseAsync(
      [
        "update",
        "quality",
        "--optimization-direction",
        "minimize",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const body = captured.putBody as Record<string, unknown>;
    expect(body.optimization_direction).toBe("MINIMIZE");
  });

  it("updates continuous bounds", async () => {
    const captured = captureAnnotationConfigUpdateFlow(CONTINUOUS);
    captureCliOutput();

    await createAnnotationConfigCommand().parseAsync(
      [
        "update",
        "score",
        "--lower-bound",
        "-1",
        "--upper-bound",
        "10",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const body = captured.putBody as Record<string, unknown>;
    expect(body.type).toBe("CONTINUOUS");
    expect(body.lower_bound).toBe(-1);
    expect(body.upper_bound).toBe(10);
  });

  it("outputs the updated config as a single object with --format raw", async () => {
    const updated = { ...CATEGORICAL, name: "renamed" };
    captureAnnotationConfigUpdateFlow(CATEGORICAL, updated);
    const io = captureCliOutput();

    await createAnnotationConfigCommand().parseAsync(
      [
        "update",
        "quality",
        "--name",
        "renamed",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(io.stdout).toHaveBeenCalledWith(JSON.stringify(updated));
  });

  it("exits INVALID_ARGUMENT when no fields are provided", async () => {
    const captured = captureAnnotationConfigUpdateFlow(CATEGORICAL);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createAnnotationConfigCommand().parseAsync(
        ["update", "quality", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    // No network call should happen — validation fails first.
    expect(captured.getCount).toBe(0);
    expect(captured.putCount).toBe(0);
  });

  it("exits INVALID_ARGUMENT for an invalid --optimization-direction", async () => {
    const captured = captureAnnotationConfigUpdateFlow(CATEGORICAL);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createAnnotationConfigCommand().parseAsync(
        [
          "update",
          "quality",
          "--optimization-direction",
          "SIDEWAYS",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.getCount).toBe(0);
    expect(captured.putCount).toBe(0);
  });

  it("exits INVALID_ARGUMENT when --values is used on a non-categorical config", async () => {
    const captured = captureAnnotationConfigUpdateFlow(CONTINUOUS);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createAnnotationConfigCommand().parseAsync(
        ["update", "score", "--values", '[{"label":"good"}]', ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    // The GET happened, but the PUT never fired because the merge threw.
    expect(captured.getCount).toBe(1);
    expect(captured.putCount).toBe(0);
  });

  it("exits FAILURE when the config is not found", async () => {
    // 404 is not a documented status for this operation, so pin an untyped
    // response.
    mock.server.use(
      http.get("/v1/annotation_configs/{config_identifier}", ({ response }) =>
        response.untyped(HttpResponse.json({}, { status: 404 }))
      )
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createAnnotationConfigCommand().parseAsync(
        ["update", "missing", "--name", "x", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
  });
});
