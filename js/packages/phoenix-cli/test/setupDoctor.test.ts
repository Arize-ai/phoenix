import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  DEFAULT_MOCK_BASE_URL,
  HttpResponse,
  type componentsV1,
} from "@arizeai/phoenix-testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DoctorOutput } from "../src/commands/formatSetup";
import { createSetupCommand } from "../src/commands/setup";
import { ExitCode } from "../src/exitCodes";
import { http, setupMockPhoenixServer } from "./mockServer";
import { captureCliOutput, mockProcessExit } from "./testUtils";

const mock = setupMockPhoenixServer();

const VIEWER: componentsV1["schemas"]["LocalUser"] = {
  id: "user-1",
  username: "ada",
  email: "ada@example.com",
  role: "ADMIN",
  auth_method: "LOCAL",
  password_needs_reset: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function serverVersionHandler(version: string) {
  return http.get("/arize_phoenix_version", ({ response }) =>
    response.untyped(new Response(version, { status: 200 }))
  );
}

function viewerHandler(
  viewer: componentsV1["schemas"]["GetViewerResponseBody"]["data"]
) {
  return http.get("/v1/user", ({ response }) =>
    response(200).json({ data: viewer })
  );
}

function writeSettingsFile(contents: string): void {
  const settingsDirectory = path.join(process.env.XDG_CONFIG_HOME!, "px");
  fs.mkdirSync(settingsDirectory, { recursive: true });
  fs.writeFileSync(path.join(settingsDirectory, "settings.json"), contents);
}

async function runDoctor(args: string[]): Promise<void> {
  try {
    await createSetupCommand().parseAsync(["doctor", ...args], {
      from: "user",
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("process.exit:")) {
      return;
    }
    throw error;
  }
}

async function runDoctorRaw(args: string[] = []): Promise<DoctorOutput> {
  const io = captureCliOutput();
  await runDoctor([
    "--endpoint",
    DEFAULT_MOCK_BASE_URL,
    "--format",
    "raw",
    ...args,
  ]);
  return JSON.parse(String(io.stdout.mock.calls[0]?.[0])) as DoctorOutput;
}

function summarizeChecks(output: DoctorOutput): string[] {
  return output.checks.map((check) => `${check.name}:${check.status}`);
}

describe("px setup doctor", () => {
  let configDirectory: string;

  beforeEach(() => {
    configDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "px-doctor-"));
    vi.stubEnv("XDG_CONFIG_HOME", configDirectory);
    vi.stubEnv("PHOENIX_DISCOVER_CONFIG", "false");
    vi.stubEnv("PHOENIX_ENDPOINT", undefined);
    vi.stubEnv("PHOENIX_HOST", undefined);
    vi.stubEnv("PHOENIX_API_KEY", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    fs.rmSync(configDirectory, { recursive: true, force: true });
  });

  it("passes every check against a healthy server", async () => {
    const exitSpy = mockProcessExit();
    mock.server.use(serverVersionHandler("13.5.0"), viewerHandler(VIEWER));

    const output = await runDoctorRaw(["--api-key", "phx-key"]);

    expect(summarizeChecks(output)).toEqual([
      "config:pass",
      "connectivity:pass",
      "version:pass",
      "auth:pass",
    ]);
    expect(output.checks[2]?.message).toContain("13.5.0");
    expect(output.checks[3]?.message).toContain("ada");
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("runs against the generated handlers alone", async () => {
    mockProcessExit();

    const output = await runDoctorRaw();

    expect(output.checks.map((check) => check.name)).toEqual([
      "config",
      "connectivity",
      "version",
      "auth",
    ]);
    expect(output.checks[0]?.status).toBe("pass");
    expect(output.checks[1]?.status).toBe("pass");
  });

  it("fails the config check on a malformed settings file and skips the rest", async () => {
    const exitSpy = mockProcessExit();
    writeSettingsFile("{ not json");

    const output = await runDoctorRaw();

    expect(summarizeChecks(output)).toEqual([
      "config:fail",
      "connectivity:skip",
      "version:skip",
      "auth:skip",
    ]);
    expect(output.checks[0]?.fix).toContain(
      path.join(configDirectory, "px", "settings.json")
    );
    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
  });

  it("fails the config check when --profile names a missing profile", async () => {
    const exitSpy = mockProcessExit();

    const output = await runDoctorRaw(["--profile", "missing"]);

    expect(summarizeChecks(output)[0]).toBe("config:fail");
    expect(output.checks[0]?.fix).toContain("px profile list");
    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
  });

  it("fails the config check when the endpoint is not an http(s) URL", async () => {
    const exitSpy = mockProcessExit();

    const output = await runDoctorRaw(["--endpoint", "localhost:6006"]);

    expect(summarizeChecks(output)[0]).toBe("config:fail");
    expect(exitSpy).toHaveBeenCalledWith(ExitCode.INVALID_ARGUMENT);
  });

  it("fails connectivity and skips version and auth when the server is unreachable", async () => {
    const exitSpy = mockProcessExit();
    mock.server.use(http.get("/v1/projects", () => HttpResponse.error()));

    const output = await runDoctorRaw();

    expect(summarizeChecks(output)).toEqual([
      "config:pass",
      "connectivity:fail",
      "version:skip",
      "auth:skip",
    ]);
    expect(output.checks[1]?.fix).toContain("--endpoint");
    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
  });

  it("fails connectivity when the endpoint answers but is not Phoenix", async () => {
    const exitSpy = mockProcessExit();
    mock.server.use(
      http.get("/v1/projects", ({ response }) =>
        response.untyped(new Response(null, { status: 404 }))
      )
    );

    const output = await runDoctorRaw();

    expect(output.checks[1]?.status).toBe("fail");
    expect(output.checks[1]?.message).toContain("not as a Phoenix server");
    expect(output.checks[2]?.message).toBe(
      "Skipped: connectivity check failed"
    );
    expect(exitSpy).toHaveBeenCalledWith(ExitCode.NETWORK_ERROR);
  });

  it("fails the version check when the server reports no parseable version", async () => {
    const exitSpy = mockProcessExit();
    mock.server.use(
      serverVersionHandler("not-a-version"),
      viewerHandler(VIEWER)
    );

    const output = await runDoctorRaw();

    expect(summarizeChecks(output)).toEqual([
      "config:pass",
      "connectivity:pass",
      "version:fail",
      "auth:pass",
    ]);
    expect(exitSpy).toHaveBeenCalledWith(ExitCode.FAILURE);
  });

  it("fails the auth check when the server rejects the credentials", async () => {
    const exitSpy = mockProcessExit();
    mock.server.use(
      serverVersionHandler("13.5.0"),
      http.get("/v1/projects", ({ response }) =>
        response.untyped(new Response(null, { status: 401 }))
      ),
      http.get("/v1/user", ({ response }) =>
        response.untyped(new Response(null, { status: 401 }))
      )
    );

    const output = await runDoctorRaw(["--api-key", "phx-wrong"]);

    expect(summarizeChecks(output)).toEqual([
      "config:pass",
      "connectivity:pass",
      "version:pass",
      "auth:fail",
    ]);
    expect(output.checks[3]?.message).toContain("rejected the credentials");
    expect(output.checks[3]?.fix).toContain("px auth login");
    expect(exitSpy).toHaveBeenCalledWith(ExitCode.AUTH_REQUIRED);
  });

  it("says no credentials are configured when the server requires auth and none were sent", async () => {
    const exitSpy = mockProcessExit();
    mock.server.use(
      serverVersionHandler("13.5.0"),
      http.get("/v1/projects", ({ response }) =>
        response.untyped(new Response(null, { status: 401 }))
      ),
      http.get("/v1/user", ({ response }) =>
        response.untyped(new Response(null, { status: 401 }))
      )
    );

    const output = await runDoctorRaw();

    expect(output.checks[3]?.status).toBe("fail");
    expect(output.checks[3]?.message).toContain(
      "no credentials are configured"
    );
    expect(exitSpy).toHaveBeenCalledWith(ExitCode.AUTH_REQUIRED);
  });

  it("passes the auth check when the server allows anonymous access", async () => {
    const exitSpy = mockProcessExit();
    mock.server.use(
      serverVersionHandler("13.5.0"),
      viewerHandler({ auth_method: "ANONYMOUS" })
    );

    const output = await runDoctorRaw();

    expect(output.checks[3]?.status).toBe("pass");
    expect(output.checks[3]?.message).toContain("anonymous");
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("skips the auth check on servers without the user endpoint", async () => {
    const exitSpy = mockProcessExit();
    mock.server.use(
      serverVersionHandler("13.5.0"),
      http.get("/v1/user", ({ response }) =>
        response.untyped(new Response(null, { status: 404 }))
      )
    );

    const output = await runDoctorRaw();

    expect(output.checks[3]?.status).toBe("skip");
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("prints a checklist with fix hints in pretty format", async () => {
    mockProcessExit();
    mock.server.use(http.get("/v1/projects", () => HttpResponse.error()));
    const io = captureCliOutput();

    await runDoctor(["--endpoint", DEFAULT_MOCK_BASE_URL]);

    const printed = String(io.stdout.mock.calls[0]?.[0]);
    expect(printed).toContain("✓ config");
    expect(printed).toContain("✗ connectivity");
    expect(printed).toContain("fix: ");
    expect(printed).toContain("- version");
  });
});
