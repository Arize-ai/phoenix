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

/**
 * Register a handler for GET /v1/annotation_configs/{config_identifier} that
 * answers with the given config and records the requested identifier and the
 * number of calls.
 */
function captureGetAnnotationConfigRequest() {
  const captured: { identifier?: string; count: number } = { count: 0 };
  mock.server.use(
    http.get(
      "/v1/annotation_configs/{config_identifier}",
      ({ params, response }) => {
        captured.count += 1;
        captured.identifier = params.config_identifier;
        return response(200).json({ data: CATEGORICAL });
      }
    )
  );
  return captured;
}

/**
 * Register a handler for POST /v1/annotation_configs that records the request
 * body and the number of calls. Tests that must never reach the network
 * assert `count === 0`.
 */
function captureCreateAnnotationConfigRequest() {
  const captured: { body?: Record<string, unknown>; count: number } = {
    count: 0,
  };
  mock.server.use(
    http.post("/v1/annotation_configs", async ({ request, response }) => {
      captured.count += 1;
      captured.body = (await request.clone().json()) as Record<string, unknown>;
      return response(200).json({ data: CATEGORICAL });
    })
  );
  return captured;
}

function useIsolatedProfilesDir() {
  let tmpDir: string;
  let originalXdg: string | undefined;
  beforeEach(() => {
    originalXdg = process.env.XDG_CONFIG_HOME;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-ac-getcreate-"));
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

describe("annotation-config get", () => {
  useIsolatedProfilesDir();
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GETs by identifier and prints the config as a single object (raw)", async () => {
    const captured = captureGetAnnotationConfigRequest();
    const io = captureCliOutput();

    await createAnnotationConfigCommand().parseAsync(
      ["get", "quality", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    expect(captured.count).toBe(1);
    expect(captured.identifier).toBe("quality");
    expect(io.stdout).toHaveBeenCalledWith(JSON.stringify(CATEGORICAL));
  });

  it("exits FAILURE when the identifier is not found", async () => {
    // The client throws on a 404, which the handler's catch maps to FAILURE.
    // 404 is not a documented status for this operation, so pin an untyped
    // response.
    mock.server.use(
      http.get("/v1/annotation_configs/{config_identifier}", ({ response }) =>
        response.untyped(HttpResponse.json({}, { status: 404 }))
      )
    );
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createAnnotationConfigCommand().parseAsync(
        ["get", "missing", "--format", "raw", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error fetching annotation config")
    );
  });
});

describe("annotation-config create", () => {
  useIsolatedProfilesDir();
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs a categorical config built from repeatable --value flags", async () => {
    const captured = captureCreateAnnotationConfigRequest();
    const io = captureCliOutput();

    await createAnnotationConfigCommand().parseAsync(
      [
        "create",
        "--type",
        "CATEGORICAL",
        "--name",
        "quality",
        "--value",
        "good=1",
        "--value",
        "bad=0",
        "--optimization-direction",
        "MAXIMIZE",
        "--format",
        "raw",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    expect(captured.count).toBe(1);
    const body = captured.body as Record<string, unknown>;
    expect(body.type).toBe("CATEGORICAL");
    expect(body.name).toBe("quality");
    expect(body.optimization_direction).toBe("MAXIMIZE");
    expect(body.values).toEqual([
      { label: "good", score: 1 },
      { label: "bad", score: 0 },
    ]);
    expect(io.stdout).toHaveBeenCalledWith(JSON.stringify(CATEGORICAL));
  });

  it("lowercases --type and defaults optimization_direction to NONE", async () => {
    const captured = captureCreateAnnotationConfigRequest();
    captureCliOutput();

    await createAnnotationConfigCommand().parseAsync(
      [
        "create",
        "--type",
        "continuous",
        "--name",
        "score",
        "--lower-bound",
        "0",
        "--upper-bound",
        "1",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const body = captured.body as Record<string, unknown>;
    expect(body.type).toBe("CONTINUOUS");
    expect(body.optimization_direction).toBe("NONE");
    expect(body.lower_bound).toBe(0);
    expect(body.upper_bound).toBe(1);
  });

  it("exits INVALID_ARGUMENT when --type is missing", async () => {
    const captured = captureCreateAnnotationConfigRequest();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createAnnotationConfigCommand().parseAsync(
        ["create", "--name", "quality", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.count).toBe(0);
  });

  it("exits INVALID_ARGUMENT for an invalid --type", async () => {
    const captured = captureCreateAnnotationConfigRequest();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createAnnotationConfigCommand().parseAsync(
        ["create", "--type", "RATING", "--name", "quality", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.count).toBe(0);
  });

  it("exits INVALID_ARGUMENT when a categorical config has no values", async () => {
    const captured = captureCreateAnnotationConfigRequest();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createAnnotationConfigCommand().parseAsync(
        ["create", "--type", "CATEGORICAL", "--name", "quality", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.count).toBe(0);
  });

  it("exits INVALID_ARGUMENT when a value flag is used on a non-categorical type", async () => {
    const captured = captureCreateAnnotationConfigRequest();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createAnnotationConfigCommand().parseAsync(
        [
          "create",
          "--type",
          "CONTINUOUS",
          "--name",
          "score",
          "--value",
          "good=1",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(captured.count).toBe(0);
  });

  it("exits INVALID_ARGUMENT before any network call when a numeric flag is not a number", async () => {
    const captured = captureCreateAnnotationConfigRequest();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = mockProcessExit();

    await expect(
      createAnnotationConfigCommand().parseAsync(
        [
          "create",
          "--type",
          "CONTINUOUS",
          "--name",
          "score",
          "--lower-bound",
          "abc",
          ...BASE_ARGS,
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    // A typo'd bound must never be sent to the API as null.
    expect(captured.count).toBe(0);
  });

  it("accepts a lowercase --optimization-direction and sends it uppercased", async () => {
    const captured = captureCreateAnnotationConfigRequest();
    captureCliOutput();

    await createAnnotationConfigCommand().parseAsync(
      [
        "create",
        "--type",
        "categorical",
        "--name",
        "quality",
        "--value",
        "good=1",
        "--optimization-direction",
        "maximize",
        ...BASE_ARGS,
      ],
      { from: "user" }
    );

    const body = captured.body as Record<string, unknown>;
    expect(body.optimization_direction).toBe("MAXIMIZE");
  });
});
