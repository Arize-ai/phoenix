import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  profileNameForEndpoint,
  offerPxProfile,
} from "../../src/setup/steps/offerPxProfile";
import { buildFakeDeps, scriptedPrompter } from "./fakes";

const CONNECTION = {
  endpoint: "https://phoenix.example.com",
  projectName: "my-app",
  projectId: "UHJvamVjdDox",
  apiKey: "sk-secret",
};

describe("profileNameForEndpoint", () => {
  it("names localhost profiles 'local'", () => {
    expect(profileNameForEndpoint("http://localhost:6006")).toBe("local");
    expect(profileNameForEndpoint("http://127.0.0.1:6006")).toBe("local");
    // URL.hostname keeps the brackets on IPv6 literals.
    expect(profileNameForEndpoint("http://[::1]:6006")).toBe("local");
  });

  it("dashes the host otherwise", () => {
    expect(profileNameForEndpoint("https://phoenix.example.com")).toBe(
      "phoenix-example-com"
    );
  });

  it("strips brackets and dashes colons for IPv6 hosts", () => {
    expect(profileNameForEndpoint("http://[2001:db8::1]:6006")).toBe(
      "2001-db8--1"
    );
  });
});

describe("offerPxProfile", () => {
  let dir: string;
  let settingsPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "px-setup-profile-"));
    settingsPath = path.join(dir, "settings.json");
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function readSettings() {
    return JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
  }

  it("creates and activates a profile carrying the key in-process", async () => {
    const prompter = scriptedPrompter([true]);
    const deps = buildFakeDeps({ prompter });
    await offerPxProfile(deps, { connection: CONNECTION, settingsPath });
    const settings = readSettings();
    expect(settings.activeProfile).toBe("phoenix-example-com");
    expect(settings.profiles["phoenix-example-com"]).toEqual({
      endpoint: CONNECTION.endpoint,
      project: CONNECTION.projectName,
      apiKey: CONNECTION.apiKey,
    });
  });

  it("declining writes nothing", async () => {
    const prompter = scriptedPrompter([false]);
    const deps = buildFakeDeps({ prompter });
    await offerPxProfile(deps, { connection: CONNECTION, settingsPath });
    expect(fs.existsSync(settingsPath)).toBe(false);
  });

  it("asks before switching away from a conflicting active profile", async () => {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        activeProfile: "other",
        profiles: {
          other: {
            endpoint: "https://other.example.com",
            project: "other-project",
          },
        },
      })
    );
    const prompter = scriptedPrompter([false]); // decline the switch
    const deps = buildFakeDeps({ prompter });
    await offerPxProfile(deps, { connection: CONNECTION, settingsPath });
    expect(prompter.transcript[0]).toContain("other");
    const settings = readSettings();
    expect(settings.activeProfile).toBe("other");
    expect(settings.profiles["phoenix-example-com"]).toBeUndefined();
  });

  it("a partially-configured active profile is non-conflicting", async () => {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        activeProfile: "partial",
        profiles: { partial: { endpoint: "https://other.example.com" } },
      })
    );
    const prompter = scriptedPrompter([true]);
    const deps = buildFakeDeps({ prompter });
    await offerPxProfile(deps, { connection: CONNECTION, settingsPath });
    // The generic opt-in was asked (not the conflict question).
    expect(prompter.transcript[0]).toContain("point the px CLI");
    expect(readSettings().activeProfile).toBe("phoenix-example-com");
  });

  it("leaves a malformed settings file alone and names it", async () => {
    fs.writeFileSync(settingsPath, "{ not json");
    const prompter = scriptedPrompter([]);
    const deps = buildFakeDeps({ prompter });

    await offerPxProfile(deps, { connection: CONNECTION, settingsPath });

    // Never asked, never saved: the file the run couldn't read is still the
    // file on disk, byte for byte.
    expect(prompter.transcript).toEqual([]);
    expect(fs.readFileSync(settingsPath, "utf-8")).toBe("{ not json");
    // And the user is pointed at the file, not at `px profile create` — which
    // reads it the same strict way and would fail identically.
    const warning = prompter.output.join("\n");
    expect(warning).toContain(settingsPath);
    expect(warning).toContain("Fix or delete that file");
  });

  it("errors are non-fatal warnings", async () => {
    const prompter = scriptedPrompter([true]);
    const deps = buildFakeDeps({ prompter });
    // Unwritable settings path: parent dir is a file.
    const blocked = path.join(dir, "blocked");
    fs.writeFileSync(blocked, "file");
    await expect(
      offerPxProfile(deps, {
        connection: CONNECTION,
        settingsPath: path.join(blocked, "settings.json"),
      })
    ).resolves.toBeUndefined();
    expect(
      prompter.output.some((line) => line.includes("Couldn't write"))
    ).toBe(true);
  });
});
