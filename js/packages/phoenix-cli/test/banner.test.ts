import { describe, expect, it } from "vitest";

import { getBannerInfoLines, renderBanner } from "../src/banner";

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

    expect(infoLines).toContain("CLI:     v0.11.0");
    expect(infoLines).toContain(
      "Update:  v0.12.0 available. Run npm install -g @arizeai/phoenix-cli"
    );
  });

  it("shows up to date when the published version matches", () => {
    const infoLines = getBannerInfoLines({
      serverUrl: "http://localhost:6006",
      project: "default",
      hasApiKey: false,
      currentVersion: "0.11.0",
      latestVersion: "0.11.0",
      hasUpdate: false,
    });

    expect(infoLines).toContain("Update:  up to date");
  });

  it("omits update text when update status is unavailable", () => {
    const infoLines = getBannerInfoLines({
      serverUrl: "http://localhost:6006",
      project: "default",
      hasApiKey: false,
      currentVersion: "0.11.0",
    });

    expect(infoLines).toContain("CLI:     v0.11.0");
    expect(infoLines.some((line) => line.startsWith("Update:"))).toBe(false);
  });

  it("renders the tagline and info lines below the logo", () => {
    const banner = renderBanner({
      infoLines: [
        "Server:  http://localhost:6006",
        "Project: default",
        "CLI:     v0.11.0",
        "Update:  up to date",
      ],
    });

    expect(banner).toContain("░▀░░░▀░▀░▀▀▀░▀▀▀░▀░▀░▀▀▀░▀░▀");
    expect(banner).toContain(
      "px is the CLI for interacting with your phoenix instance"
    );
    expect(banner).toContain("Server:  http://localhost:6006");
    expect(banner).toContain("Update:  up to date");
  });
});
