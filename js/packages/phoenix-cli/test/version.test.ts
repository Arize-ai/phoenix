import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  CLI_VERSION,
  compareSemanticVersions,
  fetchLatestPublishedCliVersion,
  getCliVersion,
  getCliVersionStatus,
  parseSemanticVersion,
} from "../src/version";

describe("version", () => {
  it("returns the package.json CLI version", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf-8")
    ) as { version?: string };

    expect(getCliVersion()).toBe(CLI_VERSION);
    expect(getCliVersion()).toBe(packageJson.version);
  });

  it("parses stable and prerelease semantic versions", () => {
    expect(parseSemanticVersion({ rawVersion: "1.2.3" })).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: undefined,
    });
    expect(parseSemanticVersion({ rawVersion: "1.2.3-beta.1" })).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: "beta.1",
    });
  });

  it("compares semantic versions correctly", () => {
    expect(
      compareSemanticVersions({
        leftVersion: "0.12.0",
        rightVersion: "0.11.0",
      })
    ).toBe(1);
    expect(
      compareSemanticVersions({
        leftVersion: "0.11.0",
        rightVersion: "0.11.0",
      })
    ).toBe(0);
    expect(
      compareSemanticVersions({
        leftVersion: "1.0.0-beta.1",
        rightVersion: "1.0.0",
      })
    ).toBe(-1);
  });

  it("returns the latest published version from npm metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ version: "0.12.0" }),
    });

    await expect(
      fetchLatestPublishedCliVersion({
        fetchFn: fetchMock as typeof fetch,
      })
    ).resolves.toBe("0.12.0");
  });

  it("suppresses published version when the npm lookup fails", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error("network unavailable"));

    await expect(
      fetchLatestPublishedCliVersion({
        fetchFn: fetchMock as typeof fetch,
      })
    ).resolves.toBeUndefined();
  });

  it("reports when an update is available", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ version: "999.0.0" }),
    });

    await expect(
      getCliVersionStatus({
        fetchFn: fetchMock as typeof fetch,
      })
    ).resolves.toEqual({
      currentVersion: CLI_VERSION,
      latestVersion: "999.0.0",
      hasUpdate: true,
    });
  });

  it("reports up-to-date when the published version matches", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ version: CLI_VERSION }),
    });

    await expect(
      getCliVersionStatus({
        fetchFn: fetchMock as typeof fetch,
      })
    ).resolves.toEqual({
      currentVersion: CLI_VERSION,
      latestVersion: CLI_VERSION,
      hasUpdate: false,
    });
  });

  it("omits update status when the remote version cannot be parsed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ version: "not-a-version" }),
    });

    await expect(
      getCliVersionStatus({
        fetchFn: fetchMock as typeof fetch,
      })
    ).resolves.toEqual({
      currentVersion: CLI_VERSION,
    });
  });
});
