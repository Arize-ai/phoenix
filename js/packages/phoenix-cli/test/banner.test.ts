import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getBannerInfoLines, renderBanner } from "../src/banner";
import { resolveConfig } from "../src/config";
import { type SettingsFile, saveSettings } from "../src/settings";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeTempSettings(tmpDir: string, data: SettingsFile): void {
  const pxConfigDir = path.join(tmpDir, "px");
  fs.mkdirSync(pxConfigDir, { recursive: true });
  saveSettings(data, {
    settingsPath: path.join(pxConfigDir, "settings.json"),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("banner", () => {
  it("shows the current CLI version and update prompt when a newer version exists", () => {
    const infoLines = getBannerInfoLines({
      serverUrl: "http://localhost:6006",
      project: "default",
      hasApiKey: true,
      currentVersion: "0.11.0",
      latestVersion: "0.12.0",
      hasUpdate: true,
    });

    expect(infoLines).toContain("Version: v0.11.0");
    expect(infoLines).toContain(
      "Update:  v0.12.0 available. Run px self update"
    );
  });

  it("omits update text when the published version matches", () => {
    const infoLines = getBannerInfoLines({
      serverUrl: "http://localhost:6006",
      project: "default",
      hasApiKey: false,
      currentVersion: "0.11.0",
      latestVersion: "0.11.0",
      hasUpdate: false,
    });

    expect(infoLines.some((line) => line.startsWith("Update:"))).toBe(false);
  });

  it("omits update text when update status is unavailable", () => {
    const infoLines = getBannerInfoLines({
      serverUrl: "http://localhost:6006",
      project: "default",
      hasApiKey: false,
      currentVersion: "0.11.0",
    });

    expect(infoLines).toContain("Version: v0.11.0");
    expect(infoLines.some((line) => line.startsWith("Update:"))).toBe(false);
  });

  it("renders the tagline and info lines below the logo", () => {
    const banner = renderBanner({
      infoLines: [
        "Server:  http://localhost:6006",
        "Project: default",
        "Version: v0.11.0",
      ],
    });

    expect(banner).toContain("░▀░░░▀░▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀░▀");
    expect(banner).toContain("CLI for interacting with your phoenix server");
    expect(banner).toContain("Server:  http://localhost:6006");
  });

  describe("profile-backed config", () => {
    let originalEnv: NodeJS.ProcessEnv;
    let tmpDir: string;

    beforeEach(() => {
      originalEnv = { ...process.env };
      delete process.env.PHOENIX_HOST;
      delete process.env.PHOENIX_PROJECT;
      delete process.env.PHOENIX_API_KEY;
      delete process.env.PHOENIX_PROFILE;
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-banner-test-"));
      process.env.XDG_CONFIG_HOME = tmpDir;
    });

    afterEach(() => {
      process.env = originalEnv;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("getBannerInfoLines reflects profile endpoint and project when only the profile provides them", () => {
      writeTempSettings(tmpDir, {
        activeProfile: "prod",
        profiles: {
          prod: {
            endpoint: "https://prod.example.com",
            project: "prod-project",
          },
        },
      });
      process.env.PHOENIX_API_KEY = "env-key";

      const config = resolveConfig({ cliOptions: {} });

      const infoLines = getBannerInfoLines({
        serverUrl: config.endpoint ?? "not set",
        project: config.project ?? "not set",
        hasApiKey: Boolean(config.apiKey),
        currentVersion: "0.11.0",
      });

      expect(infoLines).toContain("Server:  https://prod.example.com");
      expect(infoLines).toContain("Project: prod-project");
      expect(infoLines).toContain("API Key: set");
    });
  });
});
