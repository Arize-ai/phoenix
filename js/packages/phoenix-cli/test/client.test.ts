import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPhoenixClient } from "../src/client";
import { saveSettings } from "../src/settings";

/**
 * These tests verify that `createPhoenixClient` correctly merges headers and
 * apiKey from configuration into outgoing requests.
 */
describe("createPhoenixClient — header and apiKey merging", () => {
  let tmpDir: string;
  let originalXdg: string | undefined;

  beforeEach(() => {
    originalXdg = process.env.XDG_CONFIG_HOME;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-client-test-"));
    process.env.XDG_CONFIG_HOME = tmpDir;
  });

  afterEach(() => {
    if (originalXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdg;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("attaches Authorization header when apiKey is set in config", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createPhoenixClient({
      config: { endpoint: "http://localhost:6006", apiKey: "my-secret-key" },
    });

    await client.GET("/v1/projects");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request: Request = fetchMock.mock.calls[0][0];
    expect(request.headers.get("Authorization")).toBe("Bearer my-secret-key");
  });

  it("does not attach Authorization header when apiKey is absent", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createPhoenixClient({
      config: { endpoint: "http://localhost:6006" },
    });

    await client.GET("/v1/projects");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request: Request = fetchMock.mock.calls[0][0];
    expect(request.headers.get("Authorization")).toBeNull();
  });

  it("merges custom headers from config into every request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createPhoenixClient({
      config: {
        endpoint: "http://localhost:6006",
        headers: { "X-Custom": "custom-value", "X-Tenant": "acme" },
      },
    });

    await client.GET("/v1/projects");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request: Request = fetchMock.mock.calls[0][0];
    expect(request.headers.get("X-Custom")).toBe("custom-value");
    expect(request.headers.get("X-Tenant")).toBe("acme");
  });

  it("sends both custom headers and Authorization when both are set", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createPhoenixClient({
      config: {
        endpoint: "http://localhost:6006",
        apiKey: "secret",
        headers: { "X-Custom": "value" },
      },
    });

    await client.GET("/v1/projects");

    const request: Request = fetchMock.mock.calls[0][0];
    expect(request.headers.get("Authorization")).toBe("Bearer secret");
    expect(request.headers.get("X-Custom")).toBe("value");
  });

  it("apiKey from profile flows through resolveConfig into createPhoenixClient", async () => {
    saveSettings(
      {
        activeProfile: "prod",
        profiles: {
          prod: {
            endpoint: "http://localhost:6006",
            apiKey: "profile-api-key",
          },
        },
      },
      { settingsPath: path.join(tmpDir, "px", "settings.json") }
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    // Simulate what a command does: resolveConfig picks up the profile apiKey,
    // then createPhoenixClient attaches it as Authorization header.
    const { resolveConfig } = await import("../src/config");
    const config = resolveConfig({ cliOptions: {} });

    expect(config.apiKey).toBe("profile-api-key");

    const client = createPhoenixClient({ config });
    await client.GET("/v1/projects");

    const request: Request = fetchMock.mock.calls[0][0];
    expect(request.headers.get("Authorization")).toBe("Bearer profile-api-key");
  });

  it("profile headers flow through resolveConfig into createPhoenixClient", async () => {
    saveSettings(
      {
        activeProfile: "prod",
        profiles: {
          prod: {
            endpoint: "http://localhost:6006",
            headers: { "X-Custom": "from-profile" },
          },
        },
      },
      { settingsPath: path.join(tmpDir, "px", "settings.json") }
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { resolveConfig } = await import("../src/config");
    const config = resolveConfig({ cliOptions: {} });

    const client = createPhoenixClient({ config });
    await client.GET("/v1/projects");

    const request: Request = fetchMock.mock.calls[0][0];
    expect(request.headers.get("X-Custom")).toBe("from-profile");
  });

  it("throws when endpoint is not configured", () => {
    expect(() => createPhoenixClient({ config: {} })).toThrow(
      "Phoenix endpoint not configured"
    );
  });

  it("DELETE proceeds to fetch with no profile configured", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createPhoenixClient({
      config: { endpoint: "http://localhost:6006" },
    });

    await client.DELETE("/v1/projects/{project_identifier}", {
      params: { path: { project_identifier: "any" } },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
