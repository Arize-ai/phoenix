import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAnnotationConfigCommand } from "../src/commands/annotationConfig";
import { ExitCode } from "../src/exitCodes";

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

const BASE_ARGS = ["--endpoint", "http://localhost:6006", "--no-progress"];

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
    vi.unstubAllGlobals();
  });

  it("GETs by identifier and prints the config as a single object (raw)", async () => {
    const fetchMock = makeFetchMock([
      { ok: true, body: { data: CATEGORICAL } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await createAnnotationConfigCommand().parseAsync(
      ["get", "quality", "--format", "raw", ...BASE_ARGS],
      { from: "user" }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getFetchUrl(fetchMock.mock.calls[0][0])).toContain(
      "/v1/annotation_configs/quality"
    );
    expect(
      getFetchMethod(fetchMock.mock.calls[0][0], fetchMock.mock.calls[0][1])
    ).toBe("GET");
    expect(stdoutSpy).toHaveBeenCalledWith(JSON.stringify(CATEGORICAL));
  });

  it("exits FAILURE when the identifier is not found", async () => {
    // The client throws on a 404, which the handler's catch maps to FAILURE.
    const fetchMock = makeFetchMock([{ ok: false, status: 404, body: {} }]);
    vi.stubGlobal("fetch", fetchMock);
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

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
    vi.unstubAllGlobals();
  });

  it("POSTs a categorical config built from repeatable --value flags", async () => {
    const fetchMock = makeFetchMock([
      { ok: true, body: { data: CATEGORICAL } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});

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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getFetchUrl(fetchMock.mock.calls[0][0])).toContain(
      "/v1/annotation_configs"
    );
    expect(
      getFetchMethod(fetchMock.mock.calls[0][0], fetchMock.mock.calls[0][1])
    ).toBe("POST");

    const body = (await getFetchBody(
      fetchMock.mock.calls[0][0],
      fetchMock.mock.calls[0][1]
    )) as Record<string, unknown>;
    expect(body.type).toBe("CATEGORICAL");
    expect(body.name).toBe("quality");
    expect(body.optimization_direction).toBe("MAXIMIZE");
    expect(body.values).toEqual([
      { label: "good", score: 1 },
      { label: "bad", score: 0 },
    ]);
    expect(stdoutSpy).toHaveBeenCalledWith(JSON.stringify(CATEGORICAL));
  });

  it("lowercases --type and defaults optimization_direction to NONE", async () => {
    const fetchMock = makeFetchMock([
      { ok: true, body: { data: CATEGORICAL } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

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

    const body = (await getFetchBody(
      fetchMock.mock.calls[0][0],
      fetchMock.mock.calls[0][1]
    )) as Record<string, unknown>;
    expect(body.type).toBe("CONTINUOUS");
    expect(body.optimization_direction).toBe("NONE");
    expect(body.lower_bound).toBe(0);
    expect(body.upper_bound).toBe(1);
  });

  it("exits INVALID_ARGUMENT when --type is missing", async () => {
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
        ["create", "--name", "quality", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exits INVALID_ARGUMENT for an invalid --type", async () => {
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
        ["create", "--type", "RATING", "--name", "quality", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exits INVALID_ARGUMENT when a categorical config has no values", async () => {
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
        ["create", "--type", "CATEGORICAL", "--name", "quality", ...BASE_ARGS],
        { from: "user" }
      )
    ).rejects.toThrow(`process.exit:${ExitCode.INVALID_ARGUMENT}`);

    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exits INVALID_ARGUMENT when a value flag is used on a non-categorical type", async () => {
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
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exits INVALID_ARGUMENT before any network call when a numeric flag is not a number", async () => {
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
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a lowercase --optimization-direction and sends it uppercased", async () => {
    const fetchMock = makeFetchMock([
      { ok: true, body: { data: CATEGORICAL } },
    ]);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

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

    const body = (await getFetchBody(
      fetchMock.mock.calls[0][0],
      fetchMock.mock.calls[0][1]
    )) as Record<string, unknown>;
    expect(body.optimization_direction).toBe("MAXIMIZE");
  });
});
