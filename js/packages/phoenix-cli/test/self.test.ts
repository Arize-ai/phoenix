import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { execFileSyncMock, spawnSyncMock } = vi.hoisted(() => ({
  execFileSyncMock: vi.fn(),
  spawnSyncMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFileSync: execFileSyncMock,
  spawnSync: spawnSyncMock,
}));

import {
  buildUpdateCommand,
  createSelfCommand,
  detectInstallPackageManager,
} from "../src/commands/self";
import { CLI_VERSION } from "../src/version";

describe("detectInstallPackageManager", () => {
  it("detects npm installs from the npm global root", () => {
    expect(
      detectInstallPackageManager({
        packageRoot: "/tmp/npm-root/node_modules/@arizeai/phoenix-cli",
        npmGlobalRoot: "/tmp/npm-root/node_modules",
        pnpmGlobalRoot: "/tmp/pnpm-root/node_modules",
      })
    ).toBe("npm");
  });

  it("detects pnpm installs from the pnpm global root", () => {
    expect(
      detectInstallPackageManager({
        packageRoot: "/tmp/pnpm-root/node_modules/@arizeai/phoenix-cli",
        npmGlobalRoot: "/tmp/npm-root/node_modules",
        pnpmGlobalRoot: "/tmp/pnpm-root/node_modules",
      })
    ).toBe("pnpm");
  });

  it("detects pnpm installs from the .pnpm store path", () => {
    expect(
      detectInstallPackageManager({
        packageRoot:
          "/tmp/pnpm-root/.pnpm/@arizeai+phoenix-cli@0.11.0/node_modules/@arizeai/phoenix-cli",
        npmGlobalRoot: "/tmp/npm-root/node_modules",
        pnpmGlobalRoot: "/tmp/pnpm-root/node_modules",
      })
    ).toBe("pnpm");
  });

  it("returns null for unsupported install locations", () => {
    expect(
      detectInstallPackageManager({
        packageRoot: "/tmp/local-checkout/js/packages/phoenix-cli",
        npmGlobalRoot: "/tmp/npm-root/node_modules",
        pnpmGlobalRoot: "/tmp/pnpm-root/node_modules",
      })
    ).toBeNull();
  });
});

describe("buildUpdateCommand", () => {
  it("builds the npm install command using the exact version", () => {
    expect(
      buildUpdateCommand({
        packageManager: "npm",
        packageName: "@arizeai/phoenix-cli",
        version: "0.12.0",
      })
    ).toEqual({
      command: process.platform === "win32" ? "npm.cmd" : "npm",
      args: ["install", "--global", "@arizeai/phoenix-cli@0.12.0"],
      displayCommand: "npm install --global @arizeai/phoenix-cli@0.12.0",
    });
  });
});

describe("self update command", () => {
  const packageDirectory = process.cwd();
  const packageParentDirectory = path.dirname(packageDirectory);

  beforeEach(() => {
    execFileSyncMock.mockReset();
    spawnSyncMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("checks for updates without invoking the installer", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ version: "99.0.0" }),
    });
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.stubGlobal("fetch", fetchMock);

    await createSelfCommand().parseAsync(["update", "--check"], {
      from: "user",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://registry.npmjs.org/%40arizeai%2Fphoenix-cli/latest",
      expect.objectContaining({
        headers: {
          Accept: "application/json",
        },
        signal: expect.any(AbortSignal),
      })
    );
    expect(spawnSyncMock).not.toHaveBeenCalled();
    expect(stdoutSpy).toHaveBeenNthCalledWith(
      1,
      `Current version: ${CLI_VERSION}\nLatest version: 99.0.0`
    );
    expect(stdoutSpy).toHaveBeenNthCalledWith(
      2,
      "Update available. Run `px self update` to install it."
    );
  });

  it("updates via npm when the install is owned by npm", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ version: "99.0.0" }),
    });
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.stubGlobal("fetch", fetchMock);
    execFileSyncMock.mockImplementation((command: string) => {
      if (command.startsWith("pnpm")) {
        return "/tmp/pnpm-root/node_modules";
      }
      return packageParentDirectory;
    });
    spawnSyncMock.mockReturnValue({ status: 0 } as never);

    await createSelfCommand().parseAsync(["update"], { from: "user" });

    expect(spawnSyncMock).toHaveBeenCalledWith(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["install", "--global", "@arizeai/phoenix-cli@99.0.0"],
      { stdio: "inherit" }
    );
    expect(stdoutSpy).toHaveBeenNthCalledWith(
      2,
      "Updating via npm install --global @arizeai/phoenix-cli@99.0.0"
    );
    expect(stdoutSpy).toHaveBeenNthCalledWith(3, "Updated px to 99.0.0.");
  });

  it("updates via pnpm when the install is owned by pnpm", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ version: "99.0.0" }),
    });
    vi.spyOn(console, "log").mockImplementation(() => {});

    vi.stubGlobal("fetch", fetchMock);
    execFileSyncMock.mockImplementation((command: string) => {
      if (command.startsWith("pnpm")) {
        return packageParentDirectory;
      }
      return "/tmp/npm-root/node_modules";
    });
    spawnSyncMock.mockReturnValue({ status: 0 } as never);

    await createSelfCommand().parseAsync(["update"], { from: "user" });

    expect(spawnSyncMock).toHaveBeenCalledWith(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      ["add", "--global", "@arizeai/phoenix-cli@99.0.0"],
      { stdio: "inherit" }
    );
  });

  it("reports when the installed version is already current", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ version: CLI_VERSION }),
    });
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.stubGlobal("fetch", fetchMock);

    await createSelfCommand().parseAsync(["update"], { from: "user" });

    expect(spawnSyncMock).not.toHaveBeenCalled();
    expect(stdoutSpy).toHaveBeenNthCalledWith(2, "px is up to date.");
  });

  it("fails with guidance for unsupported install contexts", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ version: "99.0.0" }),
    });
    vi.spyOn(console, "log").mockImplementation(() => {});
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    vi.stubGlobal("fetch", fetchMock);
    execFileSyncMock.mockImplementation(() => "/tmp/unsupported-root");

    await expect(
      createSelfCommand().parseAsync(["update"], { from: "user" })
    ).rejects.toThrow("process.exit:1");

    expect(spawnSyncMock).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledWith(
      "Error: Automatic updates are only supported for global npm or pnpm installs of @arizeai/phoenix-cli."
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("maps fetch failures to the network exit code", async () => {
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    await expect(
      createSelfCommand().parseAsync(["update", "--check"], { from: "user" })
    ).rejects.toThrow("process.exit:5");

    expect(stderrSpy).toHaveBeenCalledWith(
      "Error: Unable to fetch latest CLI version from npm"
    );
    expect(exitSpy).toHaveBeenCalledWith(5);
  });

  it("fails when the published version is not valid semver", async () => {
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
      code?: number
    ) => {
      throw new Error(`process.exit:${code}`);
    }) as never);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ version: "not-a-version" }),
      })
    );

    await expect(
      createSelfCommand().parseAsync(["update", "--check"], { from: "user" })
    ).rejects.toThrow("process.exit:1");

    expect(stderrSpy).toHaveBeenCalledWith(
      "Error: Invalid published CLI version: not-a-version"
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
