import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAnnotationConfigCommand } from "../src/commands/annotationConfig";
import { ExitCode } from "../src/exitCodes";

/**
 * Build a fetch mock that returns each queued response in order, falling back
 * to the last response once exhausted.
 */
function makeFetchMock(
  responses: Array<{ ok: boolean; status?: number; body?: unknown }>
) {
  let callIndex = 0;
  return vi.fn().mockImplementation((requestOrUrl: Request | string) => {
    const resp = responses[callIndex++] ?? responses[responses.length - 1];
    const status = resp.status ?? (resp.ok ? 200 : 500);
    const url =
      requestOrUrl instanceof Request ? requestOrUrl.url : requestOrUrl;
    const body = resp.body ?? {};
    const text = JSON.stringify(body);
    return Promise.resolve({
      ok: resp.ok,
      status,
      statusText: resp.ok ? "OK" : "Error",
      url,
      headers: new Headers(),
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(text),
    });
  });
}

function getFetchUrl(arg: unknown): string {
  if (arg instanceof Request) return arg.url;
  return String(arg);
}

function getFetchMethod(arg: unknown, init?: RequestInit): string {
  if (arg instanceof Request) return arg.method;
  return init?.method ?? "GET";
}

async function getFetchBody(
  arg: unknown,
  init?: RequestInit
): Promise<unknown> {
  if (arg instanceof Request) {
    const text = await arg.clone().text();
    return text ? JSON.parse(text) : undefined;
  }
  const body = init?.body;
  return typeof body === "string" ? JSON.parse(body) : body;
}

const BASE_ARGS = ["--endpoint", "http://localhost:6006"];

const CATEGORICAL = {
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

const CONTINUOUS = {
  id: "cont-id-002",
  name: "score",
  type: "CONTINUOUS",
  description: null,
  optimization_direction: "MAXIMIZE",
  lower_bound: 0,
  upper_bound: 1,
};

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
    vi.unstubAllGlobals();
  });

  it("fetches the config then PUTs a merged body changing only --name", async () => {
    const fetchMock = makeFetchMock([
      { ok: true, body: { data: CATEGORICAL } },
      {
        ok: true,
        body: { data: { ...CATEGORICAL, name: "renamed" } },
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    await createAnnotationConfigCommand().parseAsync(
      ["update", "quality", "--name", "renamed", ...BASE_ARGS, "--no-progress"],
      { from: "user" }
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // First call: GET by identifier
    expect(getFetchUrl(fetchMock.mock.calls[0][0])).toContain(
      "/v1/annotation_configs/quality"
    );
    // Second call: PUT using the resolved ID
    expect(getFetchUrl(fetchMock.mock.calls[1][0])).toContain(
      "/v1/annotation_configs/cat-id-001"
    );
    expect(
      getFetchMethod(fetchMock.mock.calls[1][0], fetchMock.mock.calls[1][1])
    ).toBe("PUT");

    const body = (await getFetchBody(
      fetchMock.mock.calls[1][0],
      fetchMock.mock.calls[1][1]
    )) as Record<string, unknown>;
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
    const fetchMock = makeFetchMock([
      { ok: true, body: { data: CATEGORICAL } },
      { ok: true, body: { data: CATEGORICAL } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    await createAnnotationConfigCommand().parseAsync(
      [
        "update",
        "quality",
        "--values",
        '[{"label":"excellent","score":2},{"label":"poor"}]',
        ...BASE_ARGS,
        "--no-progress",
      ],
      { from: "user" }
    );

    const body = (await getFetchBody(
      fetchMock.mock.calls[1][0],
      fetchMock.mock.calls[1][1]
    )) as Record<string, unknown>;
    expect(body.values).toEqual([
      { label: "excellent", score: 2 },
      { label: "poor" },
    ]);
  });

  it("updates categorical values from repeatable --value flags", async () => {
    const fetchMock = makeFetchMock([
      { ok: true, body: { data: CATEGORICAL } },
      { ok: true, body: { data: CATEGORICAL } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    await createAnnotationConfigCommand().parseAsync(
      [
        "update",
        "quality",
        "--value",
        "excellent=2",
        "--value",
        "poor",
        ...BASE_ARGS,
        "--no-progress",
      ],
      { from: "user" }
    );

    const body = (await getFetchBody(
      fetchMock.mock.calls[1][0],
      fetchMock.mock.calls[1][1]
    )) as Record<string, unknown>;
    expect(body.values).toEqual([
      { label: "excellent", score: 2 },
      { label: "poor" },
    ]);
  });

  it("exits INVALID_ARGUMENT when both --value and --values are supplied", async () => {
    const fetchMock = makeFetchMock([
      { ok: true, body: { data: CATEGORICAL } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

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
          "--no-progress",
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
  });

  it("exits INVALID_ARGUMENT before any network call when a numeric flag is not a number", async () => {
    const fetchMock = makeFetchMock([{ ok: true, body: { data: CONTINUOUS } }]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createAnnotationConfigCommand().parseAsync(
        [
          "update",
          "score",
          "--lower-bound",
          "abc",
          ...BASE_ARGS,
          "--no-progress",
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    // A typo'd bound must never reach the API (it would silently clear the
    // existing bound to null).
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a lowercase --optimization-direction and sends it uppercased", async () => {
    const fetchMock = makeFetchMock([
      { ok: true, body: { data: CATEGORICAL } },
      { ok: true, body: { data: CATEGORICAL } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    await createAnnotationConfigCommand().parseAsync(
      [
        "update",
        "quality",
        "--optimization-direction",
        "minimize",
        ...BASE_ARGS,
        "--no-progress",
      ],
      { from: "user" }
    );

    const body = (await getFetchBody(
      fetchMock.mock.calls[1][0],
      fetchMock.mock.calls[1][1]
    )) as Record<string, unknown>;
    expect(body.optimization_direction).toBe("MINIMIZE");
  });

  it("updates continuous bounds", async () => {
    const fetchMock = makeFetchMock([
      { ok: true, body: { data: CONTINUOUS } },
      { ok: true, body: { data: CONTINUOUS } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    await createAnnotationConfigCommand().parseAsync(
      [
        "update",
        "score",
        "--lower-bound",
        "-1",
        "--upper-bound",
        "10",
        ...BASE_ARGS,
        "--no-progress",
      ],
      { from: "user" }
    );

    const body = (await getFetchBody(
      fetchMock.mock.calls[1][0],
      fetchMock.mock.calls[1][1]
    )) as Record<string, unknown>;
    expect(body.type).toBe("CONTINUOUS");
    expect(body.lower_bound).toBe(-1);
    expect(body.upper_bound).toBe(10);
  });

  it("outputs the updated config as a single object with --format raw", async () => {
    const updated = { ...CATEGORICAL, name: "renamed" };
    const fetchMock = makeFetchMock([
      { ok: true, body: { data: CATEGORICAL } },
      { ok: true, body: { data: updated } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await createAnnotationConfigCommand().parseAsync(
      [
        "update",
        "quality",
        "--name",
        "renamed",
        "--format",
        "raw",
        ...BASE_ARGS,
        "--no-progress",
      ],
      { from: "user" }
    );

    expect(stdoutSpy).toHaveBeenCalledWith(JSON.stringify(updated));
  });

  it("exits INVALID_ARGUMENT when no fields are provided", async () => {
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createAnnotationConfigCommand().parseAsync(
        ["update", "quality", ...BASE_ARGS, "--no-progress"],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    // No network call should happen — validation fails first.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exits INVALID_ARGUMENT for an invalid --optimization-direction", async () => {
    const fetchMock = makeFetchMock([{ ok: true, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createAnnotationConfigCommand().parseAsync(
        [
          "update",
          "quality",
          "--optimization-direction",
          "SIDEWAYS",
          ...BASE_ARGS,
          "--no-progress",
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exits INVALID_ARGUMENT when --values is used on a non-categorical config", async () => {
    const fetchMock = makeFetchMock([{ ok: true, body: { data: CONTINUOUS } }]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createAnnotationConfigCommand().parseAsync(
        [
          "update",
          "score",
          "--values",
          '[{"label":"good"}]',
          ...BASE_ARGS,
          "--no-progress",
        ],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    // The GET happened, but the PUT never fired because the merge threw.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("exits FAILURE when the config is not found", async () => {
    const fetchMock = makeFetchMock([{ ok: false, status: 404, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    await expect(
      createAnnotationConfigCommand().parseAsync(
        ["update", "missing", "--name", "x", ...BASE_ARGS, "--no-progress"],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.FAILURE}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
  });
});
