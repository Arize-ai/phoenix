import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ENV_PHOENIX_API_KEY,
  ENV_PHOENIX_CLIENT_HEADERS,
  ENV_PHOENIX_COLLECTOR_ENDPOINT,
  ENV_PHOENIX_PROJECT,
  ENV_PHOENIX_PROJECT_NAME,
  getCredentialsFromEnvironment,
  getCredentialsFromEnvironmentWithSource,
  getIntFromEnvironment,
  getProjectFromEnvironment,
  getStrFromEnvironment,
  getStrFromEnvironmentWithSource,
  resetCrossTierEndpointWarningsForTesting,
  warnIfUsingFileEndpointWithCredentials,
} from "./env";
import {
  ENV_PHOENIX_DISCOVER_CONFIG,
  findEnvFile,
  parseEnvFile,
  PHOENIX_ENV_FILE_NAME,
  clearEnvFileCache,
  readEnvFileValue,
} from "./envFile";

const MANAGED_ENV_KEYS = [
  ENV_PHOENIX_API_KEY,
  ENV_PHOENIX_CLIENT_HEADERS,
  ENV_PHOENIX_COLLECTOR_ENDPOINT,
  ENV_PHOENIX_PROJECT,
  "PHOENIX_PROJECT_NAME",
  "PHOENIX_PORT",
  ENV_PHOENIX_DISCOVER_CONFIG,
];

describe("envFile", () => {
  let tempDir: string;
  const originalEnv: Partial<Record<string, string>> = {};

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-env-file-"));
    for (const key of MANAGED_ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
    // Run "from" the temp dir so a developer's real .env.phoenix (anywhere
    // above the repo) cannot leak into assertions.
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    clearEnvFileCache();
    resetCrossTierEndpointWarningsForTesting();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of MANAGED_ENV_KEYS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function writeEnvFile(directory: string, contents: string): string {
    const filePath = path.join(directory, PHOENIX_ENV_FILE_NAME);
    fs.writeFileSync(filePath, contents);
    return filePath;
  }

  describe("parseEnvFile", () => {
    it.each([
      // Simple assignment
      ["PHOENIX_API_KEY=abc", { PHOENIX_API_KEY: "abc" }],
      // Comments and blank lines are skipped
      ["# comment\n\nPHOENIX_API_KEY=abc\n", { PHOENIX_API_KEY: "abc" }],
      // Optional export prefix
      ["export PHOENIX_API_KEY=abc", { PHOENIX_API_KEY: "abc" }],
      // Quoted values are unwrapped
      ['PHOENIX_API_KEY="abc"', { PHOENIX_API_KEY: "abc" }],
      ["PHOENIX_API_KEY='abc'", { PHOENIX_API_KEY: "abc" }],
      // Whitespace around key and value is stripped
      ["  PHOENIX_API_KEY = abc  ", { PHOENIX_API_KEY: "abc" }],
      // Values may contain '='
      ["PHOENIX_CLIENT_HEADERS=x=1,y=2", { PHOENIX_CLIENT_HEADERS: "x=1,y=2" }],
      // Non-PHOENIX keys are ignored (allowlist)
      ["OTHER_KEY=abc\nPHOENIX_API_KEY=def", { PHOENIX_API_KEY: "def" }],
      // Windows line endings are handled
      [
        "PHOENIX_API_KEY=abc\r\nPHOENIX_PROJECT=proj\r\n",
        {
          PHOENIX_API_KEY: "abc",
          PHOENIX_PROJECT: "proj",
        },
      ],
      // Empty values are ignored
      ["PHOENIX_API_KEY=", {}],
      ["PHOENIX_API_KEY=''", {}],
      // Malformed lines are skipped
      ["PHOENIX_API_KEY", {}],
      ["PHOENIX BAD KEY=abc", {}],
    ])("parses %j", (contents, expected) => {
      expect(parseEnvFile(contents as string)).toEqual(expected);
    });
  });

  describe("findEnvFile", () => {
    it("returns undefined when no file exists", () => {
      expect(findEnvFile({ startDir: tempDir })).toBeUndefined();
    });

    it("finds a file in the start directory", () => {
      const filePath = writeEnvFile(tempDir, "PHOENIX_API_KEY=abc\n");
      expect(findEnvFile({ startDir: tempDir })).toBe(filePath);
    });

    it("walks up to parent directories", () => {
      const filePath = writeEnvFile(tempDir, "PHOENIX_API_KEY=abc\n");
      const nestedDir = path.join(tempDir, "a", "b");
      fs.mkdirSync(nestedDir, { recursive: true });
      expect(findEnvFile({ startDir: nestedDir })).toBe(filePath);
    });

    it("prefers the nearest file", () => {
      writeEnvFile(tempDir, "PHOENIX_API_KEY=parent\n");
      const nestedDir = path.join(tempDir, "nested");
      fs.mkdirSync(nestedDir);
      const nearestPath = writeEnvFile(nestedDir, "PHOENIX_API_KEY=nested\n");
      expect(findEnvFile({ startDir: nestedDir })).toBe(nearestPath);
    });

    it("warns when ignoring files not owned by the current user", () => {
      if (
        process.platform === "win32" ||
        typeof process.getuid !== "function"
      ) {
        return;
      }
      writeEnvFile(tempDir, "PHOENIX_API_KEY=untrusted\n");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const currentUid = process.getuid();
      vi.spyOn(process, "getuid").mockReturnValue(currentUid + 1);
      expect(findEnvFile({ startDir: tempDir })).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0]?.[0]).toContain(
        "file must be a regular file owned by the current user"
      );
    });
  });

  describe("readEnvFileValue", () => {
    it("reads a PHOENIX_-prefixed value from the discovered file", () => {
      writeEnvFile(tempDir, "PHOENIX_API_KEY=file-key\n");
      expect(readEnvFileValue(ENV_PHOENIX_API_KEY)).toBe("file-key");
    });

    it("ignores keys without the PHOENIX_ prefix", () => {
      writeEnvFile(tempDir, "OTEL_EXPORTER_OTLP_ENDPOINT=http://x:4318\n");
      expect(readEnvFileValue("OTEL_EXPORTER_OTLP_ENDPOINT")).toBeUndefined();
    });

    it("treats an unavailable working directory as no discovered file", () => {
      vi.spyOn(process, "cwd").mockImplementation(() => {
        throw new Error("working directory is unavailable");
      });

      expect(readEnvFileValue(ENV_PHOENIX_API_KEY)).toBeUndefined();
    });

    it("ignores files that exceed the read limit", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      writeEnvFile(tempDir, `PHOENIX_API_KEY=${"x".repeat(64 * 1024)}\n`);

      expect(readEnvFileValue(ENV_PHOENIX_API_KEY)).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("file exceeds 65536 bytes")
      );
    });

    it.each(["false", "0", "no", "off", "FALSE", " False "])(
      "returns undefined when discovery is disabled via %j",
      (optOut) => {
        writeEnvFile(tempDir, "PHOENIX_API_KEY=file-key\n");
        process.env[ENV_PHOENIX_DISCOVER_CONFIG] = optOut;
        expect(readEnvFileValue(ENV_PHOENIX_API_KEY)).toBeUndefined();
      }
    );

    it("warns once (per file) when the file is readable by others", () => {
      if (process.platform === "win32") {
        return;
      }
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const filePath = writeEnvFile(tempDir, "PHOENIX_API_KEY=secret-value\n");
      fs.chmodSync(filePath, 0o644);
      expect(readEnvFileValue(ENV_PHOENIX_API_KEY)).toBe("secret-value");
      expect(readEnvFileValue(ENV_PHOENIX_API_KEY)).toBe("secret-value");
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const warningMessage = warnSpy.mock.calls[0]?.[0] as string;
      expect(warningMessage).toContain("accessible by other users");
      expect(warningMessage).not.toContain("secret-value");
    });

    it("does not warn for an owner-only file", () => {
      if (process.platform === "win32") {
        return;
      }
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const filePath = writeEnvFile(tempDir, "PHOENIX_API_KEY=file-key\n");
      fs.chmodSync(filePath, 0o600);
      expect(readEnvFileValue(ENV_PHOENIX_API_KEY)).toBe("file-key");
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("environment getter fallback", () => {
    it("getStrFromEnvironment falls back to the file when the env var is unset", () => {
      writeEnvFile(tempDir, "PHOENIX_API_KEY=file-key\n");
      expect(getStrFromEnvironment(ENV_PHOENIX_API_KEY)).toBe("file-key");
    });

    it("process env wins over the file", () => {
      writeEnvFile(tempDir, "PHOENIX_API_KEY=file-key\n");
      process.env[ENV_PHOENIX_API_KEY] = "env-key";
      expect(getStrFromEnvironment(ENV_PHOENIX_API_KEY)).toBe("env-key");
    });

    it("getIntFromEnvironment falls back to the file", () => {
      writeEnvFile(tempDir, "PHOENIX_PORT=16006\n");
      expect(getIntFromEnvironment("PHOENIX_PORT")).toBe(16006);
    });

    it("getProjectFromEnvironment falls back to the file", () => {
      writeEnvFile(tempDir, "PHOENIX_PROJECT=file-project\n");
      expect(getProjectFromEnvironment()).toBe("file-project");
    });

    it("resolves both process project aliases before file values", () => {
      writeEnvFile(tempDir, "PHOENIX_PROJECT=file-project\n");
      process.env[ENV_PHOENIX_PROJECT_NAME] = "process-project";
      expect(getProjectFromEnvironment()).toBe("process-project");
    });
  });

  describe("credential group", () => {
    it("uses file credentials when no process credential is set", () => {
      writeEnvFile(tempDir, "PHOENIX_API_KEY=file-key\n");
      expect(getCredentialsFromEnvironment()).toEqual({
        apiKey: "file-key",
        headers: undefined,
      });
    });

    it("reports the source that supplied a credential group", () => {
      const filePath = writeEnvFile(tempDir, "PHOENIX_API_KEY=file-key\n");
      expect(getCredentialsFromEnvironmentWithSource()).toEqual({
        apiKey: "file-key",
        headers: undefined,
        source: { filePath, kind: "env-file" },
      });
    });

    it("process client headers suppress a file API key", () => {
      writeEnvFile(tempDir, "PHOENIX_API_KEY=file-key\n");
      process.env[ENV_PHOENIX_CLIENT_HEADERS] = '{"X-Custom": "value"}';
      const credentials = getCredentialsFromEnvironment();
      expect(credentials.apiKey).toBeUndefined();
      expect(credentials.headers).toEqual({ "X-Custom": "value" });
    });

    it("a process API key suppresses file client headers", () => {
      writeEnvFile(
        tempDir,
        'PHOENIX_CLIENT_HEADERS={"X-File": "value"}\nPHOENIX_API_KEY=file-key\n'
      );
      process.env[ENV_PHOENIX_API_KEY] = "process-key";
      const credentials = getCredentialsFromEnvironment();
      expect(credentials.apiKey).toBe("process-key");
      expect(credentials.headers).toBeUndefined();
    });
  });

  describe("cross-tier endpoint warning", () => {
    it("states the final credential source, endpoint variable, and file once", () => {
      const filePath = writeEnvFile(
        tempDir,
        "PHOENIX_COLLECTOR_ENDPOINT=http://file-host:6006\n"
      );
      process.env[ENV_PHOENIX_API_KEY] = "secret-process-key";
      const endpoint = getStrFromEnvironmentWithSource(
        ENV_PHOENIX_COLLECTOR_ENDPOINT
      );
      const credentials = getCredentialsFromEnvironmentWithSource();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      for (let index = 0; index < 2; index++) {
        warnIfUsingFileEndpointWithCredentials({
          credentialSource:
            credentials.source?.kind === "process"
              ? "the process environment"
              : undefined,
          endpointSource: endpoint.source,
          endpointVariable: ENV_PHOENIX_COLLECTOR_ENDPOINT,
        });
      }

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy).toHaveBeenCalledWith(
        `Credentials from the process environment will be sent to ${ENV_PHOENIX_COLLECTOR_ENDPOINT} set by ${filePath}.`
      );
      expect(warnSpy.mock.calls[0]?.[0]).not.toContain("secret-process-key");
    });
  });

  describe("clearEnvFileCache", () => {
    it("picks up a file created after the first (cached) lookup", () => {
      expect(readEnvFileValue(ENV_PHOENIX_API_KEY)).toBeUndefined();
      writeEnvFile(tempDir, "PHOENIX_API_KEY=late-key\n");
      expect(readEnvFileValue(ENV_PHOENIX_API_KEY)).toBeUndefined();
      clearEnvFileCache();
      expect(readEnvFileValue(ENV_PHOENIX_API_KEY)).toBe("late-key");
    });
  });
});
