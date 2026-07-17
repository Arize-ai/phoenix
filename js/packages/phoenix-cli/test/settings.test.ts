import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_SCHEMA_URL,
  DEFAULT_SETTINGS_FILE,
  SettingsFileError,
  loadSettings,
  type SettingsFile,
  saveSettings,
} from "../src/settings";

describe("loadSettings / saveSettings", () => {
  let tmpDir: string;
  let settingsPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phoenix-settings-test-"));
    settingsPath = path.join(tmpDir, "settings.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns initial state with $schema when the file does not exist", () => {
    // First-time load: file does not exist on disk. Returns the initial
    // state, which differs from DEFAULT_SETTINGS_FILE only in carrying a
    // $schema pointer so the very first save writes a file editors can
    // validate.
    expect(loadSettings({ settingsPath })).toEqual({
      $schema: DEFAULT_SCHEMA_URL,
      activeProfile: null,
      profiles: {},
    });
  });

  it("forgiving fallback on a corrupt file does NOT add $schema", () => {
    // Distinct from the missing-file case: a corrupt file means the user
    // had something on disk; we fall back without imposing a $schema line.
    fs.writeFileSync(settingsPath, "not-json", "utf-8");
    expect(loadSettings({ settingsPath })).toEqual(DEFAULT_SETTINGS_FILE);
  });

  it("throws SettingsFileError on malformed JSON in strict mode", () => {
    fs.writeFileSync(settingsPath, "not-json", "utf-8");
    expect(() => loadSettings({ strict: true, settingsPath })).toThrow(
      SettingsFileError
    );
  });

  it("round-trips: saveSettings then loadSettings returns identical data", () => {
    const data: SettingsFile = {
      activeProfile: "prod",
      profiles: {
        dev: {
          endpoint: "http://localhost:6006",
          project: "dev-project",
          headers: { "X-Custom": "value" },
        },
        prod: { endpoint: "https://prod.example.com", apiKey: "prod-key" },
      },
    };
    saveSettings(data, { settingsPath });
    expect(loadSettings({ settingsPath })).toEqual(data);
  });

  it("parses old profile entries without oauthTokens", () => {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        activeProfile: "prod",
        profiles: {
          prod: { endpoint: "https://prod.example.com" },
        },
      }),
      "utf-8"
    );
    expect(
      loadSettings({ settingsPath }).profiles.prod.oauthTokens
    ).toBeUndefined();
  });

  it("round-trips OAuth tokens on a profile", () => {
    const data: SettingsFile = {
      activeProfile: "prod",
      profiles: {
        prod: {
          endpoint: "https://prod.example.com",
          oauthTokens: {
            accessToken: "access",
            refreshToken: "refresh",
            expiresAt: "2026-01-01T00:00:00.000Z",
            scope: "",
          },
        },
      },
    };
    saveSettings(data, { settingsPath });
    expect(loadSettings({ settingsPath })).toEqual(data);
  });

  it("writes the settings file with mode 0o600 (owner read/write only)", () => {
    saveSettings({ activeProfile: null, profiles: {} }, { settingsPath });
    const stat = fs.statSync(settingsPath);
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it("tightens the mode of a pre-existing permissive settings file", () => {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, "{}", { mode: 0o644 });
    fs.chmodSync(settingsPath, 0o644);
    saveSettings({ activeProfile: null, profiles: {} }, { settingsPath });
    const stat = fs.statSync(settingsPath);
    expect(stat.mode & 0o777).toBe(0o600);
  });
});
