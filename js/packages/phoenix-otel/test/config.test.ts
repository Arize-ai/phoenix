import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  clearEnvFileCache,
  resetCrossTierEndpointWarningsForTesting,
} from "@arizeai/phoenix-config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const exporterState = vi.hoisted(() => ({
  options: undefined as
    | { headers?: Record<string, string>; url?: string }
    | undefined,
}));

vi.mock("@opentelemetry/exporter-trace-otlp-proto", () => ({
  OTLPTraceExporter: class {
    constructor(options: { headers?: Record<string, string>; url?: string }) {
      exporterState.options = options;
    }

    export(): void {}

    shutdown(): Promise<void> {
      return Promise.resolve();
    }
  },
}));

import {
  getDefaultSpanProcessor,
  register,
  resetTraceExportSourceLogForTesting,
} from "../src/register";

describe("environment-derived OTel configuration", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Connection env vars are cleared globally in test/setup.ts.
    originalEnv = { ...process.env };
    exporterState.options = undefined;
    clearEnvFileCache();
    resetCrossTierEndpointWarningsForTesting();
    resetTraceExportSourceLogForTesting();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    clearEnvFileCache();
  });

  it("preserves explicit authorization case-insensitively", () => {
    process.env.PHOENIX_API_KEY = "environment-key";

    getDefaultSpanProcessor({
      batch: false,
      headers: { Authorization: "Bearer explicit-token" },
      url: "http://explicit-host:6006",
    });

    expect(exporterState.options?.headers).toEqual({
      Authorization: "Bearer explicit-token",
    });
    expect(
      Object.keys(exporterState.options?.headers ?? {}).filter(
        (key) => key.toLowerCase() === "authorization"
      )
    ).toHaveLength(1);
  });

  it("warns while retaining a file endpoint and process API key", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-otel-env-"));
    const filePath = path.join(tempDir, ".env.phoenix");
    fs.writeFileSync(
      filePath,
      "PHOENIX_COLLECTOR_ENDPOINT=http://file-host:6006\n"
    );
    fs.chmodSync(filePath, 0o600);
    delete process.env.PHOENIX_DISCOVER_CONFIG;
    process.env.PHOENIX_API_KEY = "secret-process-key";
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    clearEnvFileCache();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      getDefaultSpanProcessor({ batch: false });

      expect(exporterState.options).toMatchObject({
        headers: { authorization: "Bearer secret-process-key" },
        url: "http://file-host:6006/v1/traces",
      });
      expect(warnSpy).toHaveBeenCalledWith(
        `Credentials from the process environment will be sent to PHOENIX_COLLECTOR_ENDPOINT set by ${filePath}.`
      );
      expect(warnSpy.mock.calls[0]?.[0]).not.toContain("secret-process-key");
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("ignores a malformed endpoint from a discovered file", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-otel-env-"));
    const filePath = path.join(tempDir, ".env.phoenix");
    fs.writeFileSync(filePath, "PHOENIX_COLLECTOR_ENDPOINT=http://x:bad\n");
    fs.chmodSync(filePath, 0o600);
    delete process.env.PHOENIX_DISCOVER_CONFIG;
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    clearEnvFileCache();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      getDefaultSpanProcessor({ batch: false });

      expect(exporterState.options?.url).toBe(
        "http://localhost:6006/v1/traces"
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `Ignoring invalid PHOENIX_COLLECTOR_ENDPOINT value from ${filePath}`
        )
      );
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

  // Experiment entry points reach register() without a url when the base URL
  // came from the environment, so a malformed file value must degrade to the
  // default rather than abort the run with a TypeError.
  it("falls back instead of throwing on a malformed file endpoint", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-otel-env-"));
    const filePath = path.join(tempDir, ".env.phoenix");
    fs.writeFileSync(filePath, "PHOENIX_COLLECTOR_ENDPOINT=http://x:bad\n");
    fs.chmodSync(filePath, 0o600);
    delete process.env.PHOENIX_DISCOVER_CONFIG;
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    clearEnvFileCache();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      expect(() => register({ global: false })).not.toThrow();
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("names the variable that supplied a malformed file endpoint", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-otel-env-"));
    const filePath = path.join(tempDir, ".env.phoenix");
    fs.writeFileSync(filePath, "PHOENIX_ENDPOINT=http://x:bad\n");
    fs.chmodSync(filePath, 0o600);
    delete process.env.PHOENIX_DISCOVER_CONFIG;
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    clearEnvFileCache();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});

    try {
      getDefaultSpanProcessor({ batch: false });

      expect(exporterState.options?.url).toBe(
        "http://localhost:6006/v1/traces"
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `Ignoring invalid PHOENIX_ENDPOINT value from ${filePath}`
        )
      );
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

  // The credential warning must fire for whichever variable supplied the
  // endpoint, not only the collector one — otherwise a process API key is sent
  // to a file-tier endpoint silently.
  it("warns about credentials sent to a file endpoint from any variable", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-otel-env-"));
    const filePath = path.join(tempDir, ".env.phoenix");
    fs.writeFileSync(filePath, "PHOENIX_ENDPOINT=http://file-host:6006\n");
    fs.chmodSync(filePath, 0o600);
    delete process.env.PHOENIX_DISCOVER_CONFIG;
    process.env.PHOENIX_API_KEY = "secret-process-key";
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    clearEnvFileCache();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});

    try {
      getDefaultSpanProcessor({ batch: false });

      expect(exporterState.options?.url).toBe(
        "http://file-host:6006/v1/traces"
      );
      expect(warnSpy).toHaveBeenCalledWith(
        `Credentials from the process environment will be sent to PHOENIX_ENDPOINT set by ${filePath}.`
      );
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("keeps the final endpoint and credential bundle on grouped tiers", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "phoenix-otel-group-")
    );
    const filePath = path.join(tempDir, ".env.phoenix");
    fs.writeFileSync(
      filePath,
      "PHOENIX_COLLECTOR_ENDPOINT=http://file-host:6006\nPHOENIX_API_KEY=file-key\n"
    );
    fs.chmodSync(filePath, 0o600);
    delete process.env.PHOENIX_DISCOVER_CONFIG;
    process.env.PHOENIX_CLIENT_HEADERS =
      '{"Authorization":"Bearer process-token"}';
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
    clearEnvFileCache();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      getDefaultSpanProcessor({ batch: false });

      expect(exporterState.options).toMatchObject({
        headers: { Authorization: "Bearer process-token" },
        url: "http://file-host:6006/v1/traces",
      });
      expect(JSON.stringify(exporterState.options)).not.toContain("file-key");
    } finally {
      fs.rmSync(tempDir, { force: true, recursive: true });
    }
  });
});
